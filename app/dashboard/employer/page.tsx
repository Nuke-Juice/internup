import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { startStarterEmployerCheckoutAction } from '@/lib/billing/actions'
import { getRemainingCapacity, isUnlimitedInternships } from '@/lib/billing/plan'
import { isPlanLimitReachedCode, PLAN_LIMIT_REACHED } from '@/lib/billing/plan'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import { buildVerifyRequiredHref } from '@/lib/auth/emailVerification'
import {
  INTERNSHIP_VALIDATION_ERROR,
  type InternshipValidationErrorCode,
  validateInternshipInput,
} from '@/lib/internshipValidation'
import {
  LISTING_PUBLISH_ERROR,
  type ListingPublishErrorCode,
  validateListingForPublish,
} from '@/lib/listings/validateListingForPublish'
import {
  deriveTermFromRange,
  getEndYearOptions,
  getMonthOptions,
  getStartYearOptions,
  inferRangeFromTerm,
} from '@/lib/internships/term'
import { isVerifiedCityForState, normalizeStateCode } from '@/lib/locations/usLocationCatalog'
import { supabaseServer } from '@/lib/supabase/server'
import { guardEmployerInternshipPublish } from '@/lib/auth/verifiedActionGate'
import InternshipLocationFields from '@/components/forms/InternshipLocationFields'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { normalizeSkills } from '@/lib/skills/normalizeSkills'
import { sanitizeSkillLabels } from '@/lib/skills/sanitizeSkillLabels'
import CatalogMultiSelect from '@/components/forms/CatalogMultiSelect'

