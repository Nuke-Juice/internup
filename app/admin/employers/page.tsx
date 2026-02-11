import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { deleteUserAccountById } from '@/lib/auth/accountDeletion'
import {
  buildEmployerClaimStatus,
  sendEmployerClaimLink,
  type EmployerClaimTokenRow,
} from '@/lib/auth/employerClaimAdmin'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{
  q?: string
  edit?: string
  sent?: string
  resent?: string
  contactSaved?: string
  deleted?: string
  error?: string
}>

type EmployerRow = {
  user_id: string
  company_name: string | null
  contact_email: string | null
}

type InternshipRow = {
  id: string
  employer_id: string
  created_at: string | null
}

function encodeParams(input: {
  q: string
  edit?: string
  sent?: string
  resent?: string
  contactSaved?: string
  error?: string
}) {
  const params = new URLSearchParams()
  if (input.q.trim()) params.set('q', input.q.trim())
  if (input.edit?.trim()) params.set('edit', input.edit.trim())
  if (input.sent) params.set('sent', input.sent)
  if (input.resent) params.set('resent', input.resent)
  if (input.contactSaved) params.set('contactSaved', input.contactSaved)
  if (input.error) params.set('error', input.error)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default async function AdminEmployersPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/employers' })
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Admin employers</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const q = (resolvedSearchParams?.q ?? '').trim().toLowerCase()
  const admin = supabaseAdmin()

  const [{ data: employersData }, { data: tokensData }, { data: internshipsData }] = await Promise.all([
    admin.from('employer_profiles').select('user_id, company_name, contact_email').order('company_name', { ascending: true }),
    admin
      .from('employer_claim_tokens')
      .select('employer_id, created_at, expires_at, used_at')
      .order('created_at', { ascending: false }),
    admin.from('internships').select('id, employer_id, created_at').order('created_at', { ascending: false }),
  ])

  const employers = (employersData ?? []) as EmployerRow[]
  const tokens = (tokensData ?? []) as EmployerClaimTokenRow[]
  const internships = (internshipsData ?? []) as InternshipRow[]

  const tokensByEmployer = new Map<string, EmployerClaimTokenRow[]>()
  for (const token of tokens) {
    const list = tokensByEmployer.get(token.employer_id) ?? []
    list.push(token)
    tokensByEmployer.set(token.employer_id, list)
  }

  const latestInternshipByEmployer = new Map<string, InternshipRow>()
  for (const internship of internships) {
    if (!latestInternshipByEmployer.has(internship.employer_id)) {
      latestInternshipByEmployer.set(internship.employer_id, internship)
    }
  }

  const filteredEmployers = employers.filter((employer) => {
    if (!q) return true
    const haystack = [employer.company_name ?? '', employer.contact_email ?? '', employer.user_id]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
  const editingEmployerId = (resolvedSearchParams?.edit ?? '').trim()

  async function updateContactEmailAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/employers' })
    const employerId = String(formData.get('employer_id') ?? '').trim()
    const contactEmail = String(formData.get('contact_email') ?? '').trim().toLowerCase()
    const confirmed = String(formData.get('confirm_contact_change') ?? '') === 'on'
    const qValue = String(formData.get('q') ?? '').trim()

    if (!employerId) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: 'Missing employer context' })}`)
    }
    if (!confirmed) {
      redirect(
        `/admin/employers${encodeParams({
          q: qValue,
          edit: employerId,
          error: 'Confirm the email change before saving.',
        })}`
      )
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      redirect(
        `/admin/employers${encodeParams({
          q: qValue,
          edit: employerId,
          error: 'Enter a valid email address.',
        })}`
      )
    }

    const adminWrite = supabaseAdmin()
    const { error } = await adminWrite
      .from('employer_profiles')
      .update({ contact_email: contactEmail || null })
      .eq('user_id', employerId)

    if (error) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: error.message })}`)
    }

    redirect(`/admin/employers${encodeParams({ q: qValue, contactSaved: '1' })}`)
  }

  async function sendClaimLinkAction(formData: FormData) {
    'use server'

    const { user } = await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/employers' })
    const employerId = String(formData.get('employer_id') ?? '').trim()
    const mode = String(formData.get('mode') ?? 'send').trim()
    const invalidateExisting = String(formData.get('invalidate_existing') ?? '') === 'on'
    const qValue = String(formData.get('q') ?? '').trim()

    if (!employerId) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: 'Missing employer context' })}`)
    }

    const adminWrite = supabaseAdmin()

    const [{ data: employer }, { data: latestInternship }] = await Promise.all([
      adminWrite
        .from('employer_profiles')
        .select('user_id, company_name, contact_email')
        .eq('user_id', employerId)
        .maybeSingle(),
      adminWrite
        .from('internships')
        .select('id')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (!employer?.user_id) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: 'Employer profile not found' })}`)
    }

    const result = await sendEmployerClaimLink({
      admin: adminWrite,
      adminUserId: user.id,
      employerId,
      contactEmail: employer.contact_email ?? '',
      companyName: employer.company_name,
      internshipId: latestInternship?.id ?? null,
      invalidateExisting: mode === 'resend' ? invalidateExisting : false,
      actionType: mode === 'resend' ? 'send_claim_link_resend' : 'send_claim_link',
    })

    if (!result.ok) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: result.error })}`)
    }

    redirect(
      `/admin/employers${encodeParams({
        q: qValue,
        ...(mode === 'resend' ? { resent: '1' } : { sent: '1' }),
      })}`
    )
  }

  async function deleteEmployerAccountAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/employers' })
    const employerId = String(formData.get('employer_id') ?? '').trim()
    const qValue = String(formData.get('q') ?? '').trim()

    if (!employerId) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: 'Missing employer context' })}`)
    }

    const adminWrite = supabaseAdmin()
    const result = await deleteUserAccountById(adminWrite, employerId)
    if (!result.ok) {
      redirect(`/admin/employers${encodeParams({ q: qValue, error: result.error })}`)
    }

    const next = encodeParams({ q: qValue })
    const joiner = next ? '&' : '?'
    redirect(`/admin/employers${next}${joiner}deleted=1`)
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin/internships"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Admin employers</h1>
            <p className="mt-1 text-sm text-slate-600">Manage claim-link contacts and employer access links.</p>
          </div>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resolvedSearchParams.error}</div>
        ) : null}
        {resolvedSearchParams?.contactSaved ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Claim-link contact email saved.</div>
        ) : null}
        {resolvedSearchParams?.deleted ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Employer account deleted.</div>
        ) : null}
        {resolvedSearchParams?.sent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Claim link sent and logged.</div>
        ) : null}
        {resolvedSearchParams?.resent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Claim link resent and logged.</div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form method="get" className="flex w-full max-w-lg items-end gap-2">
            <div className="w-full">
              <label className="text-xs font-medium text-slate-700">Search</label>
              <input
                name="q"
                defaultValue={resolvedSearchParams?.q ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                placeholder="Search company or contact email"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Search
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Contact email</th>
                  <th className="px-3 py-2">Claim status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      No employers found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployers.map((employer) => {
                    const claimStatus = buildEmployerClaimStatus(tokensByEmployer.get(employer.user_id) ?? [])
                    const latestInternship = latestInternshipByEmployer.get(employer.user_id)

                    return (
                      <tr key={employer.user_id}>
                        <td className="px-3 py-3 text-slate-900">
                          <div className="font-medium">{employer.company_name?.trim() || 'Unnamed company'}</div>
                          <div className="text-xs text-slate-500">{employer.user_id}</div>
                        </td>
                        <td className="px-3 py-3">
                          {editingEmployerId === employer.user_id ? (
                            <form action={updateContactEmailAction} className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                              <input type="hidden" name="employer_id" value={employer.user_id} />
                              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
                              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Claim link email</label>
                              <input
                                name="contact_email"
                                defaultValue={employer.contact_email ?? ''}
                                placeholder="name@company.com"
                                className="w-72 rounded-md border border-slate-300 bg-white p-2 text-sm"
                              />
                              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                                <input type="checkbox" name="confirm_contact_change" />
                                Confirm email change
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Save email
                                </button>
                                <Link
                                  href={`/admin/employers${encodeParams({ q: resolvedSearchParams?.q ?? '' })}`}
                                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Cancel
                                </Link>
                              </div>
                            </form>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800">
                                {employer.contact_email?.trim() || 'No contact email set'}
                              </div>
                              <Link
                                href={`/admin/employers${encodeParams({ q: resolvedSearchParams?.q ?? '', edit: employer.user_id })}`}
                                className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Change email
                              </Link>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          <div>Pending tokens: {claimStatus.pendingCount}</div>
                          <div>Last sent: {formatDate(claimStatus.lastSentAt)}</div>
                          <div>Last claimed: {formatDate(claimStatus.lastClaimedAt)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <form action={sendClaimLinkAction}>
                              <input type="hidden" name="employer_id" value={employer.user_id} />
                              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
                              <input type="hidden" name="mode" value="send" />
                              <button
                                type="submit"
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Send claim link
                              </button>
                            </form>
                            <form action={sendClaimLinkAction} className="inline-flex items-center gap-2">
                              <input type="hidden" name="employer_id" value={employer.user_id} />
                              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
                              <input type="hidden" name="mode" value="resend" />
                              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                                <input type="checkbox" name="invalidate_existing" />
                                Invalidate pending
                              </label>
                              <button
                                type="submit"
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Resend claim link
                              </button>
                            </form>
                            {latestInternship?.id ? (
                              <Link
                                href={`/admin/internships/${latestInternship.id}/applicants`}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                View applicants
                              </Link>
                            ) : null}
                            <form action={deleteEmployerAccountAction}>
                              <input type="hidden" name="employer_id" value={employer.user_id} />
                              <input type="hidden" name="q" value={resolvedSearchParams?.q ?? ''} />
                              <button
                                type="submit"
                                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                              >
                                Delete account
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
