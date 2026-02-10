import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { startVerifiedEmployerCheckoutAction } from '@/lib/billing/actions'
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

function normalizeStatus(value: string | null): ApplicationStatus {
  if (value === 'reviewing' || value === 'interview' || value === 'rejected' || value === 'accepted') return value
  return 'submitted'
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

export default async function EmployerApplicantsPage({ searchParams }: { searchParams?: SearchParams }) {
  const { user } = await requireRole('employer')
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const sort = normalizeSort(resolvedSearchParams?.sort)
  const selectedInternshipId = String(resolvedSearchParams?.internship_id ?? '').trim()
  const supabase = await supabaseServer()
  const { isVerifiedEmployer } = await getEmployerVerificationStatus({ supabase, userId: user.id })
  const showClaimedBanner =
    resolvedSearchParams?.claimed === '1' &&
    resolvedSearchParams?.dismiss_claimed !== '1' &&
    !isVerifiedEmployer

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
          .select('user_id, school, major:canonical_majors(name), majors, year')
          .in('user_id', studentIds)
      : {
          data: [] as Array<{
            user_id: string
            school: string | null
            major: { name?: string | null } | null
            majors: string[] | string | null
            year: string | null
          }>,
        }

  const profileByStudentId = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      {
        school: profile.school ?? 'University not set',
        major: formatMajor(profile.majors, canonicalMajorName(profile.major)),
        year: profile.year ?? 'Grad year not set',
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
      .map((application) => {
        const profile = profileByStudentId.get(application.student_id)
        return {
          id: `${internship.id}-${application.id}`,
          applicationId: application.id,
          studentId: application.student_id,
          applicantName: applicantName(application.student_id),
          university: profile?.school ?? 'University not set',
          major: profile?.major ?? 'Major not set',
          graduationYear: profile?.year ?? 'Grad year not set',
          appliedAt: application.created_at,
          matchScore: application.match_score,
          topReasons: parseReasons(application.match_reasons).slice(0, 2),
          resumeUrl: application.resume_url ? signedResumeUrlByPath.get(application.resume_url) ?? null : null,
          status: normalizeStatus(application.status),
          notes: application.notes ?? null,
        }
      })

    return {
      internshipId: internship.id,
      internshipTitle: internship.title ?? 'Internship',
      applicants,
    }
    })

  async function updateApplication(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer')
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
          <ApplicantsSortControls currentSort={sort} />
        </div>

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
              <p>You&rsquo;re claimed ✅ Want unlimited postings + email alerts? Upgrade to Verified Employer.</p>
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
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
