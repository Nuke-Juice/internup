import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { getAppUrl } from '@/lib/billing/stripe'
import { sendEmployerSummaryEmail, type EmployerSummaryCandidate } from '@/lib/email/employerSummary'
import {
  buildEmployerClaimStatus,
  sendEmployerClaimLink,
  type EmployerClaimTokenRow,
} from '@/lib/auth/employerClaimAdmin'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{
  q?: string
  status?: string
  updated?: string
  summarySent?: string
  claimSent?: string
  claimResent?: string
  contactSaved?: string
  error?: string
}>

type ApplicationStatus = 'submitted' | 'reviewing' | 'interview' | 'rejected' | 'accepted'

const ALLOWED_STATUSES: readonly ApplicationStatus[] = ['submitted', 'reviewing', 'interview', 'rejected', 'accepted']

type ApplicationRow = {
  id: string
  internship_id: string
  student_id: string
  created_at: string | null
  match_score: number | null
  match_reasons: unknown
  resume_url: string | null
  status: string | null
}

type StudentProfileRow = {
  user_id: string
  school: string | null
  major?: { name?: string | null } | null
  majors: string[] | string | null
  year: string | null
}

function normalizeStatus(value: string | null | undefined): ApplicationStatus {
  if (value && (ALLOWED_STATUSES as readonly string[]).includes(value)) {
    return value as ApplicationStatus
  }
  return 'submitted'
}

function normalizeStatusFilter(value: string | undefined): ApplicationStatus | 'all' {
  if (value && (ALLOWED_STATUSES as readonly string[]).includes(value)) {
    return value as ApplicationStatus
  }
  return 'all'
}

function parseReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
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

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function encodeParams(input: {
  q: string
  status: ApplicationStatus | 'all'
  updated?: string
  summarySent?: string
  claimSent?: string
  claimResent?: string
  contactSaved?: string
  error?: string
}) {
  const params = new URLSearchParams()
  if (input.q.trim()) params.set('q', input.q.trim())
  if (input.status !== 'all') params.set('status', input.status)
  if (input.updated) params.set('updated', input.updated)
  if (input.summarySent) params.set('summarySent', input.summarySent)
  if (input.claimSent) params.set('claimSent', input.claimSent)
  if (input.claimResent) params.set('claimResent', input.claimResent)
  if (input.contactSaved) params.set('contactSaved', input.contactSaved)
  if (input.error) params.set('error', input.error)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function nameFromAuthMetadata(input: { firstName?: string; lastName?: string; email?: string; fallbackId: string }) {
  const first = input.firstName?.trim() ?? ''
  const last = input.lastName?.trim() ?? ''
  const joined = `${first} ${last}`.trim()
  if (joined) return joined
  const emailName = input.email?.split('@')[0]?.trim()
  if (emailName) return emailName
  return `Applicant ${input.fallbackId.slice(0, 8)}`
}

export default async function AdminInternshipApplicantsPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: SearchParams
}) {
  const { user } = await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships/[id]/applicants' })
  const { id: internshipId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Admin applicants</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const q = (resolvedSearchParams?.q ?? '').trim().toLowerCase()
  const statusFilter = normalizeStatusFilter(resolvedSearchParams?.status)

  const admin = supabaseAdmin()

  const [{ data: internship }, { data: applicationsData }] = await Promise.all([
    admin.from('internships').select('id, title, employer_id, company_name').eq('id', internshipId).maybeSingle(),
    admin
      .from('applications')
      .select('id, internship_id, student_id, created_at, match_score, match_reasons, resume_url, status')
      .eq('internship_id', internshipId)
      .order('match_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])

  if (!internship?.id) {
    redirect('/admin/internships?error=Internship+not+found')
  }

  const { data: employerProfile } = await admin
    .from('employer_profiles')
    .select('user_id, company_name, contact_email')
    .eq('user_id', internship.employer_id)
    .maybeSingle()

  const { data: claimTokensData } = await admin
    .from('employer_claim_tokens')
    .select('employer_id, created_at, expires_at, used_at')
    .eq('employer_id', internship.employer_id)
    .order('created_at', { ascending: false })

  const claimStatus = buildEmployerClaimStatus((claimTokensData ?? []) as EmployerClaimTokenRow[])

  const applications = (applicationsData ?? []) as ApplicationRow[]
  const studentIds = Array.from(new Set(applications.map((row) => row.student_id))).filter(Boolean)

  const { data: profileRows } =
    studentIds.length > 0
      ? await admin
          .from('student_profiles')
          .select('user_id, school, major:canonical_majors(name), majors, year')
          .in('user_id', studentIds)
      : { data: [] as StudentProfileRow[] }

  const profileByStudentId = new Map<string, StudentProfileRow>()
  for (const row of (profileRows ?? []) as StudentProfileRow[]) {
    profileByStudentId.set(row.user_id, row)
  }

  const authUsersEntries = await Promise.all(
    studentIds.map(async (studentId) => {
      const { data } = await admin.auth.admin.getUserById(studentId)
      return [studentId, data.user] as const
    })
  )
  const authUserByStudentId = new Map(authUsersEntries)

  const uniqueResumePaths = Array.from(new Set(applications.map((row) => row.resume_url).filter(Boolean))) as string[]
  const signedResumeEntries = await Promise.all(
    uniqueResumePaths.map(async (path) => {
      const { data } = await admin.storage.from('resumes').createSignedUrl(path, 60 * 60)
      return [path, data?.signedUrl ?? null] as const
    })
  )
  const signedResumeUrlByPath = new Map(signedResumeEntries)

  const applicantRows = applications.map((application) => {
    const profile = profileByStudentId.get(application.student_id)
    const authUser = authUserByStudentId.get(application.student_id)
    const metadata = (authUser?.user_metadata ?? {}) as { first_name?: string; last_name?: string }

    const status = normalizeStatus(application.status)
    const name = nameFromAuthMetadata({
      firstName: metadata.first_name,
      lastName: metadata.last_name,
      email: authUser?.email,
      fallbackId: application.student_id,
    })
    const school = profile?.school?.trim() || 'School not set'
    const major = formatMajor(profile?.majors, canonicalMajorName(profile?.major))
    const gradYear = profile?.year?.trim() || 'Grad year not set'
    const topReasons = parseReasons(application.match_reasons).slice(0, 3)
    const resumeUrl = application.resume_url ? signedResumeUrlByPath.get(application.resume_url) ?? null : null

    return {
      applicationId: application.id,
      studentId: application.student_id,
      name,
      school,
      major,
      gradYear,
      matchScore: application.match_score,
      topReasons,
      resumeUrl,
      status,
      createdAt: application.created_at,
    }
  })

  const filteredRows = applicantRows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    if (!q) return true

    const reasonText = row.topReasons.join(' ').toLowerCase()
    const haystack = [row.name, row.school, row.major, row.gradYear, reasonText].join(' ').toLowerCase()
    return haystack.includes(q)
  })

  async function updateStatusAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships/[id]/applicants' })

    const applicationId = String(formData.get('application_id') ?? '').trim()
    const nextStatusRaw = String(formData.get('status') ?? '').trim()
    const qValue = String(formData.get('q') ?? '').trim()
    const statusValue = normalizeStatusFilter(String(formData.get('status_filter') ?? ''))

    if (!applicationId) {
      redirect(`/admin/internships/${internshipId}/applicants${encodeParams({ q: qValue, status: statusValue, error: 'Missing application id' })}`)
    }

    const nextStatus = normalizeStatus(nextStatusRaw)
    const adminWrite = supabaseAdmin()

    const { error } = await adminWrite
      .from('applications')
      .update({ status: nextStatus, reviewed_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('internship_id', internshipId)

    if (error) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: error.message,
        })}`
      )
    }

    redirect(
      `/admin/internships/${internshipId}/applicants${encodeParams({
        q: qValue,
        status: statusValue,
        updated: '1',
      })}`
    )
  }

  async function sendEmployerSummaryAction(formData: FormData) {
    'use server'

    const { user: adminUser } = await requireAnyRole(ADMIN_ROLES, {
      requestedPath: '/admin/internships/[id]/applicants',
    })

    const qValue = String(formData.get('q') ?? '').trim()
    const statusValue = normalizeStatusFilter(String(formData.get('status_filter') ?? ''))
    const adminWrite = supabaseAdmin()

    const [{ data: internshipRow }, { data: fullApplicationsData }] = await Promise.all([
      adminWrite
        .from('internships')
        .select('id, title, employer_id')
        .eq('id', internshipId)
        .maybeSingle(),
      adminWrite
        .from('applications')
        .select('id, student_id, match_score, match_reasons, resume_url, created_at')
        .eq('internship_id', internshipId)
        .order('match_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    ])

    if (!internshipRow?.id || !internshipRow.employer_id) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({ q: qValue, status: statusValue, error: 'Internship not found' })}`
      )
    }

    const { data: employerRow } = await adminWrite
      .from('employer_profiles')
      .select('user_id, contact_email, company_name')
      .eq('user_id', internshipRow.employer_id)
      .maybeSingle()

    const recipient = employerRow?.contact_email?.trim() ?? ''
    if (!recipient) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: 'Employer contact_email is required before sending summary',
        })}`
      )
    }

    const fullApplications = (fullApplicationsData ?? []) as Array<{
      id: string
      student_id: string
      match_score: number | null
      match_reasons: unknown
      resume_url: string | null
      created_at: string | null
    }>

    const topThree = fullApplications.slice(0, 3)
    const topStudentIds = Array.from(new Set(topThree.map((row) => row.student_id))).filter(Boolean)

    const [{ data: topProfiles }, topAuthUsers, topResumeSigned] = await Promise.all([
      topStudentIds.length > 0
        ? adminWrite
            .from('student_profiles')
            .select('user_id, school, major:canonical_majors(name), majors, year')
            .in('user_id', topStudentIds)
        : Promise.resolve({ data: [] as StudentProfileRow[] }),
      Promise.all(
        topStudentIds.map(async (studentId) => {
          const { data } = await adminWrite.auth.admin.getUserById(studentId)
          return [studentId, data.user] as const
        })
      ),
      Promise.all(
        Array.from(new Set(topThree.map((row) => row.resume_url).filter(Boolean))).map(async (path) => {
          const { data } = await adminWrite.storage.from('resumes').createSignedUrl(path as string, 60 * 60 * 24 * 7)
          return [path as string, data?.signedUrl ?? null] as const
        })
      ),
    ])

    const topProfileByStudentId = new Map<string, StudentProfileRow>()
    for (const profile of (topProfiles ?? []) as StudentProfileRow[]) {
      topProfileByStudentId.set(profile.user_id, profile)
    }

    const topAuthUserByStudentId = new Map(topAuthUsers)
    const topSignedResumeByPath = new Map(topResumeSigned)

    const topCandidates: EmployerSummaryCandidate[] = topThree.map((candidate) => {
      const profile = topProfileByStudentId.get(candidate.student_id)
      const authUser = topAuthUserByStudentId.get(candidate.student_id)
      const metadata = (authUser?.user_metadata ?? {}) as { first_name?: string; last_name?: string }

      return {
        name: nameFromAuthMetadata({
          firstName: metadata.first_name,
          lastName: metadata.last_name,
          email: authUser?.email,
          fallbackId: candidate.student_id,
        }),
        school: profile?.school?.trim() || 'School not set',
        major: formatMajor(profile?.majors, canonicalMajorName(profile?.major)),
        gradYear: profile?.year?.trim() || 'Grad year not set',
        matchScore: candidate.match_score,
        topReasons: parseReasons(candidate.match_reasons).slice(0, 3),
        resumeUrl: candidate.resume_url ? topSignedResumeByPath.get(candidate.resume_url) ?? null : null,
      }
    })

    let claimInboxUrl = ''
    try {
      claimInboxUrl = `${getAppUrl()}/login?next=${encodeURIComponent('/inbox')}&intent=claim_inbox`
    } catch {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: 'NEXT_PUBLIC_APP_URL is required to send summary emails',
        })}`
      )
    }

    const sendResult = await sendEmployerSummaryEmail({
      to: recipient,
      internshipTitle: internshipRow.title?.trim() || 'your internship',
      applicantCount: fullApplications.length,
      topCandidates,
      claimInboxUrl,
    })

    if (!sendResult.sent) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: 'Email provider not configured',
        })}`
      )
    }

    const { error: logError } = await adminWrite.from('admin_actions').insert({
      internship_id: internshipId,
      employer_id: internshipRow.employer_id,
      sent_to: recipient,
      sent_by: adminUser.id,
      action_type: 'send_employer_summary',
      metadata: {
        applicant_count: fullApplications.length,
        top_candidate_ids: topThree.map((row) => row.student_id),
      },
    })

    if (logError) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: logError.message,
        })}`
      )
    }

    redirect(
      `/admin/internships/${internshipId}/applicants${encodeParams({
        q: qValue,
        status: statusValue,
        summarySent: '1',
      })}`
    )
  }

  async function sendClaimLinkAction(formData: FormData) {
    'use server'

    const { user: adminUser } = await requireAnyRole(ADMIN_ROLES, {
      requestedPath: '/admin/internships/[id]/applicants',
    })

    const mode = String(formData.get('mode') ?? 'send').trim()
    const invalidateExisting = String(formData.get('invalidate_existing') ?? '') === 'on'
    const qValue = String(formData.get('q') ?? '').trim()
    const statusValue = normalizeStatusFilter(String(formData.get('status_filter') ?? ''))
    const adminWrite = supabaseAdmin()

    const [{ data: internshipRow }, { data: employerRow }] = await Promise.all([
      adminWrite.from('internships').select('id, title, employer_id').eq('id', internshipId).maybeSingle(),
      adminWrite
        .from('employer_profiles')
        .select('user_id, company_name, contact_email')
        .eq('user_id', internship.employer_id)
        .maybeSingle(),
    ])

    if (!internshipRow?.id || !internshipRow.employer_id) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: 'Internship not found',
        })}`
      )
    }

    const recipient = employerRow?.contact_email?.trim() ?? ''
    if (!recipient) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: 'Employer contact_email is required before sending claim link',
        })}`
      )
    }

    const result = await sendEmployerClaimLink({
      admin: adminWrite,
      adminUserId: adminUser.id,
      employerId: internshipRow.employer_id,
      contactEmail: recipient,
      companyName: employerRow?.company_name ?? null,
      internshipId,
      invalidateExisting: mode === 'resend' ? invalidateExisting : false,
      actionType: mode === 'resend' ? 'send_claim_link_resend' : 'send_claim_link',
    })

    if (!result.ok) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: result.error,
        })}`
      )
    }

    redirect(
      `/admin/internships/${internshipId}/applicants${encodeParams({
        q: qValue,
        status: statusValue,
        ...(mode === 'resend' ? { claimResent: '1' } : { claimSent: '1' }),
      })}`
    )
  }

  async function updateEmployerContactAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships/[id]/applicants' })
    const qValue = String(formData.get('q') ?? '').trim()
    const statusValue = normalizeStatusFilter(String(formData.get('status_filter') ?? ''))
    const contactEmail = String(formData.get('contact_email') ?? '').trim().toLowerCase()
    const adminWrite = supabaseAdmin()

    const { error } = await adminWrite
      .from('employer_profiles')
      .update({ contact_email: contactEmail || null })
      .eq('user_id', internship.employer_id)

    if (error) {
      redirect(
        `/admin/internships/${internshipId}/applicants${encodeParams({
          q: qValue,
          status: statusValue,
          error: error.message,
        })}`
      )
    }

    redirect(
      `/admin/internships/${internshipId}/applicants${encodeParams({
        q: qValue,
        status: statusValue,
        contactSaved: '1',
      })}`
    )
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/admin/internships"
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{internship.title || 'Internship'} applicants</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ranked candidates for employer handoff. {applications.length} total applicant(s).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form action={sendClaimLinkAction} className="inline-flex items-center gap-2">
              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
              <input type="hidden" name="status_filter" value={statusFilter} />
              <input type="hidden" name="mode" value="send" />
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Send claim link
              </button>
            </form>
            <form action={sendClaimLinkAction} className="inline-flex items-center gap-2">
              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
              <input type="hidden" name="status_filter" value={statusFilter} />
              <input type="hidden" name="mode" value="resend" />
              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" name="invalidate_existing" />
                Invalidate pending
              </label>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Resend claim link
              </button>
            </form>
            <form action={sendEmployerSummaryAction}>
              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
              <input type="hidden" name="status_filter" value={statusFilter} />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send Employer Summary
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <form action={updateEmployerContactAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
            <input type="hidden" name="status_filter" value={statusFilter} />
            <div>
              <label className="text-xs font-medium text-slate-700">Employer contact email</label>
              <input
                name="contact_email"
                defaultValue={employerProfile?.contact_email ?? ''}
                placeholder="name@company.com"
                className="mt-1 w-full min-w-[280px] rounded-md border border-slate-300 bg-white p-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save contact
            </button>
          </form>
          <div className="mt-2 text-xs text-slate-600">
            Claim status: pending {claimStatus.pendingCount} · last sent {formatDate(claimStatus.lastSentAt)} · last
            claimed {formatDate(claimStatus.lastClaimedAt)}
          </div>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.error}
          </div>
        ) : null}
        {resolvedSearchParams?.updated ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Application status updated.
          </div>
        ) : null}
        {resolvedSearchParams?.summarySent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Employer summary sent and logged.
          </div>
        ) : null}
        {resolvedSearchParams?.claimSent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Claim link sent and logged.
          </div>
        ) : null}
        {resolvedSearchParams?.claimResent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Claim link resent and logged.
          </div>
        ) : null}
        {resolvedSearchParams?.contactSaved ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Employer contact email saved.
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-sm">
              <label className="text-xs font-medium text-slate-700">Search</label>
              <input
                name="q"
                defaultValue={resolvedSearchParams?.q ?? ''}
                placeholder="Name, school, major, year, reason"
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Status</label>
              <select
                name="status"
                defaultValue={statusFilter}
                className="mt-1 rounded-md border border-slate-300 p-2 text-sm"
              >
                <option value="all">all</option>
                {ALLOWED_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Filter
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Major</th>
                  <th className="px-3 py-2">Grad year</th>
                  <th className="px-3 py-2">Match score</th>
                  <th className="px-3 py-2">Top reasons</th>
                  <th className="px-3 py-2">Resume</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                      No applicants found for current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.applicationId}>
                      <td className="px-3 py-3 text-slate-900">{row.name}</td>
                      <td className="px-3 py-3 text-slate-700">{row.school}</td>
                      <td className="px-3 py-3 text-slate-700">{row.major}</td>
                      <td className="px-3 py-3 text-slate-700">{row.gradYear}</td>
                      <td className="px-3 py-3 text-slate-700">{typeof row.matchScore === 'number' ? row.matchScore : '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {row.topReasons.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {row.topReasons.map((reason) => (
                              <li key={`${row.applicationId}-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {row.resumeUrl ? (
                          <a href={row.resumeUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 hover:underline">
                            View resume
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">No resume</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-slate-300 px-2 py-1 text-xs">{row.status}</span>
                      </td>
                      <td className="px-3 py-3">
                        <form action={updateStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="application_id" value={row.applicationId} />
                          <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
                          <input type="hidden" name="status_filter" value={statusFilter} />
                          <select
                            name="status"
                            defaultValue={row.status}
                            className="rounded-md border border-slate-300 bg-white p-1.5 text-xs"
                          >
                            {ALLOWED_STATUSES.map((status) => (
                              <option key={`${row.applicationId}-${status}`} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Save
                          </button>
                        </form>
                        <div className="mt-1 text-[11px] text-slate-500">Applied {formatDate(row.createdAt)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
