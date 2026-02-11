import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type AppRole = 'student' | 'employer' | 'ops_admin' | 'super_admin' | 'support' | null

type NotificationItem = {
  id: string
  title: string
  description: string
  timestamp: string | null
  href: string
  tone?: 'default' | 'success' | 'warning'
}

type StudentApplicationNotificationRow = {
  id: string
  internship_id: string
  status: string | null
  created_at: string | null
  reviewed_at: string | null
  internship?: { title?: string | null; company_name?: string | null } | Array<{ title?: string | null; company_name?: string | null }> | null
}

type EmployerInternshipRow = {
  id: string
  title: string | null
  application_deadline: string | null
}

type EmployerApplicationNotificationRow = {
  id: string
  internship_id: string
  created_at: string | null
  status: string | null
}

type AdminInternshipNotificationRow = {
  id: string
  title: string | null
  created_at: string | null
  is_active: boolean | null
}

function roleLabel(role: AppRole) {
  if (role === 'employer') {
    return {
      title: 'Notifications',
      subtitle: 'Hiring updates, new applicants, and operational reminders for your team.',
    }
  }
  if (role === 'student') {
    return {
      title: 'Notifications',
      subtitle: 'Application status changes, interviews, and progress updates appear here.',
    }
  }
  if (role === 'ops_admin' || role === 'super_admin') {
    return {
      title: 'Notifications',
      subtitle: 'Platform-level moderation and quality-signal updates for operations.',
    }
  }

  return {
    title: 'Notifications',
    subtitle: 'Sign in to see personalized account and activity notifications.',
  }
}

function parseInternshipRef(value: StudentApplicationNotificationRow['internship']) {
  if (!value) return { title: 'Internship', company: 'Company' }
  const first = Array.isArray(value) ? value[0] : value
  return {
    title: typeof first?.title === 'string' && first.title.trim() ? first.title : 'Internship',
    company: typeof first?.company_name === 'string' && first.company_name.trim() ? first.company_name : 'Company',
  }
}

function toneClass(tone: NotificationItem['tone']) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-white text-slate-900'
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Date n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date n/a'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function asApplicationStatus(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'accepted' || normalized === 'interview' || normalized === 'reviewing' || normalized === 'rejected') {
    return normalized
  }
  return 'submitted'
}

