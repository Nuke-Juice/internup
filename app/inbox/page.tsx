import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type AppRole = 'student' | 'employer' | 'ops_admin' | 'super_admin' | 'support' | null

type StudentApplicationRow = {
  id: string
  internship_id: string
  created_at: string | null
  reviewed_at: string | null
  status: string | null
  internship?: { title?: string | null; company_name?: string | null } | Array<{ title?: string | null; company_name?: string | null }> | null
}

type EmployerInternshipRow = {
  id: string
  title: string | null
}

type EmployerApplicationRow = {
  id: string
  internship_id: string
  created_at: string | null
  status: string | null
  match_score: number | null
  student_id: string | null
}

type AdminInternshipRow = {
  id: string
  title: string | null
  is_active: boolean | null
  created_at: string | null
}

function roleCopy(role: AppRole) {
  if (role === 'student') {
    return {
      title: 'Inbox',
      subtitle: 'Track your application conversations and status updates in one place.',
    }
  }
  if (role === 'employer') {
    return {
      title: 'Inbox',
      subtitle: 'Review applicants, prioritize best-fit candidates, and keep hiring momentum.',
    }
  }
  if (role === 'ops_admin' || role === 'super_admin') {
    return {
      title: 'Inbox',
      subtitle: 'Operational queue for internships, students, and quality coverage follow-ups.',
    }
  }

  return {
    title: 'Inbox',
    subtitle: 'Sign in to see role-specific conversations and operational updates.',
  }
}

function parseInternshipRef(value: StudentApplicationRow['internship']) {
  if (!value) return { title: 'Internship', company: 'Company' }
  const first = Array.isArray(value) ? value[0] : value
  return {
    title: typeof first?.title === 'string' && first.title.trim() ? first.title : 'Internship',
    company: typeof first?.company_name === 'string' && first.company_name.trim() ? first.company_name : 'Company',
  }
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return 'Date n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date n/a'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusPill(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'accepted') return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  if (normalized === 'interview') return 'border-blue-300 bg-blue-50 text-blue-700'
  if (normalized === 'reviewing') return 'border-amber-300 bg-amber-50 text-amber-700'
  if (normalized === 'rejected') return 'border-red-300 bg-red-50 text-red-700'
  return 'border-slate-300 bg-slate-100 text-slate-700'
}

export default async function InboxPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: AppRole = null
  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    role = typeof userRow?.role === 'string' ? (userRow.role as AppRole) : null
  }

  const copy = roleCopy(role)

  if (!user || !role) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Sign in to view your inbox</h2>
            <p className="mt-1 text-sm text-slate-600">We personalize this page for students, employers, and admins.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/login?next=%2Finbox" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Sign in
              </Link>
              <Link href="/signup/student" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (role === 'student') {
    const { data: applicationsData } = await supabase
      .from('applications')
      .select('id, internship_id, created_at, reviewed_at, status, internship:internships(title, company_name)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12)

    const applications = (applicationsData ?? []) as StudentApplicationRow[]
    const submittedCount = applications.filter((item) => (item.status ?? 'submitted') === 'submitted').length
    const reviewingCount = applications.filter((item) => item.status === 'reviewing').length
    const interviewCount = applications.filter((item) => item.status === 'interview').length
    const acceptedCount = applications.filter((item) => item.status === 'accepted').length

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Submitted', submittedCount],
              ['Reviewing', reviewingCount],
              ['Interview', interviewCount],
              ['Accepted', acceptedCount],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{count}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Recent application threads</h2>
              <Link href="/applications" className="text-sm font-medium text-blue-700 hover:underline">
                View all applications
              </Link>
            </div>

            {applications.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No threads yet. Apply to internships and updates will appear here.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {applications.map((item) => {
                  const internship = parseInternshipRef(item.internship)
                  return (
                    <article key={item.id} className="rounded-lg border border-slate-200 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{internship.title}</div>
                          <div className="text-xs text-slate-600">{internship.company}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusPill(item.status)}`}>
                          {item.status ?? 'submitted'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                        <span>Applied {formatRelativeDate(item.created_at)}</span>
                        <Link href={`/jobs/${item.internship_id}`} className="font-medium text-blue-700 hover:underline">
                          View internship
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    )
  }

  if (role === 'employer') {
    const { data: internshipsData } = await supabase
      .from('internships')
      .select('id, title')
      .eq('employer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const internships = (internshipsData ?? []) as EmployerInternshipRow[]
    const internshipIds = internships.map((item) => item.id)

    const { data: applicationsData } =
      internshipIds.length > 0
        ? await supabase
            .from('applications')
            .select('id, internship_id, created_at, status, match_score, student_id')
            .in('internship_id', internshipIds)
            .order('created_at', { ascending: false })
            .limit(30)
        : { data: [] as EmployerApplicationRow[] }

    const applications = (applicationsData ?? []) as EmployerApplicationRow[]
    const internshipById = new Map(internships.map((item) => [item.id, item]))

    const applicantsByInternship = new Map<string, number>()
    for (const row of applications) {
      applicantsByInternship.set(row.internship_id, (applicantsByInternship.get(row.internship_id) ?? 0) + 1)
    }

    const topInternships = internships
      .map((item) => ({
        internshipId: item.id,
        title: item.title ?? 'Internship',
        applicantCount: applicantsByInternship.get(item.id) ?? 0,
      }))
      .sort((a, b) => b.applicantCount - a.applicantCount)
      .slice(0, 5)

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Active threads</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{applications.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Internships</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{internships.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">New this week</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {
                  applications.filter((item) => {
                    if (!item.created_at) return false
                    return Date.now() - new Date(item.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000
                  }).length
                }
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Where to focus</h2>
              <Link href="/dashboard/employer/applicants" className="text-sm font-medium text-blue-700 hover:underline">
                Open applicant inbox
              </Link>
            </div>

            {topInternships.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Post an internship to start receiving applicants.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {topInternships.map((item) => (
                  <article key={item.internshipId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-600">{item.applicantCount} applicants</div>
                    </div>
                    <Link
                      href={`/dashboard/employer/applicants?internship_id=${encodeURIComponent(item.internshipId)}`}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Review
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    )
  }

  const hasAdminAccess = role === 'ops_admin' || role === 'super_admin'
  let adminInternships: AdminInternshipRow[] = []
  let activeInternships = 0
  let inactiveInternships = 0
  let recentApplications = 0

  if (hasAdminAccess && hasSupabaseAdminCredentials()) {
    const admin = supabaseAdmin()
    const [{ data: internshipRows }, { count: applicationsCount }] = await Promise.all([
      admin
        .from('internships')
        .select('id, title, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(12),
      admin
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    adminInternships = (internshipRows ?? []) as AdminInternshipRow[]
    activeInternships = adminInternships.filter((item) => item.is_active).length
    inactiveInternships = adminInternships.filter((item) => item.is_active === false).length
    recentApplications = applicationsCount ?? 0
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Active internships</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{activeInternships}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Inactive internships</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{inactiveInternships}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Applications (7d)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{recentApplications}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Recent operational activity</h2>
            <Link href="/admin" className="text-sm font-medium text-blue-700 hover:underline">
              Open admin dashboard
            </Link>
          </div>

          {adminInternships.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No recent activity to show yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {adminInternships.map((item) => (
                <article key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{item.title ?? 'Untitled internship'}</div>
                    <div className="text-xs text-slate-600">
                      {item.is_active ? 'Active' : 'Inactive'} · created {formatRelativeDate(item.created_at)}
                    </div>
                  </div>
                  <Link href={`/admin/internships/${item.id}`} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Open
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
