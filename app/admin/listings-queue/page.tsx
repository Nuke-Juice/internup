import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ListingsQueue from '@/components/admin/ListingsQueue'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { computeListingQualityScore } from '@/lib/admin/listingQuality'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{ tab?: string; success?: string; error?: string }>

type QueueTab = 'pending' | 'active' | 'flagged' | 'inactive'

type InternshipRow = {
  id: string
  title: string | null
  employer_id: string
  company_name: string | null
  employer_verification_tier: string | null
  work_mode: string | null
  location_city: string | null
  location_state: string | null
  pay_min: number | null
  pay_max: number | null
  hours_min: number | null
  hours_max: number | null
  application_deadline: string | null
  created_at: string | null
  description: string | null
  external_apply_url: string | null
  status: string | null
  is_active: boolean | null
}

type EmployerProfile = {
  user_id: string
  company_name: string | null
  website: string | null
  overview: string | null
  avatar_url: string | null
  contact_email: string | null
}

function normalizeTab(value: string | undefined): QueueTab {
  if (value === 'active' || value === 'flagged' || value === 'inactive') return value
  return 'pending'
}

function toQueueTab(input: {
  status: string | null
  isActive: boolean | null
  qualityScore: number
  hasFlags: boolean
}): QueueTab {
  if (input.qualityScore < 55 || input.hasFlags) return 'flagged'
  if (input.status === 'published' || input.isActive) return 'active'
  if (input.status === 'draft' || input.status === 'pending_review') return 'pending'
  return 'inactive'
}

function buildLocationLabel(row: InternshipRow) {
  const mode = row.work_mode ?? 'n/a'
  if (mode === 'remote') return 'remote'
  if (row.location_city && row.location_state) return `${mode} · ${row.location_city}, ${row.location_state}`
  if (row.location_state) return `${mode} · ${row.location_state}`
  return mode
}

function withTab(tab: QueueTab, params?: { success?: string; error?: string }) {
  const search = new URLSearchParams({ tab })
  if (params?.success) search.set('success', params.success)
  if (params?.error) search.set('error', params.error)
  return `/admin/listings-queue?${search.toString()}`
}

