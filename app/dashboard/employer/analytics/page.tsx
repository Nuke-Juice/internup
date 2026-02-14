import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import AnalyticsCharts from './_components/AnalyticsCharts'

type InternshipRow = {
  id: string
  title: string | null
  created_at: string | null
  status: string | null
  is_active: boolean | null
}

type InternshipEventRow = {
  internship_id: string
  event_type: string
  created_at: string
}

type ApplicationRow = {
  internship_id: string
  created_at: string
}

function daysAgoIso(daysAgo: number) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() - daysAgo)
  now.setUTCHours(0, 0, 0, 0)
  return now.toISOString()
}

function labelForDay(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - offset)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function toDayKey(value: string) {
  return value.slice(0, 10)
}

export default async function EmployerAnalyticsPage() {
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/analytics' })
  const supabase = await supabaseServer()

  const { data: internshipRowsData } = await supabase
    .from('internships')
    .select('id, title, created_at, status, is_active')
    .eq('employer_id', user.id)

  const internships = (internshipRowsData ?? []) as InternshipRow[]
  const internshipIds = internships.map((row) => row.id)
  const activeListingsCount = internships.filter((row) => row.status === 'published' || row.is_active).length
  const draftListingsCount = internships.filter((row) => row.status !== 'published' && !row.is_active).length

  const [{ data: eventRowsData, error: eventError }, { data: applicationRowsData }] = await Promise.all([
    internshipIds.length > 0
      ? supabase
          .from('internship_events')
          .select('internship_id, event_type, created_at')
          .in('internship_id', internshipIds)
      : { data: [] as InternshipEventRow[], error: null },
    internshipIds.length > 0
      ? supabase
          .from('applications')
          .select('internship_id, created_at')
          .in('internship_id', internshipIds)
      : { data: [] as ApplicationRow[] },
  ])

  const eventRows = eventError ? [] : ((eventRowsData ?? []) as InternshipEventRow[])
  const applicationRows = (applicationRowsData ?? []) as ApplicationRow[]

  const viewEvents = eventRows.filter((row) => row.event_type === 'view')
  const clickEvents = eventRows.filter((row) => row.event_type === 'click')
  const applyEvents = eventRows.filter((row) => row.event_type === 'apply')

  const viewsAll = viewEvents.length
  const applicationsAll = applicationRows.length
  const clicksAll = clickEvents.length

  const sevenDayCutoff = daysAgoIso(7)
  const thirtyDayCutoff = daysAgoIso(30)

  const views7 = viewEvents.filter((row) => row.created_at >= sevenDayCutoff).length
  const views30 = viewEvents.filter((row) => row.created_at >= thirtyDayCutoff).length
  const applications7 = applicationRows.filter((row) => row.created_at >= sevenDayCutoff).length
  const applications30 = applicationRows.filter((row) => row.created_at >= thirtyDayCutoff).length

  const conversionAll = viewsAll > 0 ? (applicationsAll / viewsAll) * 100 : 0
  const conversion30 = views30 > 0 ? (applications30 / views30) * 100 : 0

  const internshipTitleById = new Map(internships.map((row) => [row.id, row.title || 'Untitled listing']))

  const viewsByListing = new Map<string, number>()
  for (const row of viewEvents) {
    viewsByListing.set(row.internship_id, (viewsByListing.get(row.internship_id) ?? 0) + 1)
  }
  const topByViews = Array.from(viewsByListing.entries())
    .map(([internshipId, value]) => ({ internshipId, value, title: internshipTitleById.get(internshipId) ?? 'Untitled listing' }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)

  const appsByListing = new Map<string, number>()
  for (const row of applicationRows) {
    appsByListing.set(row.internship_id, (appsByListing.get(row.internship_id) ?? 0) + 1)
  }
  const topByApplications = Array.from(appsByListing.entries())
    .map(([internshipId, value]) => ({ internshipId, value, title: internshipTitleById.get(internshipId) ?? 'Untitled listing' }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8)

  const applicationTimeByInternship = new Map<string, Date>()
  for (const row of applicationRows) {
    const current = applicationTimeByInternship.get(row.internship_id)
    const created = new Date(row.created_at)
    if (!current || created < current) {
      applicationTimeByInternship.set(row.internship_id, created)
    }
  }
  const firstApplicationDelaysHours = internships
    .map((internship) => {
      if (!internship.created_at) return null
      const firstApplicationAt = applicationTimeByInternship.get(internship.id)
      if (!firstApplicationAt) return null
      const postedAt = new Date(internship.created_at)
      const diffHours = (firstApplicationAt.getTime() - postedAt.getTime()) / (1000 * 60 * 60)
      return diffHours >= 0 ? diffHours : null
    })
    .filter((value): value is number => value !== null)
  const avgTimeToFirstApplicationHours =
    firstApplicationDelaysHours.length > 0
      ? firstApplicationDelaysHours.reduce((sum, value) => sum + value, 0) / firstApplicationDelaysHours.length
      : null

  const days = Array.from({ length: 30 }, (_, index) => 29 - index)
  const dailyViewsByDay = new Map<string, number>()
  const dailyApplicationsByDay = new Map<string, number>()

  for (const row of viewEvents) {
    const key = toDayKey(row.created_at)
    dailyViewsByDay.set(key, (dailyViewsByDay.get(key) ?? 0) + 1)
  }
  for (const row of applicationRows) {
    const key = toDayKey(row.created_at)
    dailyApplicationsByDay.set(key, (dailyApplicationsByDay.get(key) ?? 0) + 1)
  }

  const viewsSeries = days.map((offset) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - offset)
    const key = date.toISOString().slice(0, 10)
    return { label: labelForDay(offset), value: dailyViewsByDay.get(key) ?? 0 }
  })
  const applicationsSeries = days.map((offset) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - offset)
    const key = date.toISOString().slice(0, 10)
    return { label: labelForDay(offset), value: dailyApplicationsByDay.get(key) ?? 0 }
  })
  const conversionSeries = viewsSeries.map((point, index) => {
    const viewsValue = point.value
    const applicationsValue = applicationsSeries[index]?.value ?? 0
    const conversion = viewsValue > 0 ? Math.round((applicationsValue / viewsValue) * 1000) / 10 : 0
    return { label: point.label, value: conversion }
  })

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-3">
          <Link
            href="/dashboard/employer"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="mt-1 text-slate-600">Track listing views, applications, and conversion trends.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Views</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{views7}</p>
            <p className="text-xs text-slate-500">7d</p>
            <p className="mt-1 text-xs text-slate-500">{views30} in 30d • {viewsAll} all-time</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Applications</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{applications7}</p>
            <p className="text-xs text-slate-500">7d</p>
            <p className="mt-1 text-xs text-slate-500">{applications30} in 30d • {applicationsAll} all-time</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">View to apply conversion</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{conversion30.toFixed(1)}%</p>
            <p className="text-xs text-slate-500">30d</p>
            <p className="mt-1 text-xs text-slate-500">{conversionAll.toFixed(1)}% all-time</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg time to first application</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {avgTimeToFirstApplicationHours === null ? 'n/a' : `${avgTimeToFirstApplicationHours.toFixed(1)}h`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Clicks tracked: {clicksAll}</p>
            <p className="text-xs text-slate-500">Apply events tracked: {applyEvents.length}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active listings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{activeListingsCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Draft listings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{draftListingsCount}</p>
          </div>
        </div>

        <AnalyticsCharts
          viewsSeries={viewsSeries}
          applicationsSeries={applicationsSeries}
          conversionSeries={conversionSeries}
          topByViews={topByViews}
          topByApplications={topByApplications}
        />
      </section>
    </main>
  )
}
