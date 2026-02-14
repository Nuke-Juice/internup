import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { trackAnalyticsEvent } from '@/lib/analytics'

const steps = ['submitted', 'reviewing', 'interview', 'accepted'] as const
type Status = (typeof steps)[number] | 'rejected' | 'viewed'

function ProgressBar({ status }: { status: Status }) {
  if (status === 'rejected') {
    return (
      <div className="h-2 w-full rounded bg-slate-200" title="Rejected">
        <div className="h-2 w-1/3 rounded bg-slate-400" />
      </div>
    )
  }

  const normalizedStatus = status === 'viewed' ? 'reviewing' : status
  const idx = steps.indexOf(normalizedStatus as (typeof steps)[number])
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
    reviewing: 'bg-blue-50 text-blue-700 border-blue-200',
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

function parseReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 2)
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ external_complete?: string; error?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  async function markExternalComplete(formData: FormData) {
    'use server'

    const applicationId = String(formData.get('application_id') ?? '').trim()
    const listingId = String(formData.get('listing_id') ?? '').trim()
    if (!applicationId || !listingId) {
      redirect('/applications?error=Missing+application+context')
    }

    const supabaseAction = await supabaseServer()
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser()
    if (!currentUser) redirect('/login')

    const { error } = await supabaseAction
      .from('applications')
      .update({ external_apply_completed_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('student_id', currentUser.id)
      .eq('internship_id', listingId)

    if (error) {
      redirect(`/applications?error=${encodeURIComponent(error.message)}`)
    }

    await trackAnalyticsEvent({
      eventName: 'external_apply_completed',
      userId: currentUser.id,
      properties: { listing_id: listingId, application_id: applicationId, source: 'applications_page' },
    })

    redirect('/applications?external_complete=1')
  }

  const { user } = await requireRole('student', { requestedPath: '/applications' })
  const supabase = await supabaseServer()

  const { data: applications } = await supabase
    .from('applications')
    .select(
      'id, status, created_at, match_score, match_reasons, external_apply_required, external_apply_completed_at, external_apply_clicks, external_apply_last_clicked_at, internship:internships(id, title, company_name, apply_mode, external_apply_url)'
    )
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const pendingExternal = (applications ?? []).filter((application) => {
    const listing = application.internship as { external_apply_url?: string | null } | null
    return Boolean(application.external_apply_required) && !application.external_apply_completed_at && Boolean(normalizeExternalApplyUrl(listing?.external_apply_url ?? null))
  })

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
            <p className="mt-2 text-slate-600">Track status at a glance.</p>
          </div>
        </div>
        {resolvedSearchParams?.external_complete === '1' ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            External application marked complete.
          </div>
        ) : null}
        {resolvedSearchParams?.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}
        {pendingExternal.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-900">Finish your ATS applications</div>
            <p className="mt-1 text-xs text-amber-800">
              {pendingExternal.length} application{pendingExternal.length === 1 ? '' : 's'} still need completion on employer sites.
            </p>
          </div>
        ) : null}
        {(applications ?? []).length > 0 ? (
          <div>
            {(applications ?? [])
              .filter((application) => {
                const listing = application.internship as { external_apply_url?: string | null } | null
                return Boolean(application.external_apply_required) && !application.external_apply_completed_at && Boolean(normalizeExternalApplyUrl(listing?.external_apply_url ?? null))
              })
              .map((application) => {
                const listing = application.internship as { id?: string | null; title?: string | null; company_name?: string | null; external_apply_url?: string | null } | null
                const listingId = String(listing?.id ?? '')
                const externalHref = `/apply/${encodeURIComponent(listingId)}/external?application=${encodeURIComponent(application.id)}`
                return (
                  <div key={`pending-${application.id}`} className="rounded-xl border border-amber-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">{listing?.title || 'Internship'}</div>
                    <div className="text-xs text-slate-600">{listing?.company_name || 'Company'} • Pending ATS completion</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={externalHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Finish application
                      </a>
                      <form action={markExternalComplete}>
                        <input type="hidden" name="application_id" value={application.id} />
                        <input type="hidden" name="listing_id" value={listingId} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          I finished
                        </button>
                      </form>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : null}

        {!applications || applications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            You have not submitted any applications yet.
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((a) => {
              const listing = a.internship as { title?: string | null; company_name?: string | null } | null
              const status = (a.status ?? 'submitted') as Status
              const topReasons = parseReasons(a.match_reasons)
              const pendingExternalApply = Boolean(a.external_apply_required) && !a.external_apply_completed_at
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
                  {pendingExternalApply ? (
                    <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                      Pending external ATS completion
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <ProgressBar status={status} />
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Submitted {'->'} Viewed {'->'} Interview {'->'} Accepted (or Rejected)
                  </div>

                  <div className="mt-3 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Match score:</span>{' '}
                    {typeof a.match_score === 'number' ? a.match_score : 'N/A'}
                  </div>
                  {topReasons.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                      {topReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
