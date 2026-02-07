import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'

const steps = ['submitted', 'viewed', 'interview', 'accepted'] as const
type Status = (typeof steps)[number] | 'rejected'

function ProgressBar({ status }: { status: Status }) {
  if (status === 'rejected') {
    return (
      <div className="h-2 w-full rounded bg-slate-200" title="Rejected">
        <div className="h-2 w-1/3 rounded bg-slate-400" />
      </div>
    )
  }

  const idx = steps.indexOf(status as any)
  const pct = idx >= 0 ? ((idx + 1) / steps.length) * 100 : 25

  return (
    <div className="h-2 w-full rounded bg-slate-200">
      <div className="h-2 rounded bg-blue-600" style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<string, string> = {
    submitted: 'bg-slate-50 text-slate-700 border-slate-200',
    viewed: 'bg-blue-50 text-blue-700 border-blue-200',
    interview: 'bg-blue-50 text-blue-700 border-blue-200',
    accepted: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function formatDate(value: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

export default async function ApplicationsPage() {
  const { user } = await requireRole('student')
  const supabase = await supabaseServer()

  const { data: applications } = await supabase
    .from('applications')
    .select('id, status, created_at, internship:internships(id, title, company_name)')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/dashboard/student" className="text-sm font-medium text-blue-700 hover:underline">
              â† Back to dashboard
            </a>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Applications</h1>
            <p className="mt-2 text-slate-600">Track status at a glance.</p>
          </div>
        </div>

        {!applications || applications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            You have not submitted any applications yet.
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((a) => {
              const listing = a.internship as { title?: string | null; company_name?: string | null } | null
              const status = (a.status ?? 'submitted') as Status
              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-slate-900">
                        {listing?.title || 'Internship'}
                      </div>
                      <div className="text-sm text-slate-600">
                        {listing?.company_name || 'Company'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={status} />
                      <div className="text-sm text-slate-500">{formatDate(a.created_at)}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ProgressBar status={status} />
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Submitted â†’ Viewed â†’ Interview â†’ Accepted (or Rejected)
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