export default async function NotificationsPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: AppRole = null
  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    role = typeof userRow?.role === 'string' ? (userRow.role as AppRole) : null
  }

  const copy = roleLabel(role)

  if (!user || !role) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">No notifications yet.</h2>
            <p className="mt-1 text-sm text-slate-600">Sign in to load your notifications feed.</p>
            <div className="mt-4">
              <Link href="/login?next=%2Fnotifications" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  let items: NotificationItem[] = []

  if (role === 'student') {
    const { data } = await supabase
      .from('applications')
      .select('id, internship_id, status, created_at, reviewed_at, internship:internships(title, company_name)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12)

    const rows = (data ?? []) as StudentApplicationNotificationRow[]
    items = rows.map((row) => {
      const internship = parseInternshipRef(row.internship)
      const status = asApplicationStatus(row.status)
      const tone: NotificationItem['tone'] = status === 'accepted' ? 'success' : status === 'rejected' ? 'warning' : 'default'
      const eventTime = row.reviewed_at ?? row.created_at
      return {
        id: row.id,
        title: `${internship.title} · ${internship.company}`,
        description:
          status === 'submitted'
            ? 'Application submitted successfully.'
            : `Application moved to ${status}.`,
        timestamp: eventTime,
        href: '/applications',
        tone,
      }
    })
  } else if (role === 'employer') {
    const { data: internshipsData } = await supabase
      .from('internships')
      .select('id, title, application_deadline')
      .eq('employer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    const internships = (internshipsData ?? []) as EmployerInternshipRow[]
    const internshipIds = internships.map((row) => row.id)
    const internshipById = new Map(internships.map((row) => [row.id, row]))

    const { data: applicationRowsData } =
      internshipIds.length > 0
        ? await supabase
            .from('applications')
            .select('id, internship_id, created_at, status')
            .in('internship_id', internshipIds)
            .order('created_at', { ascending: false })
            .limit(12)
        : { data: [] as EmployerApplicationNotificationRow[] }

    const applicationRows = (applicationRowsData ?? []) as EmployerApplicationNotificationRow[]
    const applicationItems: NotificationItem[] = applicationRows.map((row) => {
      const internship = internshipById.get(row.internship_id)
      return {
        id: `app-${row.id}`,
        title: `New applicant · ${internship?.title ?? 'Internship'}`,
        description: `Candidate submitted (${asApplicationStatus(row.status)}).`,
        timestamp: row.created_at,
        href: `/dashboard/employer/applicants?internship_id=${encodeURIComponent(row.internship_id)}`,
      }
    })

    const deadlineItems: NotificationItem[] = internships
      .filter((row) => row.application_deadline)
      .map((row) => {
        const deadline = row.application_deadline as string
        const msLeft = new Date(deadline).getTime() - Date.now()
        return { row, msLeft }
      })
      .filter((item) => item.msLeft >= 0 && item.msLeft <= 14 * 24 * 60 * 60 * 1000)
      .slice(0, 6)
      .map(({ row }) => ({
        id: `deadline-${row.id}`,
        title: `Deadline approaching · ${row.title ?? 'Internship'}`,
        description: `Application deadline is ${formatDateTime(row.application_deadline)}.`,
        timestamp: row.application_deadline,
        href: '/dashboard/employer',
        tone: 'warning' as const,
      }))

    items = [...applicationItems, ...deadlineItems]
      .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
      .slice(0, 16)
  } else if ((role === 'ops_admin' || role === 'super_admin') && hasSupabaseAdminCredentials()) {
    const admin = supabaseAdmin()
    const [{ data: internshipRows }, { count: unverifiedEmployerCount }] = await Promise.all([
      admin
        .from('internships')
        .select('id, title, created_at, is_active')
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'employer')
        .eq('verified', false),
    ])

    const rows = (internshipRows ?? []) as AdminInternshipNotificationRow[]
    const moderationItems = rows.map((row) => ({
      id: `internship-${row.id}`,
      title: `${row.is_active ? 'Published' : 'Draft/inactive'} internship · ${row.title ?? 'Untitled'}`,
      description: 'Review metadata coverage and matching signal completeness.',
      timestamp: row.created_at,
      href: `/admin/internships/${row.id}`,
      tone: (row.is_active ? 'default' : 'warning') as NotificationItem['tone'],
    }))

    const employerVerificationItem: NotificationItem = {
      id: 'admin-employer-unverified',
      title: 'Employer verification queue',
      description: `${unverifiedEmployerCount ?? 0} employer account(s) currently unverified.`,
      timestamp: new Date().toISOString(),
      href: '/admin/employers',
      tone: (unverifiedEmployerCount ?? 0) > 0 ? 'warning' : 'default',
    }

    items = [employerVerificationItem, ...moderationItems]
  }

  const sortedItems = [...items].sort(
    (a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()
  )

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Recent updates</h2>
            <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
              {sortedItems.length} item(s)
            </span>
          </div>

          {sortedItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">You are all caught up. New updates will appear here automatically.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sortedItems.map((item) => (
                <article key={item.id} className={`rounded-lg border px-3 py-3 ${toneClass(item.tone)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-0.5 text-xs opacity-90">{item.description}</p>
                    </div>
                    <div className="text-[11px] opacity-80">{formatDateTime(item.timestamp)}</div>
                  </div>
                  <div className="mt-2">
                    <Link href={item.href} className="text-xs font-medium text-blue-700 hover:underline">
                      Open
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