export default async function AdminListingsQueuePage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/listings-queue' })

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Admin listings queue</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const resolved = searchParams ? await searchParams : undefined
  const tab = normalizeTab(resolved?.tab)
  const admin = supabaseAdmin()

  const [{ data: internshipRows }, { data: employerRows }] = await Promise.all([
    admin
      .from('internships')
      .select(
        'id, title, employer_id, company_name, employer_verification_tier, work_mode, location_city, location_state, pay_min, pay_max, hours_min, hours_max, application_deadline, created_at, description, external_apply_url, status, is_active'
      )
      .order('created_at', { ascending: false })
      .limit(1200),
    admin
      .from('employer_profiles')
      .select('user_id, company_name, website, overview, avatar_url, contact_email')
      .limit(1200),
  ])

  const internships = (internshipRows ?? []) as InternshipRow[]
  const employers = (employerRows ?? []) as EmployerProfile[]
  const employerById = new Map(employers.map((row) => [row.user_id, row]))

  const postCountByEmployer = new Map<string, number>()
  for (const row of internships) {
    postCountByEmployer.set(row.employer_id, (postCountByEmployer.get(row.employer_id) ?? 0) + 1)
  }

  const descriptionCountByText = new Map<string, number>()
  for (const row of internships) {
    const normalized = (row.description ?? '').trim().toLowerCase()
    if (!normalized) continue
    descriptionCountByText.set(normalized, (descriptionCountByText.get(normalized) ?? 0) + 1)
  }

  const enriched = internships.map((row) => {
    const employer = employerById.get(row.employer_id)
    const normalizedDescription = (row.description ?? '').trim().toLowerCase()
    const quality = computeListingQualityScore({
      employerWebsite: employer?.website ?? null,
      employerOverview: employer?.overview ?? null,
      employerLogoUrl: employer?.avatar_url ?? null,
      verificationTier: row.employer_verification_tier ?? null,
      employerContactEmail: employer?.contact_email ?? null,
      payPresent: typeof row.pay_min === 'number' && typeof row.pay_max === 'number',
      hoursPresent: typeof row.hours_min === 'number' && typeof row.hours_max === 'number',
      locationPresent: Boolean(row.location_city || row.location_state || row.work_mode === 'remote'),
      externalApplyUrl: row.external_apply_url ?? null,
      employerPostCount: postCountByEmployer.get(row.employer_id) ?? 0,
      duplicateDescriptionCount: normalizedDescription ? (descriptionCountByText.get(normalizedDescription) ?? 0) : 0,
    })

    const queueTab = toQueueTab({
      status: row.status,
      isActive: row.is_active,
      qualityScore: quality.score,
      hasFlags: quality.flags.length > 0,
    })

    return {
      id: row.id,
      title: row.title,
      companyName: employer?.company_name ?? row.company_name ?? 'Unknown company',
      verificationTier: row.employer_verification_tier ?? 'free',
      locationLabel: buildLocationLabel(row),
      hasPay: typeof row.pay_min === 'number' && typeof row.pay_max === 'number',
      hasHours: typeof row.hours_min === 'number' && typeof row.hours_max === 'number',
      hasDeadline: Boolean(row.application_deadline),
      createdAt: row.created_at,
      qualityScore: quality.score,
      flags: quality.flags,
      isActive: Boolean(row.is_active),
      queueTab,
    }
  })

  const counts: Record<QueueTab, number> = {
    pending: enriched.filter((item) => item.queueTab === 'pending').length,
    active: enriched.filter((item) => item.queueTab === 'active').length,
    flagged: enriched.filter((item) => item.queueTab === 'flagged').length,
    inactive: enriched.filter((item) => item.queueTab === 'inactive').length,
  }

  const rows = enriched.filter((item) => item.queueTab === tab)

  async function approve(formData: FormData) {
    'use server'
    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/listings-queue' })
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    if (!internshipId) redirect(withTab(tab, { error: 'Missing internship id' }))

    const adminWrite = supabaseAdmin()
    const { error } = await adminWrite.from('internships').update({ is_active: true, status: 'published' }).eq('id', internshipId)
    if (error) redirect(withTab(tab, { error: error.message }))
    redirect(withTab(tab, { success: 'Listing approved' }))
  }

  async function reject(formData: FormData) {
    'use server'
    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/listings-queue' })
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    if (!internshipId) redirect(withTab(tab, { error: 'Missing internship id' }))

    const adminWrite = supabaseAdmin()
    const { error } = await adminWrite.from('internships').update({ is_active: false, status: 'rejected' }).eq('id', internshipId)
    if (error) redirect(withTab(tab, { error: error.message }))
    redirect(withTab(tab, { success: 'Listing rejected' }))
  }

  async function deactivate(formData: FormData) {
    'use server'
    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/listings-queue' })
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    if (!internshipId) redirect(withTab(tab, { error: 'Missing internship id' }))

    const adminWrite = supabaseAdmin()
    const { error } = await adminWrite.from('internships').update({ is_active: false, status: 'inactive' }).eq('id', internshipId)
    if (error) redirect(withTab(tab, { error: error.message }))
    redirect(withTab(tab, { success: 'Listing deactivated' }))
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-4">
        <div>
          <Link
            href="/admin"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Listings queue</h1>
          <p className="mt-1 text-sm text-slate-600">Moderate listings with quality signals and one-click actions.</p>
        </div>

        {resolved?.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{decodeURIComponent(resolved.error)}</div>
        ) : null}
        {resolved?.success ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {decodeURIComponent(resolved.success)}
          </div>
        ) : null}

        <ListingsQueue tab={tab} rows={rows} counts={counts} onApprove={approve} onReject={reject} onDeactivate={deactivate} />
      </section>
    </main>
  )
}
