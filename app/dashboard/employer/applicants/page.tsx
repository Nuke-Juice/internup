import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { startVerifiedEmployerCheckoutAction } from '@/lib/billing/actions'
import { getEmployerPlanFeatures } from '@/lib/billing/plan'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import ApplicantsInboxGroup from '@/app/dashboard/employer/_components/ApplicantsInboxGroup'
import ApplicantsSortControls, { type ApplicantsSort } from '@/app/dashboard/employer/_components/ApplicantsSortControls'

type SearchParams = Promise<{
  sort?: string
  updated?: string
  error?: string
  claimed?: string
  dismiss_claimed?: string
  internship_id?: string
  status?: string
  ready?: string
}>

type ApplicationStatus = 'submitted' | 'reviewing' | 'interview' | 'rejected' | 'accepted'

type ApplicationRow = {
  id: string
  internship_id: string
  student_id: string
  created_at: string | null
  match_score: number | null
  match_reasons: unknown
  resume_url: string | null
  status: string | null
  reviewed_at: string | null
  notes: string | null
}

function normalizeSort(value: string | undefined): ApplicantsSort {
  return value === 'applied_at' ? 'applied_at' : 'match_score'
}

function normalizeSortForPlan(value: string | undefined, canSortByMatch: boolean): ApplicantsSort {
  const requested = normalizeSort(value)
  if (!canSortByMatch && requested === 'match_score') return 'applied_at'
  return requested
}

function normalizeStatus(value: string | null): ApplicationStatus {
  if (value === 'reviewing' || value === 'interview' || value === 'rejected' || value === 'accepted') return value
  return 'submitted'
}

type ApplicantStatusFilter = ApplicationStatus | 'all'

function normalizeStatusFilter(value: string | undefined, enabled: boolean): ApplicantStatusFilter {
  if (!enabled) return 'all'
  if (value === 'submitted' || value === 'reviewing' || value === 'interview' || value === 'rejected' || value === 'accepted') return value
  return 'all'
}

type ApplicantReadinessFilter = 'all' | 'high' | 'baseline'

function normalizeReadinessFilter(value: string | undefined, enabled: boolean): ApplicantReadinessFilter {
  if (!enabled) return 'all'
  if (value === 'high' || value === 'baseline') return value
  return 'all'
}

function parseReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function applicantName(studentId: string) {
  return `Applicant ${studentId.slice(0, 8)}`
}

function formatMajor(value: string[] | string | null | undefined, canonicalName?: string | null) {
  if (typeof canonicalName === 'string' && canonicalName.trim()) return canonicalName
  if (Array.isArray(value)) return value[0] ?? 'Major not set'
  if (typeof value === 'string' && value.trim()) return value
  return 'Major not set'
}

function canonicalMajorName(value: unknown) {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as { name?: unknown } | undefined
    return typeof first?.name === 'string' ? first.name : null
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { name?: unknown }
    return typeof maybe.name === 'string' ? maybe.name : null
  }
  return null
}

function toStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function buildReadinessLabel(input: {
  hasResume: boolean
  major: string[] | string | null | undefined
  canonicalMajorName?: string | null
  coursework: unknown
  skillIds: string[]
  availabilityHoursPerWeek: number | null
}) {
  const readinessChecks = [
    input.hasResume,
    Boolean(formatMajor(input.major, input.canonicalMajorName) && formatMajor(input.major, input.canonicalMajorName) !== 'Major not set'),
    toStringList(input.coursework).length > 0,
    input.skillIds.length > 0,
    typeof input.availabilityHoursPerWeek === 'number' && input.availabilityHoursPerWeek > 0,
  ]
  const met = readinessChecks.filter(Boolean).length
  return met >= 4 ? 'High readiness' : 'Baseline'
}

function buildFitSummary(input: {
  major: string
  graduationYear: string
  hasResume: boolean
  topReason?: string | null
}) {
  const parts: string[] = []
  if (input.major !== 'Major not set') parts.push('Major match signal')
  if (input.graduationYear !== 'Grad year not set') parts.push('Grad year signal')
  parts.push(input.hasResume ? 'Resume on file' : 'Resume missing')
  if (input.topReason) parts.push(input.topReason)
  return parts.join(' • ')
}