function isLaunchConciergeEnabled() {
  const raw = (process.env.LAUNCH_CONCIERGE_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

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

function parseJsonStringArray(value: FormDataEntryValue | null): string[] {
  if (!value) return []
  const text = String(value).trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

function formatMajors(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return value ? String(value) : ''
}

function getCreateInternshipError(searchParams?: { code?: string; error?: string; limit?: string; current?: string }) {
  const code = searchParams?.code as InternshipValidationErrorCode | ListingPublishErrorCode | string | undefined

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
  if (code === LISTING_PUBLISH_ERROR.TITLE_REQUIRED) {
    return { message: 'Title is required for publish.', field: 'title' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.WORK_MODE_REQUIRED) {
    return { message: 'Work mode is required for publish.', field: 'work_mode' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.LOCATION_REQUIRED) {
    return { message: 'City and state are required for hybrid/on-site roles.', field: 'location' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.PAY_REQUIRED) {
    return { message: 'Pay details are required for publish.', field: 'pay' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.HOURS_REQUIRED) {
    return { message: 'Hours range is required for publish.', field: 'hours' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.TERM_REQUIRED) {
    return { message: 'Start and end dates are required for publish.', field: 'term' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.MAJORS_REQUIRED) {
    return { message: 'At least one major is required for publish.', field: 'majors' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.SHORT_SUMMARY_REQUIRED) {
    return { message: 'Add a short summary for listing cards.', field: 'short_summary' as const }
  }
  if (code === LISTING_PUBLISH_ERROR.DESCRIPTION_REQUIRED) {
    return { message: 'Description is required for publish.', field: 'description' as const }
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
  searchParams?: Promise<{
    error?: string
    success?: string
    code?: string
    create?: string
    edit?: string
    concierge?: string
    concierge_success?: string
    concierge_error?: string
    limit?: string
    current?: string
  }>
}) {
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
  if (!user.email_confirmed_at) {
    redirect(buildVerifyRequiredHref('/dashboard/employer', 'signup_continue'))
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()
  const monthOptions = getMonthOptions()
  const startYearOptions = getStartYearOptions()
  const endYearOptions = getEndYearOptions()
  const launchConciergeEnabled = isLaunchConciergeEnabled()

  const { data: employerProfile } = await supabase
    .from('employer_profiles')
    .select('company_name, location_address_line1')
    .eq('user_id', user.id)
    .single()

  if (!employerProfile?.company_name?.trim() || !employerProfile?.location_address_line1?.trim()) {
    redirect('/signup/employer/details')
  }

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, location, experience_level, majors, created_at, is_active, work_mode')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false })
  const editingInternshipId = String(resolvedSearchParams?.edit ?? '').trim()
  const { data: editingInternship } = editingInternshipId
    ? await supabase
        .from('internships')
        .select(
          'id, employer_id, title, company_name, category, role_category, location_city, location_state, location, work_mode, remote_eligibility, term, hours_min, hours_max, pay, majors, required_skills, application_deadline, apply_deadline, short_summary, description, experience_level, is_active, internship_required_skill_items(skill_id, skill:skills(label))'
        )
        .eq('id', editingInternshipId)
        .eq('employer_id', user.id)
        .maybeSingle()
    : { data: null }
  const { data: skillRows } = await supabase
    .from('skills')
    .select('id, label')
    .order('label', { ascending: true })
    .limit(1200)
  const skillCatalog = (skillRows ?? [])
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      name: typeof row.label === 'string' ? row.label.trim() : '',
    }))
    .filter((row) => row.id && row.name)
  const skillLabelsById = new Map(skillCatalog.map((item) => [item.id, item.name]))
  const editingCanonicalRequiredSkillLabels = (editingInternship?.internship_required_skill_items ?? [])
    .map((row) => {
      const skill = row.skill as { label?: string | null } | null
      return typeof skill?.label === 'string' ? skill.label.trim() : ''
    })
    .filter(Boolean)
  const initialRequiredSkillLabels =
    editingCanonicalRequiredSkillLabels.length > 0
      ? editingCanonicalRequiredSkillLabels
      : Array.isArray(editingInternship?.required_skills)
        ? editingInternship.required_skills
        : []
  const { plan } = await getEmployerVerificationStatus({ supabase, userId: user.id })
  const { data: conciergeRequests } = launchConciergeEnabled
    ? await supabase
        .from('employer_concierge_requests')
        .select('id, role_title, status, created_at')
        .eq('employer_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] as Array<{ id: string; role_title: string | null; status: string | null; created_at: string | null }> }
  const activeInternshipsCount = (internships ?? []).filter((internship) => internship.is_active).length
  const remainingCapacity = getRemainingCapacity(plan, activeInternshipsCount)

  async function createInternship(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const createMode = String(formData.get('create_mode') ?? 'publish').trim().toLowerCase()
    const isDraft = createMode === 'draft'
    const isPublishing = !isDraft

    const verification = await getEmployerVerificationStatus({ supabase: supabaseAction, userId: currentUser.id })
    const existingListing =
      internshipId.length > 0
        ? await supabaseAction
            .from('internships')
            .select('id, is_active')
            .eq('id', internshipId)
            .eq('employer_id', currentUser.id)
            .maybeSingle()
        : { data: null as { id: string; is_active: boolean | null } | null }

    if (internshipId.length > 0 && !existingListing.data?.id) {
      redirect('/dashboard/employer?error=Listing+not+found')
    }

    if (isPublishing) {
      const verificationGate = guardEmployerInternshipPublish(currentUser)
      if (!verificationGate.ok) {
        redirect(verificationGate.redirectTo)
      }

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
      const shouldCheckLimit = internshipId.length === 0 || !existingListing.data?.is_active
      if (shouldCheckLimit && limit !== null && currentActive >= limit) {
        redirect(`/dashboard/employer?code=${PLAN_LIMIT_REACHED}&limit=${limit}&current=${currentActive}`)
      }
    }

    const title = String(formData.get('title') ?? '').trim()
    const companyName = String(formData.get('company_name') ?? '').trim()
    const category = String(formData.get('category') ?? '').trim()
    const locationCity = String(formData.get('location_city') ?? '').trim()
    const locationState = normalizeStateCode(String(formData.get('location_state') ?? ''))
    const workMode = String(formData.get('work_mode') ?? '').trim().toLowerCase()
    const remoteEligibility = String(formData.get('remote_eligibility') ?? '').trim()
    const startMonth = String(formData.get('start_month') ?? '').trim()
    const startYear = String(formData.get('start_year') ?? '').trim()
    const endMonth = String(formData.get('end_month') ?? '').trim()
    const endYear = String(formData.get('end_year') ?? '').trim()
    const term = deriveTermFromRange(startMonth, startYear, endMonth, endYear) ?? ''
    const hoursMin = Number(String(formData.get('hours_min') ?? '').trim())
    const hoursMax = Number(String(formData.get('hours_max') ?? '').trim())
    const requiredSkillsRaw = String(formData.get('required_skills') ?? '').trim()
    const selectedRequiredSkillIds = Array.from(new Set(parseJsonStringArray(formData.get('required_skill_ids'))))
    const customRequiredSkills = parseJsonStringArray(formData.get('required_skill_custom'))
    const requiredSkillIdsRaw = selectedRequiredSkillIds.join(',')
    const applicationDeadline = String(formData.get('application_deadline') ?? '').trim()
    const shortSummary = String(formData.get('short_summary') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const pay = String(formData.get('pay') ?? '').trim()
    const experienceLevel = String(formData.get('experience_level') ?? '').trim()
    const majorsRaw = String(formData.get('majors') ?? '').trim()
    const normalizedRequiredSkills = sanitizeSkillLabels(parseCommaList(requiredSkillsRaw)).valid
    const resolvedRequiredSkillLabels = new Set(normalizedRequiredSkills)
    for (const id of selectedRequiredSkillIds) {
      const label = skillLabelsById.get(id)
      if (label) resolvedRequiredSkillLabels.add(label)
    }
    const { skillIds: normalizedCustomSkillIds, unknown: unresolvedCustomSkills } = await normalizeSkills(customRequiredSkills)
    const canonicalRequiredSkillIds = Array.from(new Set([...selectedRequiredSkillIds, ...normalizedCustomSkillIds]))
    for (const id of normalizedCustomSkillIds) {
      const label = skillLabelsById.get(id)
      if (label) resolvedRequiredSkillLabels.add(label)
    }
    for (const skill of unresolvedCustomSkills) {
      resolvedRequiredSkillLabels.add(skill)
    }

    if (isPublishing) {
      const publishValidation = validateListingForPublish({
        title,
        employerId: currentUser.id,
        workMode,
        locationCity: locationCity || null,
        locationState: locationState || null,
        payText: pay || null,
        hoursMin: Number.isFinite(hoursMin) ? hoursMin : null,
        hoursMax: Number.isFinite(hoursMax) ? hoursMax : null,
        term,
        majors: majorsRaw,
        shortSummary,
        description,
      })
      if (!publishValidation.ok) {
        const nextBase = internshipId ? `/dashboard/employer?create=1&edit=${encodeURIComponent(internshipId)}` : '/dashboard/employer?create=1'
        redirect(`${nextBase}&code=${publishValidation.code}`)
      }
    }

    if (isPublishing) {
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
        const nextBase = internshipId ? `/dashboard/employer?create=1&edit=${encodeURIComponent(internshipId)}` : '/dashboard/employer?create=1'
        redirect(`${nextBase}&code=${validation.code}`)
      }
    }

    if (locationCity && locationState && !isVerifiedCityForState(locationCity, locationState)) {
      redirect('/dashboard/employer?error=Select+a+verified+city+and+state+combination')
    }

    const normalizedLocation =
      workMode === 'remote'
        ? remoteEligibility
          ? `Remote (${remoteEligibility})`
          : 'Remote'
        : `${locationCity.trim()}, ${locationState.trim()} (${workMode})`

    const payload = {
      employer_id: currentUser.id,
      title,
      company_name: companyName || employerProfile?.company_name || null,
      category: category || null,
      role_category: category || null,
      location: normalizedLocation,
      location_city: locationCity || null,
      location_state: locationState || null,
      remote_eligibility: remoteEligibility || null,
      description,
      short_summary: shortSummary || null,
      experience_level: experienceLevel,
      work_mode: workMode,
      location_type: workMode,
      term,
      hours_min: hoursMin,
      hours_max: hoursMax,
      hours_per_week: hoursMax,
      is_active: isPublishing,
      source: 'employer_self' as const,
      employer_verification_tier: verification.isVerifiedEmployer ? 'pro' : 'free',
      pay,
      required_skills: resolvedRequiredSkillLabels.size > 0 ? Array.from(resolvedRequiredSkillLabels) : null,
      application_deadline: applicationDeadline || null,
      apply_deadline: applicationDeadline || null,
      majors: majorsRaw ? normalizeList(majorsRaw) : null,
    }

    const { data: insertedInternship, error } =
      internshipId.length > 0
        ? await supabaseAction.from('internships').update(payload).eq('id', internshipId).eq('employer_id', currentUser.id).select('id').maybeSingle()
        : await supabaseAction.from('internships').insert(payload).select('id').single()

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    const persistedInternshipId = internshipId.length > 0 ? internshipId : insertedInternship?.id
    if (persistedInternshipId) {
      const { error: clearSkillsError } = await supabaseAction
        .from('internship_required_skill_items')
        .delete()
        .eq('internship_id', persistedInternshipId)

      if (clearSkillsError) {
        redirect(`/dashboard/employer?error=${encodeURIComponent(clearSkillsError.message)}`)
      }

      if (canonicalRequiredSkillIds.length > 0) {
        const { error: requiredSkillLinkError } = await supabaseAction.from('internship_required_skill_items').insert(
          canonicalRequiredSkillIds.map((skillId) => ({
            internship_id: persistedInternshipId,
            skill_id: skillId,
          }))
        )
        if (requiredSkillLinkError) {
          redirect(`/dashboard/employer?error=${encodeURIComponent(requiredSkillLinkError.message)}`)
        }
      }
    }

    if (internshipId.length > 0) {
      redirect('/dashboard/employer?success=Listing+updated')
    }
    redirect(`/dashboard/employer?success=${isPublishing ? 'Listing+published' : 'Draft+saved'}`)
  }

  async function createConciergeRequest(formData: FormData) {
    'use server'

    if (!isLaunchConciergeEnabled()) {
      redirect('/dashboard/employer?concierge_error=Concierge+is+currently+disabled')
    }

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()

    const roleTitle = String(formData.get('role_title') ?? '').trim()
    const locationOrMode = String(formData.get('location_or_mode') ?? '').trim()
    const payRange = String(formData.get('pay_range') ?? '').trim()
    const hoursPerWeek = String(formData.get('hours_per_week') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const requirements = String(formData.get('requirements') ?? '').trim()

    if (!roleTitle || !locationOrMode || !payRange || !hoursPerWeek || !description) {
      redirect('/dashboard/employer?concierge=1&concierge_error=Missing+required+concierge+fields')
    }

    const { error } = await supabaseAction.from('employer_concierge_requests').insert({
      employer_user_id: currentUser.id,
      role_title: roleTitle,
      location_or_mode: locationOrMode,
      pay_range: payRange,
      hours_per_week: hoursPerWeek,
      description,
      requirements: requirements || null,
      status: 'new',
    })

    if (error) {
      redirect(`/dashboard/employer?concierge=1&concierge_error=${encodeURIComponent(error.message)}`)
    }

    redirect('/dashboard/employer?concierge_success=1')
  }

  const createInternshipError = getCreateInternshipError(resolvedSearchParams)
  const showUpgradeModal = isPlanLimitReachedCode(resolvedSearchParams?.code)
  const showCreateInternshipForm =
    resolvedSearchParams?.create === '1' ||
    Boolean(createInternshipError) ||
    (internships?.length ?? 0) === 0 ||
    Boolean(editingInternshipId)
  const editingTermRange = inferRangeFromTerm(editingInternship?.term ?? '')
  const isEditingListing = Boolean(editingInternship?.id)
  const showConciergeForm =
    launchConciergeEnabled &&
    (resolvedSearchParams?.concierge === '1' ||
      resolvedSearchParams?.concierge_success === '1' ||
      Boolean(resolvedSearchParams?.concierge_error))

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
          {!isUnlimitedInternships(plan) ? ` (${plan.maxActiveInternships} active internship limit)` : ' (no posting cap)'}
          {`. You have ${activeInternshipsCount} active internships`}
          {remainingCapacity === null ? ' (unlimited remaining).' : ` (${remainingCapacity} remaining).`}
          <Link href="/upgrade" className="ml-2 font-medium text-blue-700 hover:underline">
            {plan.id === 'free' ? 'Upgrade' : 'Manage plan'}
          </Link>
          <div className="mt-1 text-xs text-slate-600">
            Free covers core posting + inbox workflow. Paid plans unlock faster hiring with ranked matching and advanced filters.
          </div>
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
                      <div className="text-xs text-slate-500">
                        {internship.location} • {internship.is_active ? 'Published' : 'Draft'}
                        {internship.work_mode ? ` • ${internship.work_mode}` : ''}
                      </div>
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
                    <Link
                      href={`/dashboard/employer?create=1&edit=${encodeURIComponent(internship.id)}`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/employer?create=1"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                + New internship
              </Link>
              {launchConciergeEnabled ? (
                <Link
                  href="/dashboard/employer?concierge=1"
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Send concierge request
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {showConciergeForm ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Concierge post request</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Send us the internship details and our team will publish it for you.
                </p>
              </div>
              <Link
                href="/dashboard/employer"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Hide form
              </Link>
            </div>

            {resolvedSearchParams?.concierge_success === '1' ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Concierge request submitted.
              </div>
            ) : null}
            {resolvedSearchParams?.concierge_error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {decodeURIComponent(resolvedSearchParams.concierge_error)}
              </div>
            ) : null}

            <form action={createConciergeRequest} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Role title</label>
                <input
                  name="role_title"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  placeholder="e.g., Financial Analyst Intern"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location / mode</label>
                <input
                  name="location_or_mode"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  placeholder="Remote, Hybrid in Salt Lake City, UT"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Pay range</label>
                <input
                  name="pay_range"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  placeholder="$20-$28/hr"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Hours per week</label>
                <input
                  name="hours_per_week"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  placeholder="15-25"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  placeholder="Responsibilities, team context, expected outcomes."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Requirements (optional)</label>
                <textarea
                  name="requirements"
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  placeholder="Required skills, coursework, graduation year targets."
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Submit concierge request
                </button>
              </div>
            </form>

            {Array.isArray(conciergeRequests) && conciergeRequests.length > 0 ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent requests</h3>
                <div className="mt-2 space-y-2">
                  {conciergeRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{request.role_title || 'Untitled request'}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        Status: {request.status ?? 'new'} • Created: {request.created_at ? new Date(request.created_at).toLocaleDateString() : 'n/a'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showCreateInternshipForm ? (
          <div id="new-internship" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEditingListing ? 'Edit internship' : 'Create internship'}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Share the core fields students scan first: work mode, pay, hours, timeline, and fit summary.
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
                {decodeURIComponent(resolvedSearchParams.success)}
              </div>
            )}

            <form action={createInternship} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="internship_id" value={editingInternship?.id ?? ''} />

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title</label>
                <input
                  name="title"
                  required
                  defaultValue={editingInternship?.title ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g., Finance Intern"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Company name</label>
                <input
                  name="company_name"
                  defaultValue={editingInternship?.company_name ?? employerProfile?.company_name ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g., Canyon Capital"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Category</label>
                <select
                  name="category"
                  required
                  defaultValue={editingInternship?.category ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  {['Finance', 'Accounting', 'Data', 'Marketing', 'Operations', 'Product', 'Design', 'Sales', 'HR', 'Engineering'].map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Experience level</label>
                <select
                  name="experience_level"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  defaultValue={editingInternship?.experience_level ?? 'entry'}
                >
                  <option value="entry">Entry</option>
                  <option value="mid">Mid</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Work mode</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[
                    { value: 'on-site', label: 'On-site' },
                    { value: 'hybrid', label: 'Hybrid' },
                    { value: 'remote', label: 'Remote' },
                  ].map((option) => {
                    const checked = (editingInternship?.work_mode ?? '') === option.value || (!editingInternship?.work_mode && option.value === 'hybrid')
                    return (
                      <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        <input type="radio" name="work_mode" value={option.value} defaultChecked={checked} required />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
                {createInternshipError?.field === 'work_mode' && (
                  <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Remote eligibility (optional)</label>
                <input
                  name="remote_eligibility"
                  defaultValue={editingInternship?.remote_eligibility ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g., US only, Utah only"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Start month</label>
                <select
                  name="start_month"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  defaultValue={editingTermRange.startMonth}
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
                  defaultValue={editingTermRange.startYear}
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
                  defaultValue={editingTermRange.endMonth}
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
                  defaultValue={editingTermRange.endYear}
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
                  defaultCity={editingInternship?.location_city ?? ''}
                  defaultState={editingInternship?.location_state ?? ''}
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
                  defaultValue={editingInternship?.hours_min ?? ''}
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
                  defaultValue={editingInternship?.hours_max ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="20"
                />
                {createInternshipError?.field === 'hours' && (
                  <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Pay range</label>
                <input
                  name="pay"
                  required
                  defaultValue={editingInternship?.pay ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="$20-$28/hr"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Majors</label>
                <input
                  name="majors"
                  required
                  defaultValue={formatMajors(editingInternship?.majors ?? '')}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="Finance, Accounting, Economics"
                />
                <p className="mt-1 text-xs text-slate-500">Use a comma-separated list.</p>
              </div>

              <div className="sm:col-span-2">
                <CatalogMultiSelect
                  label="Required skills"
                  fieldName="required_skills"
                  idsFieldName="required_skill_ids"
                  customFieldName="required_skill_custom"
                  inputId="employer-required-skills-input"
                  options={skillCatalog}
                  initialLabels={initialRequiredSkillLabels}
                  helperText="Type to select canonical skills. Enter adds custom text if no exact match."
                />
                {createInternshipError?.field === 'required_skills' && (
                  <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Short summary (1-2 sentences)</label>
                <textarea
                  name="short_summary"
                  required
                  rows={2}
                  defaultValue={editingInternship?.short_summary ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="One-line preview students see on listing cards."
                />
                {createInternshipError?.field === 'short_summary' ? (
                  <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Application deadline (optional)</label>
                <input
                  name="application_deadline"
                  type="date"
                  defaultValue={editingInternship?.application_deadline ?? editingInternship?.apply_deadline ?? ''}
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
                  defaultValue={editingInternship?.description ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  rows={5}
                  placeholder="Describe responsibilities and what a great candidate looks like."
                />
              </div>

              <div className="sm:col-span-2">
                {plan.id === 'free' ? (
                  <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Quick human check required for free/unverified employers when publishing.
                  </div>
                ) : null}
                {plan.id === 'free' ? <TurnstileWidget action="create_internship" className="mb-3" /> : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="submit"
                    name="create_mode"
                    value="publish"
                    className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {isEditingListing ? 'Update & publish' : 'Publish internship'}
                  </button>
                  <button
                    type="submit"
                    name="create_mode"
                    value="draft"
                    formNoValidate
                    className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isEditingListing ? 'Save changes as draft' : 'Save draft'}
                  </button>
                </div>
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
              Free employers can keep one active internship. Upgrade to Starter or Pro to publish more internships and unlock email alerts.
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
