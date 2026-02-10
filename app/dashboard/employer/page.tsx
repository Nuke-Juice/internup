import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { startStarterEmployerCheckoutAction } from '@/lib/billing/actions'
import { getRemainingCapacity, isUnlimitedInternships } from '@/lib/billing/plan'
import { isPlanLimitReachedCode, PLAN_LIMIT_REACHED } from '@/lib/billing/plan'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import {
  INTERNSHIP_VALIDATION_ERROR,
  type InternshipValidationErrorCode,
  validateInternshipInput,
} from '@/lib/internshipValidation'
import { deriveTermFromRange, getEndYearOptions, getMonthOptions, getStartYearOptions } from '@/lib/internships/term'
import { isVerifiedCityForState, normalizeStateCode } from '@/lib/locations/usLocationCatalog'
import { supabaseServer } from '@/lib/supabase/server'
import { guardEmployerInternshipPublish } from '@/lib/auth/verifiedActionGate'
import InternshipLocationFields from '@/components/forms/InternshipLocationFields'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import { verifyTurnstileToken } from '@/lib/security/turnstile'

function normalizeList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ')
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatMajors(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return value ? String(value) : ''
}

function getCreateInternshipError(searchParams?: { code?: string; error?: string; limit?: string; current?: string }) {
  const code = searchParams?.code as InternshipValidationErrorCode | string | undefined

  if (code === INTERNSHIP_VALIDATION_ERROR.WORK_MODE_REQUIRED) {
    return { message: 'Work mode is required.', field: 'work_mode' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.TERM_REQUIRED) {
    return { message: 'Start month/year and end month/year are required.', field: 'term' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.INVALID_HOURS_RANGE) {
    return { message: 'Hours range is invalid. Use values between 1 and 80 with min <= max.', field: 'hours' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.LOCATION_REQUIRED) {
    return { message: 'City and state are required for hybrid/on-site roles.', field: 'location' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.REQUIRED_SKILLS_MISSING) {
    return { message: 'Add at least one required skill.', field: 'required_skills' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.DEADLINE_INVALID) {
    return { message: 'Application deadline must be today or later.', field: 'application_deadline' as const }
  }
  if (code === PLAN_LIMIT_REACHED) {
    const limit = Number.parseInt(String(searchParams?.limit ?? ''), 10)
    const current = Number.parseInt(String(searchParams?.current ?? ''), 10)
    const fallback = 'Plan limit reached. Upgrade to post more active internships.'
    if (!Number.isFinite(limit) || !Number.isFinite(current)) {
      return { message: fallback, field: null }
    }
    return {
      message: `Plan limit reached: ${current} active internships, limit ${limit}. Upgrade to increase your capacity.`,
      field: null,
    }
  }
  if (searchParams?.error) {
    return { message: decodeURIComponent(searchParams.error), field: null }
  }
  return null
}

export default async function EmployerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string; code?: string; create?: string; limit?: string; current?: string }>
}) {
  const { user } = await requireRole('employer')
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()
  const monthOptions = getMonthOptions()
  const startYearOptions = getStartYearOptions()
  const endYearOptions = getEndYearOptions()

  const { data: employerProfile } = await supabase
    .from('employer_profiles')
    .select('company_name')
    .eq('user_id', user.id)
    .single()

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, location, experience_level, majors, created_at, is_active')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false })
  const { plan } = await getEmployerVerificationStatus({ supabase, userId: user.id })
  const activeInternshipsCount = (internships ?? []).filter((internship) => internship.is_active).length
  const remainingCapacity = getRemainingCapacity(plan, activeInternshipsCount)

  async function createInternship(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer')
    const supabaseAction = await supabaseServer()

    const verificationGate = guardEmployerInternshipPublish(currentUser)
    if (!verificationGate.ok) {
      redirect(verificationGate.redirectTo)
    }

    const verification = await getEmployerVerificationStatus({ supabase: supabaseAction, userId: currentUser.id })
    const requiresTurnstile = verification.plan.id === 'free'

    if (requiresTurnstile) {
      const token = String(formData.get('turnstile_token') ?? '').trim()
      const requestHeaders = await headers()
      const forwardedFor = requestHeaders.get('x-forwarded-for')
      const remoteIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() || null : null

      const turnstile = await verifyTurnstileToken({
        token,
        expectedAction: 'create_internship',
        remoteIp,
      })

      if (!turnstile.ok) {
        console.debug('[turnstile] internship create verification failed', {
          userId: currentUser.id,
          remoteIp,
          errorCodes: turnstile.errorCodes,
        })
        redirect('/dashboard/employer?error=Please+verify+you%E2%80%99re+human+and+try+again.')
      }
    }

    const { count } = await supabaseAction
      .from('internships')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', currentUser.id)
      .eq('is_active', true)

    const currentActive = count ?? 0
    const limit = verification.plan.maxActiveInternships
    if (limit !== null && currentActive >= limit) {
      redirect(`/dashboard/employer?code=${PLAN_LIMIT_REACHED}&limit=${limit}&current=${currentActive}`)
    }

    const title = String(formData.get('title') ?? '').trim()
    const locationCity = String(formData.get('location_city') ?? '').trim()
    const locationState = normalizeStateCode(String(formData.get('location_state') ?? ''))
    const workMode = String(formData.get('work_mode') ?? '').trim().toLowerCase()
    const startMonth = String(formData.get('start_month') ?? '').trim()
    const startYear = String(formData.get('start_year') ?? '').trim()
    const endMonth = String(formData.get('end_month') ?? '').trim()
    const endYear = String(formData.get('end_year') ?? '').trim()
    const term = deriveTermFromRange(startMonth, startYear, endMonth, endYear) ?? ''
    const hoursMin = Number(String(formData.get('hours_min') ?? '').trim())
    const hoursMax = Number(String(formData.get('hours_max') ?? '').trim())
    const requiredSkillsRaw = String(formData.get('required_skills') ?? '').trim()
    const requiredSkillIdsRaw = String(formData.get('required_skill_ids') ?? '').trim()
    const applicationDeadline = String(formData.get('application_deadline') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const experienceLevel = String(formData.get('experience_level') ?? '').trim()
    const majorsRaw = String(formData.get('majors') ?? '').trim()

    if (!title || !description || !experienceLevel) {
      redirect('/dashboard/employer?error=Missing+required+fields')
    }

    const validation = validateInternshipInput({
      work_mode: workMode,
      term,
      hours_min: Number.isFinite(hoursMin) ? hoursMin : null,
      hours_max: Number.isFinite(hoursMax) ? hoursMax : null,
      location_city: locationCity || null,
      location_state: locationState || null,
      required_skills: requiredSkillsRaw,
      required_skill_ids: requiredSkillIdsRaw,
      application_deadline: applicationDeadline || null,
    })

    if (!validation.ok) {
      redirect(`/dashboard/employer?code=${validation.code}`)
    }
    if (locationCity && locationState && !isVerifiedCityForState(locationCity, locationState)) {
      redirect('/dashboard/employer?error=Select+a+verified+city+and+state+combination')
    }

    const normalizedLocation =
      workMode === 'remote'
        ? 'Remote'
        : `${locationCity.trim()}, ${locationState.trim()} (${workMode})`

    const { error } = await supabaseAction.from('internships').insert({
      employer_id: currentUser.id,
      title,
      location: normalizedLocation,
      location_city: locationCity || null,
      location_state: locationState || null,
      description,
      experience_level: experienceLevel,
      work_mode: workMode,
      location_type: workMode,
      term,
      hours_min: hoursMin,
      hours_max: hoursMax,
      hours_per_week: hoursMax,
      employer_verification_tier: verification.plan.id,
      required_skills: parseCommaList(requiredSkillsRaw),
      application_deadline: applicationDeadline || null,
      majors: majorsRaw ? normalizeList(majorsRaw) : null,
    })

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/dashboard/employer?success=1')
  }

  const createInternshipError = getCreateInternshipError(resolvedSearchParams)
  const showUpgradeModal = isPlanLimitReachedCode(resolvedSearchParams?.code)
  const showCreateInternshipForm =
    resolvedSearchParams?.create === '1' || Boolean(createInternshipError) || (internships?.length ?? 0) === 0

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Employer dashboard</h1>
            <p className="mt-1 text-slate-600">
              Create internships and track what you have posted.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Plan: <span className="font-semibold text-slate-900">{plan.name}</span>
          {!isUnlimitedInternships(plan) ? ` (${plan.maxActiveInternships} active internship limit)` : ' (unlimited internships + email alerts)'}
          {`. You have ${activeInternshipsCount} active internships`}
          {remainingCapacity === null ? ' (unlimited remaining).' : ` (${remainingCapacity} remaining).`}
          <Link href="/upgrade" className="ml-2 font-medium text-blue-700 hover:underline">
            {plan.id === 'free' ? 'Upgrade' : 'Manage plan'}
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Your internships</h2>
            <span className="text-xs text-slate-500">{internships?.length ?? 0} total</span>
          </div>

          {!internships || internships.length === 0 ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              You have not created any internships yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {internships.map((internship) => (
                <div key={internship.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{internship.title}</div>
                      <div className="text-xs text-slate-500">{internship.location}</div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {internship.experience_level ? `Level: ${internship.experience_level}` : 'Level: n/a'}
                    </div>
                  </div>
                  {internship.majors && (
                    <div className="mt-2 text-xs text-slate-500">
                      Majors: {formatMajors(internship.majors)}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/jobs/${internship.id}`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View details
                    </Link>
                    <Link
                      href={`/inbox?internship_id=${encodeURIComponent(internship.id)}`}
                      className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Applicants
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              Need another listing? Create one in under 2 minutes.
            </p>
            <Link
              href="/dashboard/employer?create=1"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              + New internship
            </Link>
          </div>
        </div>

        {showCreateInternshipForm ? (
          <div id="new-internship" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Share the basics so students can quickly see fit.
                </p>
              </div>
              <Link
                href="/dashboard/employer"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Hide form
              </Link>
            </div>

            {createInternshipError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {createInternshipError.message}
              </div>
            )}
            {resolvedSearchParams?.success && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Internship created.
              </div>
            )}

            <form action={createInternship} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                name="title"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Finance Intern"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Company name</label>
              <input
                name="company_name"
                defaultValue={employerProfile?.company_name ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Canyon Capital"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Experience level</label>
              <select
                name="experience_level"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select level
                </option>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Work mode</label>
              <select
                name="work_mode"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select mode
                </option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-site</option>
              </select>
              {createInternshipError?.field === 'work_mode' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Start month</label>
              <select
                name="start_month"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select start month
                </option>
                {monthOptions.map((monthOption) => (
                  <option key={`start-${monthOption}`} value={monthOption}>
                    {monthOption}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Start year</label>
              <select
                name="start_year"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select start year
                </option>
                {startYearOptions.map((yearOption) => (
                  <option key={`year-${yearOption}`} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
              {createInternshipError?.field === 'term' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">End month</label>
              <select
                name="end_month"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select end month
                </option>
                {monthOptions.map((monthOption) => (
                  <option key={`end-${monthOption}`} value={monthOption}>
                    {monthOption}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">End year</label>
              <select
                name="end_year"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select end year
                </option>
                {endYearOptions.map((yearOption) => (
                  <option key={`end-year-${yearOption}`} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <InternshipLocationFields
                labelClassName="text-sm font-medium text-slate-700"
                selectClassName="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                errorMessage={createInternshipError?.field === 'location' ? createInternshipError.message : null}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Hours min/week</label>
              <input
                name="hours_min"
                required
                type="number"
                min={1}
                max={80}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="10"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Hours max/week</label>
              <input
                name="hours_max"
                required
                type="number"
                min={1}
                max={80}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="20"
              />
              {createInternshipError?.field === 'hours' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Majors</label>
              <input
                name="majors"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="Finance, Accounting, Economics"
              />
              <p className="mt-1 text-xs text-slate-500">Comma-separated list is fine for MVP.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Required skills</label>
              <input
                name="required_skills"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Excel, financial modeling"
              />
              {createInternshipError?.field === 'required_skills' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Application deadline (optional)</label>
              <input
                name="application_deadline"
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              />
              {createInternshipError?.field === 'application_deadline' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                name="description"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                rows={5}
                placeholder="Describe responsibilities and what a great candidate looks like."
              />
            </div>

            <div className="sm:col-span-2">
              {plan.id === 'free' ? (
                <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Quick human check required for free/unverified employers.
                </div>
              ) : null}
              {plan.id === 'free' ? <TurnstileWidget action="create_internship" className="mb-3" /> : null}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create internship
              </button>
            </div>
            </form>
          </div>
        ) : null}
      </section>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Free plan limit reached</h2>
            <p className="mt-2 text-sm text-slate-600">
              Free employers can keep one active internship. Upgrade to Verified Employer to publish unlimited internships and receive email alerts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <form action={startStarterEmployerCheckoutAction}>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Upgrade to Starter
                </button>
              </form>
              <Link
                href="/upgrade"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Billing details
              </Link>
              <Link
                href="/dashboard/employer"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