export default async function EmployerApplicantsPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const paramsForNext = new URLSearchParams()
  if (resolvedSearchParams?.sort) paramsForNext.set('sort', resolvedSearchParams.sort)
  if (resolvedSearchParams?.updated) paramsForNext.set('updated', resolvedSearchParams.updated)
  if (resolvedSearchParams?.error) paramsForNext.set('error', resolvedSearchParams.error)
  if (resolvedSearchParams?.claimed) paramsForNext.set('claimed', resolvedSearchParams.claimed)
  if (resolvedSearchParams?.dismiss_claimed) paramsForNext.set('dismiss_claimed', resolvedSearchParams.dismiss_claimed)
  if (resolvedSearchParams?.internship_id) paramsForNext.set('internship_id', resolvedSearchParams.internship_id)
  if (resolvedSearchParams?.status) paramsForNext.set('status', resolvedSearchParams.status)
  if (resolvedSearchParams?.ready) paramsForNext.set('ready', resolvedSearchParams.ready)
  const requestedPath =
    paramsForNext.size > 0
      ? `/dashboard/employer/applicants?${paramsForNext.toString()}`
      : '/dashboard/employer/applicants'
  const { user } = await requireRole('employer', { requestedPath })
  const selectedInternshipId = String(resolvedSearchParams?.internship_id ?? '').trim()
  const supabase = await supabaseServer()
  const { isVerifiedEmployer, planId } = await getEmployerVerificationStatus({ supabase, userId: user.id })
  const features = getEmployerPlanFeatures(planId)
  const sort = normalizeSortForPlan(resolvedSearchParams?.sort, features.rankedApplicants)
  const selectedStatusFilter = normalizeStatusFilter(resolvedSearchParams?.status, features.advancedApplicantFilters)
  const selectedReadinessFilter = normalizeReadinessFilter(resolvedSearchParams?.ready, features.advancedApplicantFilters)
  const showClaimedBanner =
    resolvedSearchParams?.claimed === '1' &&
    resolvedSearchParams?.dismiss_claimed !== '1' &&
    !isVerifiedEmployer
  const buildSortHref = (nextSort: ApplicantsSort) => {
    const params = new URLSearchParams()
    params.set('sort', nextSort)
    if (selectedInternshipId) params.set('internship_id', selectedInternshipId)
    if (features.advancedApplicantFilters && selectedStatusFilter !== 'all') params.set('status', selectedStatusFilter)
    if (features.advancedApplicantFilters && selectedReadinessFilter !== 'all') params.set('ready', selectedReadinessFilter)
    return `/dashboard/employer/applicants?${params.toString()}`
  }

  await trackAnalyticsEvent({
    eventName: 'employer_open_applicants_inbox',
    userId: user.id,
    properties: { sort },
  })

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false })

  const availableInternships = internships ?? []
  const internshipIds = availableInternships.map((row) => row.id)
  const scopedInternshipIds =
    selectedInternshipId && internshipIds.includes(selectedInternshipId) ? [selectedInternshipId] : internshipIds

  let applications: ApplicationRow[] = []
  if (scopedInternshipIds.length > 0) {
    let query = supabase
      .from('applications')
      .select('id, internship_id, student_id, created_at, match_score, match_reasons, resume_url, status, reviewed_at, notes')
      .in('internship_id', scopedInternshipIds)

    if (selectedStatusFilter !== 'all') {
      query = query.eq('status', selectedStatusFilter)
    }

    if (sort === 'match_score') {
      query = query.order('match_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false }).order('match_score', { ascending: false, nullsFirst: false })
    }

    const { data } = await query
    applications = (data ?? []) as ApplicationRow[]
  }

  const studentIds = Array.from(new Set(applications.map((row) => row.student_id)))
  const { data: profiles } =
    studentIds.length > 0
      ? await supabase
          .from('student_profiles')
          .select('user_id, school, major:canonical_majors(name), majors, year, coursework, availability_hours_per_week')
          .in('user_id', studentIds)
      : {
          data: [] as Array<{
            user_id: string
            school: string | null
            major: { name?: string | null } | null
            majors: string[] | string | null
            year: string | null
            coursework: string[] | string | null
            availability_hours_per_week: number | null
          }>,
        }
  const { data: studentSkillRows } =
    studentIds.length > 0
      ? await supabase.from('student_skill_items').select('student_id, skill_id').in('student_id', studentIds)
      : { data: [] as Array<{ student_id: string; skill_id: string }> }
  const skillIdsByStudent = new Map<string, string[]>()
  for (const row of studentSkillRows ?? []) {
    const list = skillIdsByStudent.get(row.student_id) ?? []
    if (typeof row.skill_id === 'string' && row.skill_id.length > 0) {
      list.push(row.skill_id)
      skillIdsByStudent.set(row.student_id, list)
    }
  }

  const profileByStudentId = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      {
        school: profile.school ?? 'University not set',
        major: formatMajor(profile.majors, canonicalMajorName(profile.major)),
        year: profile.year ?? 'Grad year not set',
        majorRaw: profile.majors,
        canonicalMajorName: canonicalMajorName(profile.major),
        coursework: profile.coursework ?? [],
        availabilityHoursPerWeek: profile.availability_hours_per_week ?? null,
      },
    ])
  )

  const uniqueResumePaths = Array.from(new Set(applications.map((row) => row.resume_url).filter(Boolean))) as string[]
  const signedResumeEntries = await Promise.all(
    uniqueResumePaths.map(async (path) => {
      const { data } = await supabase.storage.from('resumes').createSignedUrl(path, 60 * 60)
      return [path, data?.signedUrl ?? null] as const
    })
  )
  const signedResumeUrlByPath = new Map(signedResumeEntries)

  const groups = availableInternships
    .filter((internship) => scopedInternshipIds.includes(internship.id))
    .map((internship) => {
      const applicants = applications
        .filter((application) => application.internship_id === internship.id)
        .map((application, index) => {
          const profile = profileByStudentId.get(application.student_id)
          const topReasons = features.matchReasons && index < 3 ? parseReasons(application.match_reasons).slice(0, 2) : []
          const readinessLabel = buildReadinessLabel({
            hasResume: Boolean(application.resume_url),
            major: profile?.majorRaw,
            canonicalMajorName: profile?.canonicalMajorName,
            coursework: profile?.coursework,
            skillIds: skillIdsByStudent.get(application.student_id) ?? [],
            availabilityHoursPerWeek: profile?.availabilityHoursPerWeek ?? null,
          })
          return {
            id: `${internship.id}-${application.id}`,
            applicationId: application.id,
            studentId: application.student_id,
            applicantName: applicantName(application.student_id),
            university: profile?.school ?? 'University not set',
            major: profile?.major ?? 'Major not set',
            graduationYear: profile?.year ?? 'Grad year not set',
            fitSummary: buildFitSummary({
              major: profile?.major ?? 'Major not set',
              graduationYear: profile?.year ?? 'Grad year not set',
              hasResume: Boolean(application.resume_url),
              topReason: topReasons[0] ?? null,
            }),
            appliedAt: application.created_at,
            matchScore: application.match_score,
            topReasons,
            readinessLabel,
            resumeUrl: application.resume_url ? signedResumeUrlByPath.get(application.resume_url) ?? null : null,
            status: normalizeStatus(application.status),
            notes: application.notes ?? null,
          }
        })
        .filter((applicant) => {
          if (selectedReadinessFilter === 'all') return true
          if (selectedReadinessFilter === 'high') return applicant.readinessLabel === 'High readiness'
          return applicant.readinessLabel !== 'High readiness'
        })

      return {
        internshipId: internship.id,
        internshipTitle: internship.title ?? 'Internship',
        applicants,
      }
    })

  async function updateApplication(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer/applicants' })
    const applicationId = String(formData.get('application_id') ?? '').trim()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const status = String(formData.get('status') ?? '').trim()
    const notes = String(formData.get('notes') ?? '').trim()

    if (!applicationId || !internshipId) {
      redirect('/dashboard/employer/applicants?error=Missing+application+context')
    }

    const allowedStatuses = new Set<ApplicationStatus>([
      'submitted',
      'reviewing',
      'interview',
      'rejected',
      'accepted',
    ])
    const nextStatus = (allowedStatuses.has(status as ApplicationStatus) ? status : 'submitted') as ApplicationStatus

    const actionSupabase = await supabaseServer()
    const { data: internship } = await actionSupabase
      .from('internships')
      .select('id')
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)
      .maybeSingle()

    if (!internship?.id) {
      redirect('/dashboard/employer/applicants?error=Not+authorized+to+update+that+application')
    }

    const { error } = await actionSupabase
      .from('applications')
      .update({
        status: nextStatus,
        notes: notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .eq('internship_id', internshipId)

    if (error) {
      redirect(`/dashboard/employer/applicants?error=${encodeURIComponent(error.message)}`)
    }

    await trackAnalyticsEvent({
      eventName: 'employer_mark_application_reviewed',
      userId: currentUser.id,
      properties: { internship_id: internshipId, application_id: applicationId, status: nextStatus },
    })

    const next = new URLSearchParams({ sort, updated: '1' })
    if (selectedInternshipId) next.set('internship_id', selectedInternshipId)
    redirect(`/dashboard/employer/applicants?${next.toString()}`)
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/dashboard/employer"
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Applicant inbox</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review applicants by internship and move them through your hiring workflow.
            </p>
          </div>
          <ApplicantsSortControls
            currentSort={sort}
            canSortByMatch={features.rankedApplicants}
            matchScoreHref={buildSortHref('match_score')}
            appliedAtHref={buildSortHref('applied_at')}
            upgradeHref="/upgrade"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">Applicant queue</span>
          <span
            className={`rounded-full border px-2.5 py-1 ${
              features.rankedApplicants
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            Match ranking
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 ${
              features.advancedApplicantFilters
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            Advanced filters
          </span>
        </div>

        {features.advancedApplicantFilters ? (
          <form className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internship</label>
                <select name="internship_id" defaultValue={selectedInternshipId} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                  <option value="">All internships</option>
                  {availableInternships.map((internship) => (
                    <option key={internship.id} value={internship.id}>
                      {internship.title ?? 'Internship'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                <select name="status" defaultValue={selectedStatusFilter} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="interview">Interview</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Readiness</label>
                <select name="ready" defaultValue={selectedReadinessFilter} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                  <option value="all">All</option>
                  <option value="high">High readiness</option>
                  <option value="baseline">Baseline</option>
                </select>
              </div>
            </div>
            <input type="hidden" name="sort" value={sort} />
            <div className="mt-3 flex items-center gap-2">
              <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                Apply filters
              </button>
              <Link href={`/dashboard/employer/applicants?sort=${encodeURIComponent(sort)}`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Reset
              </Link>
            </div>
          </form>
        ) : null}
        {!features.rankedApplicants ? (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Upgrade to unlock Best Match sorting and “Why this matches” reasons.
            <Link href="/upgrade" className="ml-2 font-semibold underline">
              View plans
            </Link>
          </div>
        ) : !features.advancedApplicantFilters ? (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Upgrade to Pro for readiness and advanced filters.
            <Link href="/upgrade" className="ml-2 font-semibold underline">
              Upgrade to Pro
            </Link>
          </div>
        ) : null}

        {resolvedSearchParams?.error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}
        {resolvedSearchParams?.updated ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Application updated.
          </div>
        ) : null}
        {showClaimedBanner ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>You&rsquo;re claimed ✅ Need more hiring capacity? Pro includes up to 7 active postings + email alerts.</p>
              <div className="flex flex-wrap items-center gap-2">
                <form action={startVerifiedEmployerCheckoutAction}>
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Upgrade
                  </button>
                </form>
                <Link
                  href={`/dashboard/employer/applicants?${new URLSearchParams({
                    sort,
                    dismiss_claimed: '1',
                    ...(selectedInternshipId ? { internship_id: selectedInternshipId } : {}),
                  }).toString()}`}
                  className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Dismiss
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {groups.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No internships found yet. Create an internship first to receive applicants.
          </div>
        ) : groups.every((group) => group.applicants.length === 0) ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No applications yet.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groups.map((group) => (
              <ApplicantsInboxGroup
                key={group.internshipId}
                internshipId={group.internshipId}
                internshipTitle={group.internshipTitle}
                applicants={group.applicants}
                onUpdate={updateApplication}
                showMatchScore={features.rankedApplicants}
                showReasons={features.matchReasons}
                showReadiness={features.readinessSignals}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
