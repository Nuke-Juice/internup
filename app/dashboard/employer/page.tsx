import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { startStarterEmployerCheckoutAction } from '@/lib/billing/actions'
import { isUnlimitedInternships } from '@/lib/billing/plan'
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
} from '@/lib/internships/term'
import {
  type EmployerInternshipRow,
  getEmployerInternshipCounts,
  getEmployerInternships,
  isEmployerInternshipActive,
  summarizeEmployerInternshipCounts,
} from '@/lib/internships/employerCounts'
import { normalizeEmployerVerificationTier, normalizeLocationType } from '@/lib/internships/locationType'
import { isVerifiedCityForState, normalizeStateCode } from '@/lib/locations/usLocationCatalog'
import { supabaseServer } from '@/lib/supabase/server'
import { guardEmployerInternshipPublish } from '@/lib/auth/verifiedActionGate'
import { sanitizeSkillLabels } from '@/lib/skills/sanitizeSkillLabels'
import BackWithFallbackButton from '@/components/navigation/BackWithFallbackButton'
import { INTERNSHIP_CATEGORIES } from '@/lib/internships/categories'
import { TARGET_STUDENT_YEAR_LABELS, TARGET_STUDENT_YEAR_OPTIONS } from '@/lib/internships/years'
import { inferExternalApplyType, normalizeApplyMode, normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { trackAnalyticsEvent } from '@/lib/analytics'
import ListingDraftCleanup from '@/components/employer/listing/ListingDraftCleanup'
import ListingWizard from '@/components/employer/listing/ListingWizard'
import CreateInternshipCta from '@/app/dashboard/employer/_components/CreateInternshipCta'
import ActiveInternshipsList, { type ActiveInternshipListItem } from '@/app/dashboard/employer/_components/ActiveInternshipsList'

function isLaunchConciergeEnabled() {
  const raw = (process.env.LAUNCH_CONCIERGE_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

function sanitizeErrorDetails(value: string | undefined) {
  if (!value) return null
  return value.replace(/\s+/g, ' ').trim().slice(0, 500)
}

function parseTargetStudentYears(value: FormDataEntryValue | null) {
  const parsed = parseJsonStringArray(value)
    .map((item) => item.toLowerCase())
    .filter((item) => TARGET_STUDENT_YEAR_OPTIONS.includes(item as (typeof TARGET_STUDENT_YEAR_OPTIONS)[number]))
  return Array.from(new Set(parsed))
}

function formatTargetStudentYears(value: unknown) {
  const years = Array.isArray(value)
    ? value.map((item) => String(item).trim().toLowerCase()).filter((item) => item in TARGET_STUDENT_YEAR_LABELS)
    : []
  if (years.length === 0) return 'All years'
  return years
    .map((year) => TARGET_STUDENT_YEAR_LABELS[year as keyof typeof TARGET_STUDENT_YEAR_LABELS])
    .join(', ')
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function filterUuidList(values: string[]) {
  return values.filter((value) => UUID_PATTERN.test(value.trim()))
}

function formatMajors(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return value ? String(value) : ''
}

function formatListingState(row: { is_active: boolean | null; status: string | null }) {
  const status = (row.status ?? '').trim().toLowerCase()
  if (row.is_active) return status ? `Active • ${status}` : 'Active'
  return status ? `Inactive • ${status}` : 'Inactive'
}

function parseErrorFields(rawFields: string | undefined) {
  if (!rawFields) return []
  return rawFields
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
}

function getCreateInternshipError(searchParams?: {
  code?: string
  error?: string
  limit?: string
  current?: string
  fields?: string
}) {
  const code = searchParams?.code as InternshipValidationErrorCode | ListingPublishErrorCode | string | undefined
  const incomingFields = parseErrorFields(searchParams?.fields)
  const withField = <T extends string | null>(message: string, field: T) => ({
    message,
    field,
    fields: field ? [field] : incomingFields,
  })

  if (code === INTERNSHIP_VALIDATION_ERROR.WORK_MODE_REQUIRED) {
    return withField('Work mode is required.', 'work_mode' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.TERM_REQUIRED) {
    return withField('Start month/year and end month/year are required.', 'term' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.INVALID_HOURS_RANGE) {
    return withField('Hours range is invalid. Use values between 1 and 80 with min <= max.', 'hours' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.LOCATION_REQUIRED) {
    return withField('City and state are required for hybrid/on-site roles.', 'location' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.REQUIRED_SKILLS_MISSING) {
    return withField('Add at least one required skill.', 'required_skills' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.REQUIRED_COURSE_CATEGORIES_MISSING) {
    return withField('Add at least one required coursework category.', 'required_course_categories' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.TARGET_STUDENT_YEAR_REQUIRED) {
    return withField('Select the target year in school.', 'target_student_year' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.COURSEWORK_STRENGTH_REQUIRED) {
    return withField('Select desired coursework strength.', 'desired_coursework_strength' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.INVALID_PAY_RANGE) {
    return withField('Pay range is invalid. Use min >= 0 and max >= min.', 'pay' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.REMOTE_ELIGIBILITY_REQUIRED) {
    return withField('Remote eligibility state is required for remote/hybrid roles.', 'remote_eligibility' as const)
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.DEADLINE_INVALID) {
    return withField('Application deadline must be today or later.', 'application_deadline' as const)
  }
  if (code === 'LOCATION_TYPE_INVALID') {
    return withField('Please choose a valid work location: Remote, In-person, or Hybrid.', 'work_mode' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.TITLE_REQUIRED) {
    return withField('Title is required for publish.', 'title' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.WORK_MODE_REQUIRED) {
    return withField('Work mode is required for publish.', 'work_mode' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.LOCATION_REQUIRED) {
    return withField('City and state are required for hybrid/on-site roles.', 'location' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.PAY_REQUIRED) {
    return withField('Pay details are required for publish.', 'pay' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.HOURS_REQUIRED) {
    return withField('Hours range is required for publish.', 'hours' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.TERM_REQUIRED) {
    return withField('Start and end dates are required for publish.', 'term' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.MAJORS_REQUIRED) {
    return withField('At least one major is required for publish.', 'majors' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.SHORT_SUMMARY_REQUIRED) {
    return withField('Add a short summary for listing cards.', 'short_summary' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.DESCRIPTION_REQUIRED) {
    return withField('Description is required for publish.', 'description' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.SKILLS_REQUIRED) {
    return withField('At least one canonical skill is required for publish.', 'required_skills' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.COURSE_CATEGORIES_REQUIRED) {
    return withField('At least one required coursework category is required for publish.', 'required_course_categories' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.YEAR_IN_SCHOOL_REQUIRED) {
    return withField('Year in school is required for publish.', 'target_student_year' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.COURSEWORK_STRENGTH_REQUIRED) {
    return withField('Coursework strength is required for publish.', 'desired_coursework_strength' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.REMOTE_ELIGIBILITY_REQUIRED) {
    return withField('Remote eligibility state is required for remote/hybrid listings.', 'remote_eligibility' as const)
  }
  if (code === LISTING_PUBLISH_ERROR.EXTERNAL_APPLY_URL_REQUIRED) {
    return withField('A valid https ATS application URL is required for ATS-link or hybrid apply mode.', 'external_apply_url')
  }
  if (code === PLAN_LIMIT_REACHED) {
    return withField('Free plan allows 1 active internship. Deactivate an active listing or upgrade.', null)
  }
  if (searchParams?.error) {
    return withField('We could not publish this internship. Please review the highlighted fields and try again.', null)
  }
  return null
}

export default async function EmployerDashboardPage({
  searchParams,
  createOnly = false,
}: {
  searchParams?: Promise<{
    error?: string
    success?: string
    published_id?: string
    code?: string
    create?: string
    edit?: string
    draft?: string
    draft_cleared?: string
    concierge?: string
    concierge_success?: string
    concierge_error?: string
    limit?: string
    current?: string
    fields?: string
    reason?: string
  }>
  createOnly?: boolean
}) {
  noStore()
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
  console.info('[employer.dashboard.auth] auth_uid=%s role=%s', user.id, 'employer')
  if (!user.email_confirmed_at) {
    redirect(buildVerifyRequiredHref('/dashboard/employer', 'signup_continue'))
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()
  const launchConciergeEnabled = isLaunchConciergeEnabled()

  const { data: employerProfile } = await supabase
    .from('employer_profiles')
    .select('company_name, location_address_line1, location_state')
    .eq('user_id', user.id)
    .single()

  if (!employerProfile?.company_name?.trim() || !employerProfile?.location_address_line1?.trim()) {
    redirect('/signup/employer/details')
  }

  console.info(
    '[employer.dashboard.query_filters] auth_uid=%s employer_id=%s status_filter=%s is_active_filter=%s',
    user.id,
    user.id,
    'none',
    'none'
  )
  if (process.env.NODE_ENV !== 'production') {
    const [{ count: diagnosticOwnerCount, error: diagnosticOwnerCountError }, { data: diagnosticLatestRows, error: diagnosticLatestRowsError }] =
      await Promise.all([
        supabase.from('internships').select('id', { head: true, count: 'exact' }).eq('employer_id', user.id),
        supabase
          .from('internships')
          .select('id, employer_id, title, is_active, status, created_at')
          .eq('employer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
    console.info(
      '[employer.dashboard.diagnostic_owner_count] auth_uid=%s employer_id=%s count=%s error=%s',
      user.id,
      user.id,
      diagnosticOwnerCount ?? 0,
      diagnosticOwnerCountError?.message ?? 'none'
    )
    console.info(
      '[employer.dashboard.diagnostic_latest_rows] auth_uid=%s employer_id=%s rows=%s error=%s payload=%s',
      user.id,
      user.id,
      diagnosticLatestRows?.length ?? 0,
      diagnosticLatestRowsError?.message ?? 'none',
      JSON.stringify(diagnosticLatestRows ?? [])
    )
  }

  let internships: EmployerInternshipRow[] = []
  try {
    internships = await getEmployerInternships(supabase, user.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.warn('[employer.dashboard.internships_fetch_failed] auth_uid=%s employer_id=%s message=%s', user.id, user.id, message)
  }
  const publishedIdFromParams = String(resolvedSearchParams?.published_id ?? '').trim()
  let publishedOwnerMismatchMessage: string | null = null
  if (publishedIdFromParams && !internships.some((row) => row.id === publishedIdFromParams)) {
    const { data: justPublishedRow, error: justPublishedError } = await supabase
      .from('internships')
      .select('*')
      .eq('id', publishedIdFromParams)
      .maybeSingle()
    if (justPublishedError) {
      console.warn(
        '[employer.internships.published_lookup_failed] published_id=%s user_id=%s message=%s',
        publishedIdFromParams,
        user.id,
        justPublishedError.message
      )
    } else if (justPublishedRow?.id) {
      if (justPublishedRow.employer_id === user.id) {
        internships = [justPublishedRow, ...internships]
      } else {
        publishedOwnerMismatchMessage =
          'Listing was published, but it belongs to a different employer account than the one currently signed in.'
        console.warn(
          '[employer.internships.owner_mismatch] published_id=%s current_user=%s row_employer_id=%s',
          publishedIdFromParams,
          user.id,
          String(justPublishedRow.employer_id ?? '')
        )
      }
    }
  }
  const editingInternshipId = String(resolvedSearchParams?.edit ?? '').trim()
  const requestedDraftId = String(resolvedSearchParams?.draft ?? '').trim()
  const { data: editingInternship } = editingInternshipId
    ? await supabase
        .from('internships')
        .select(
          'id, employer_id, title, company_name, category, role_category, location_city, location_state, location, work_mode, remote_eligibility_scope, remote_eligible_states, remote_eligible_state, remote_eligible_region, apply_mode, external_apply_url, external_apply_type, term, hours_min, hours_max, pay, pay_min, pay_max, majors, required_skills, preferred_skills, responsibilities, qualifications, resume_required, application_deadline, apply_deadline, short_summary, description, target_student_year, target_student_years, desired_coursework_strength, is_active, status, internship_required_skill_items(skill_id, skill:skills(label)), internship_required_course_categories(category_id, category:canonical_course_categories(name, slug)), internship_major_links(major_id, major:canonical_majors(name))'
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
  const { data: canonicalCourseCategoryRows } = await supabase
    .from('canonical_course_categories')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(500)
  const courseCategoryCatalog = (canonicalCourseCategoryRows ?? [])
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      name: typeof row.name === 'string' ? row.name.trim() : '',
    }))
    .filter((row) => row.id && row.name)
  const initialRequiredCourseCategoryLabels = (editingInternship?.internship_required_course_categories ?? [])
    .map((row) => {
      const category = row.category as { name?: string | null } | null
      return typeof category?.name === 'string' ? category.name.trim() : ''
    })
    .filter(Boolean)
  const { data: canonicalMajorRows } = await supabase
    .from('canonical_majors')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(600)
  const canonicalMajorCatalog = (canonicalMajorRows ?? [])
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      name: typeof row.name === 'string' ? row.name.trim() : '',
    }))
    .filter((row) => row.id && row.name)
  const majorNamesById = new Map(canonicalMajorCatalog.map((major) => [major.id, major.name]))
  const initialMajorLabelsFromLinks = (editingInternship?.internship_major_links ?? [])
    .map((row) => {
      const major = row.major as { name?: string | null } | null
      return typeof major?.name === 'string' ? major.name.trim() : ''
    })
    .filter(Boolean)
  const initialMajorLabels =
    initialMajorLabelsFromLinks.length > 0
      ? initialMajorLabelsFromLinks
      : Array.isArray(editingInternship?.majors)
        ? editingInternship.majors
        : parseCommaList(formatMajors(editingInternship?.majors ?? ''))
  const { plan } = await getEmployerVerificationStatus({ supabase, userId: user.id })
  const { data: conciergeRequests } = launchConciergeEnabled && !createOnly
    ? await supabase
        .from('employer_concierge_requests')
        .select('id, role_title, status, created_at')
        .eq('employer_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] as Array<{ id: string; role_title: string | null; status: string | null; created_at: string | null }> }
  const internshipCounts = summarizeEmployerInternshipCounts(internships)
  const activeInternshipsCount = internshipCounts.activeCount

  async function createInternship(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const draftId = String(formData.get('draft_id') ?? '').trim()
    const createMode = String(formData.get('create_mode') ?? 'publish').trim().toLowerCase()
    const isDraft = createMode === 'draft'
    const isPublishing = !isDraft
    const createFormBase = internshipId
      ? `/dashboard/employer/new?edit=${encodeURIComponent(internshipId)}`
      : draftId
        ? `/dashboard/employer/new?draft=${encodeURIComponent(draftId)}`
        : '/dashboard/employer?create=1'
    const buildCreateErrorRedirect = (input: {
      code?: string
      message?: string
      reason: string
      fields?: string[]
    }) => {
      const params = new URLSearchParams()
      if (input.code) params.set('code', input.code)
      if (input.message) params.set('error', input.message)
      params.set('reason', input.reason)
      if (input.fields && input.fields.length > 0) {
        params.set('fields', input.fields.join(','))
      }
      return `${createFormBase}${createFormBase.includes('?') ? '&' : '?'}${params.toString()}`
    }

    const verification = await getEmployerVerificationStatus({ supabase: supabaseAction, userId: currentUser.id })
    const existingListing =
      internshipId.length > 0
        ? await supabaseAction
            .from('internships')
            .select('id, is_active, status')
            .eq('id', internshipId)
            .eq('employer_id', currentUser.id)
            .maybeSingle()
        : { data: null as { id: string; is_active: boolean | null; status: string | null } | null }

    if (internshipId.length > 0 && !existingListing.data?.id) {
      redirect('/dashboard/employer?error=Listing+not+found')
    }

    console.info(
      '[internships.publish_attempt] user_id=%s draft_id=%s internship_id=%s mode=%s',
      currentUser.id,
      draftId || null,
      internshipId || null,
      createMode
    )

    if (isPublishing) {
      const verificationGate = guardEmployerInternshipPublish(currentUser)
      if (!verificationGate.ok) {
        redirect(verificationGate.redirectTo)
      }
      if (!verification.isVerifiedEmployer) {
        const cutoff = new Date()
        cutoff.setMinutes(cutoff.getMinutes() - 10)
        const tenMinutesAgo = cutoff.toISOString()
        const { count: recentCreateCount } = await supabaseAction
          .from('internships')
          .select('id', { count: 'exact', head: true })
          .eq('employer_id', currentUser.id)
          .gte('created_at', tenMinutesAgo)
        if ((recentCreateCount ?? 0) > 6) {
          redirect('/dashboard/employer?error=Publishing+rate+limit+reached.+Please+try+again+in+a+few+minutes.')
        }
      }

      let currentActive = 0
      try {
        currentActive = (await getEmployerInternshipCounts(supabaseAction, currentUser.id)).activeCount
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown'
        redirect(
          buildCreateErrorRedirect({
            message: `Unable to verify plan capacity: ${message}`,
            reason: 'capacity_count_failed',
          })
        )
      }
      const limit = verification.plan.maxActiveInternships
      const shouldCheckLimit = internshipId.length === 0 || (existingListing.data?.status !== 'published' && !existingListing.data?.is_active)
      if (shouldCheckLimit && limit !== null && currentActive >= limit) {
        redirect(
          `/dashboard/employer?code=${PLAN_LIMIT_REACHED}&limit=${limit}&current=${currentActive}&reason=capacity_limit_reached`
        )
      }
    }

    const title = String(formData.get('title') ?? '').trim()
    const companyName = String(formData.get('company_name') ?? '').trim()
    const category = String(formData.get('category') ?? '').trim()
    const locationCity = String(formData.get('location_city') ?? '').trim()
    const locationState = normalizeStateCode(String(formData.get('location_state') ?? ''))
    const workMode = String(formData.get('work_mode') ?? '').trim().toLowerCase()
    const remoteEligibleRegionInput = String(formData.get('remote_eligible_region') ?? '').trim().toLowerCase()
    const remoteEligibleRegion = remoteEligibleRegionInput === 'us-wide' ? 'us-wide' : remoteEligibleRegionInput === 'state' ? 'state' : null
    const remoteEligibleStateInput = normalizeStateCode(String(formData.get('remote_eligible_state') ?? ''))
    const remoteEligibleState = remoteEligibleRegion === 'state' ? (remoteEligibleStateInput || employerBaseState || locationState) : null
    const remoteEligibilityScope =
      workMode === 'remote' || workMode === 'hybrid'
        ? remoteEligibleRegion === 'us-wide'
          ? 'worldwide'
          : 'us_states'
        : null
    const remoteEligibleStates =
      workMode === 'remote' || workMode === 'hybrid'
        ? remoteEligibleRegion === 'us-wide'
          ? []
          : remoteEligibleState
            ? [remoteEligibleState]
            : []
        : []
    const startMonth = String(formData.get('start_month') ?? '').trim()
    const startYear = String(formData.get('start_year') ?? '').trim()
    const endMonth = String(formData.get('end_month') ?? '').trim()
    const endYear = String(formData.get('end_year') ?? '').trim()
    const term = deriveTermFromRange(startMonth, startYear, endMonth, endYear) ?? ''
    const hoursMin = Number(String(formData.get('hours_min') ?? '').trim())
    const hoursMax = Number(String(formData.get('hours_max') ?? '').trim())
    const requiredSkillsRaw = String(formData.get('required_skills') ?? '').trim()
    const selectedRequiredSkillIds = Array.from(new Set(filterUuidList(parseJsonStringArray(formData.get('required_skill_ids')))))
    const preferredSkillsRaw = String(formData.get('preferred_skills') ?? '').trim()
    const selectedPreferredSkillIds = Array.from(new Set(filterUuidList(parseJsonStringArray(formData.get('preferred_skill_ids')))))
    const selectedRequiredCourseCategoryIds = Array.from(
      new Set(filterUuidList(parseJsonStringArray(formData.get('required_course_category_ids'))))
    )
    const requiredSkillIdsRaw = selectedRequiredSkillIds.join(',')
    const requiredCourseCategoryIdsRaw = selectedRequiredCourseCategoryIds.join(',')
    const applicationDeadline = String(formData.get('application_deadline') ?? '').trim()
    const applyMode = normalizeApplyMode(String(formData.get('apply_mode') ?? 'native'))
    const externalApplyUrlInput = String(formData.get('external_apply_url') ?? '').trim()
    const externalApplyUrl = normalizeExternalApplyUrl(externalApplyUrlInput)
    const externalApplyTypeInput = String(formData.get('external_apply_type') ?? '').trim().toLowerCase()
    const externalApplyType = externalApplyTypeInput || (externalApplyUrl ? inferExternalApplyType(externalApplyUrl) : null)
    const requiresExternalApply = applyMode === 'ats_link' || applyMode === 'hybrid'
    const resolvedExternalApplyUrl = requiresExternalApply ? externalApplyUrl : null
    const resolvedExternalApplyType = requiresExternalApply ? externalApplyType : null
    if (requiresExternalApply && !externalApplyUrl) {
      redirect(
        buildCreateErrorRedirect({
          message: 'Valid https ATS application URL is required for ATS or hybrid apply mode',
          reason: 'external_apply_url_required',
          fields: ['external_apply_url'],
        })
      )
    }
    const shortSummary = String(formData.get('short_summary') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const responsibilities = parseList(String(formData.get('responsibilities') ?? '').trim())
    const qualifications = parseList(String(formData.get('qualifications') ?? '').trim())
    const payMin = Number(String(formData.get('pay_min') ?? '').trim())
    const payMax = Number(String(formData.get('pay_max') ?? '').trim())
    const pay = Number.isFinite(payMin) && Number.isFinite(payMax) ? `$${payMin}-$${payMax}/hr` : ''
    const resumeRequired = String(formData.get('resume_required') ?? '1').trim() !== '0'

    if (isPublishing && !applicationDeadline) {
      redirect(
        buildCreateErrorRedirect({
          message: 'Application deadline is required for publish',
          reason: 'application_deadline_required',
          fields: ['application_deadline'],
        })
      )
    }
    const targetStudentYears = parseTargetStudentYears(formData.get('target_student_years'))
    const targetStudentYear =
      targetStudentYears.length === TARGET_STUDENT_YEAR_OPTIONS.length
        ? 'any'
        : targetStudentYears[0] ?? String(formData.get('target_student_year') ?? '').trim().toLowerCase()
    const desiredCourseworkStrength = String(formData.get('desired_coursework_strength') ?? '').trim().toLowerCase()
    const majorsRaw = String(formData.get('majors') ?? '').trim()
    const selectedMajorIds = Array.from(new Set(filterUuidList(parseJsonStringArray(formData.get('major_ids')))))
    const selectedMajorNames = selectedMajorIds.map((id) => majorNamesById.get(id)).filter((value): value is string => Boolean(value))
    const resolvedMajors = selectedMajorNames.length > 0 ? selectedMajorNames : parseCommaList(majorsRaw)
    const normalizedRequiredSkills = sanitizeSkillLabels(parseCommaList(requiredSkillsRaw)).valid
    const resolvedRequiredSkillLabels = new Set(normalizedRequiredSkills)
    for (const id of selectedRequiredSkillIds) {
      const label = skillLabelsById.get(id)
      if (label) resolvedRequiredSkillLabels.add(label)
    }
    const normalizedPreferredSkills = sanitizeSkillLabels(parseCommaList(preferredSkillsRaw)).valid
    const resolvedPreferredSkillLabels = new Set(normalizedPreferredSkills)
    for (const id of selectedPreferredSkillIds) {
      const label = skillLabelsById.get(id)
      if (label) resolvedPreferredSkillLabels.add(label)
    }
    const canonicalRequiredSkillIds = Array.from(new Set([...selectedRequiredSkillIds]))
    const canonicalPreferredSkillIds = Array.from(new Set([...selectedPreferredSkillIds]))

    if (isPublishing) {
      const publishValidation = validateListingForPublish({
        title,
        employerId: currentUser.id,
        workMode,
        locationCity: locationCity || null,
        locationState: locationState || null,
        payMinHourly: Number.isFinite(payMin) ? payMin : null,
        payMaxHourly: Number.isFinite(payMax) ? payMax : null,
        hoursMin: Number.isFinite(hoursMin) ? hoursMin : null,
        hoursMax: Number.isFinite(hoursMax) ? hoursMax : null,
        term,
        majors: resolvedMajors,
        shortSummary,
        description,
        requiredSkillIds: canonicalRequiredSkillIds,
        requiredCourseCategoryIds: selectedRequiredCourseCategoryIds,
        targetStudentYear,
        targetStudentYears,
        desiredCourseworkStrength,
        remoteEligibilityScope: remoteEligibilityScope ?? null,
        remoteEligibleStates,
        remoteEligibleState: remoteEligibleState || null,
        applyMode,
        externalApplyUrl: resolvedExternalApplyUrl,
      })
      if (!publishValidation.ok) {
        const mapped = getCreateInternshipError({ code: publishValidation.code })
        redirect(
          buildCreateErrorRedirect({
            code: publishValidation.code,
            reason: 'listing_publish_validation_failed',
            fields: mapped?.fields ?? [],
          })
        )
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
        required_course_category_ids: requiredCourseCategoryIdsRaw,
        target_student_year: targetStudentYear || null,
        target_student_years: targetStudentYears,
        desired_coursework_strength: desiredCourseworkStrength || null,
        pay_min: Number.isFinite(payMin) ? payMin : null,
        pay_max: Number.isFinite(payMax) ? payMax : null,
        remote_eligibility_scope: remoteEligibilityScope,
        remote_eligible_states: remoteEligibleStates,
        application_deadline: applicationDeadline || null,
      })

      if (!validation.ok) {
        const mapped = getCreateInternshipError({ code: validation.code })
        redirect(
          buildCreateErrorRedirect({
            code: validation.code,
            reason: 'internship_validation_failed',
            fields: mapped?.fields ?? [],
          })
        )
      }
    }

    if (locationCity && locationState && !isVerifiedCityForState(locationCity, locationState)) {
      redirect(
        buildCreateErrorRedirect({
          message: 'Select a verified city and state combination',
          reason: 'city_state_mismatch',
          fields: ['location_city', 'location_state'],
        })
      )
    }

    const normalizedLocation =
      workMode === 'remote'
        ? remoteEligibleState
          ? `Remote (${remoteEligibleState})`
          : 'Remote'
        : `${locationCity.trim()}, ${locationState.trim()} (${workMode})`
    const locationType = normalizeLocationType(workMode)
    if (!locationType) {
      console.warn('[internships.create] reason=invalid_location_type raw=%s', workMode)
      redirect(
        buildCreateErrorRedirect({
          code: 'LOCATION_TYPE_INVALID',
          reason: 'location_type_invalid',
          fields: ['work_mode'],
        })
      )
    }

    const employerVerificationTier =
      normalizeEmployerVerificationTier(verification.plan.id) ??
      (verification.isVerifiedEmployer ? 'pro' : 'free')

    const payload = {
      employer_id: currentUser.id,
      title,
      company_name: companyName || employerProfile?.company_name || null,
      category: category || null,
      role_category: category || null,
      location: normalizedLocation,
      location_city: locationCity || null,
      location_state: locationState || null,
      remote_eligibility: remoteEligibleState || null,
      remote_eligibility_scope: remoteEligibilityScope,
      remote_eligible_state: remoteEligibleState || null,
      remote_eligible_region: remoteEligibleRegion,
      remote_eligible_states: remoteEligibleStates,
      description,
      responsibilities: responsibilities.length > 0 ? responsibilities : null,
      qualifications: qualifications.length > 0 ? qualifications : null,
      short_summary: shortSummary || null,
      target_student_year: targetStudentYear || null,
      target_student_years: targetStudentYears,
      desired_coursework_strength: desiredCourseworkStrength || null,
      experience_level: targetStudentYear || null,
      work_mode: workMode,
      apply_mode: applyMode,
      external_apply_url: resolvedExternalApplyUrl,
      external_apply_type: resolvedExternalApplyType,
      location_type: locationType,
      term,
      hours_min: hoursMin,
      hours_max: hoursMax,
      hours_per_week: hoursMax,
      pay_min: Number.isFinite(payMin) ? payMin : null,
      pay_max: Number.isFinite(payMax) ? payMax : null,
      is_active: isPublishing,
      status: isPublishing ? 'published' : 'draft',
      source: 'employer_self' as const,
      employer_verification_tier: employerVerificationTier,
      pay,
      required_skills: resolvedRequiredSkillLabels.size > 0 ? Array.from(resolvedRequiredSkillLabels) : null,
      preferred_skills: resolvedPreferredSkillLabels.size > 0 ? Array.from(resolvedPreferredSkillLabels) : null,
      resume_required: resumeRequired,
      application_deadline: applicationDeadline || null,
      apply_deadline: applicationDeadline || null,
      majors: resolvedMajors.length > 0 ? resolvedMajors : null,
    }

    const logPublishFailure = (reason: string, message: string) => {
      console.error('[internships.create] reason=internship_publish_failed code=%s user_id=%s internship_id=%s draft_id=%s details=%s payload=%s', reason, currentUser.id, internshipId || null, draftId || null, sanitizeErrorDetails(message), JSON.stringify({
        employer_id: currentUser.id,
        internship_id: internshipId || null,
        draft_id: draftId || null,
        create_mode: createMode,
        work_mode: workMode,
        location_type: locationType,
        apply_mode: applyMode,
        category: category || null,
        role_category: category || null,
        is_active: isPublishing,
        status: isPublishing ? 'published' : 'draft',
        pay_min: Number.isFinite(payMin) ? payMin : null,
        pay_max: Number.isFinite(payMax) ? payMax : null,
        hours_min: Number.isFinite(hoursMin) ? hoursMin : null,
        hours_max: Number.isFinite(hoursMax) ? hoursMax : null,
        description_len: description.length,
        short_summary_len: shortSummary.length,
      }))
    }

    const { data: insertedInternship, error } =
      internshipId.length > 0
        ? await supabaseAction.from('internships').update(payload).eq('id', internshipId).eq('employer_id', currentUser.id).select('id').maybeSingle()
        : await supabaseAction.from('internships').insert(payload).select('id').single()

    if (error) {
      logPublishFailure('upsert_failed', error.message)
      redirect(
        buildCreateErrorRedirect({
          message: error.message,
          reason: 'upsert_failed',
        })
      )
    }

    const persistedInternshipId = internshipId.length > 0 ? internshipId : insertedInternship?.id
    if (!persistedInternshipId) {
      logPublishFailure('missing_persisted_id', 'Persisted internship id missing after write')
      redirect(
        buildCreateErrorRedirect({
          message: 'Publish failed before confirmation. Please retry.',
          reason: 'missing_persisted_id',
        })
      )
    }
    if (persistedInternshipId) {
      const { error: clearSkillsError } = await supabaseAction
        .from('internship_required_skill_items')
        .delete()
        .eq('internship_id', persistedInternshipId)

      if (clearSkillsError) {
        logPublishFailure('clear_required_skills_failed', clearSkillsError.message)
        redirect(
          buildCreateErrorRedirect({
            message: clearSkillsError.message,
            reason: 'clear_required_skills_failed',
          })
        )
      }

      if (canonicalRequiredSkillIds.length > 0) {
        const { error: requiredSkillLinkError } = await supabaseAction.from('internship_required_skill_items').insert(
          canonicalRequiredSkillIds.map((skillId) => ({
            internship_id: persistedInternshipId,
            skill_id: skillId,
          }))
        )
        if (requiredSkillLinkError) {
          logPublishFailure('insert_required_skills_failed', requiredSkillLinkError.message)
          redirect(
            buildCreateErrorRedirect({
              message: requiredSkillLinkError.message,
              reason: 'insert_required_skills_failed',
            })
          )
        }
      }

      const { error: clearPreferredSkillsError } = await supabaseAction
        .from('internship_preferred_skill_items')
        .delete()
        .eq('internship_id', persistedInternshipId)
      if (clearPreferredSkillsError) {
        logPublishFailure('clear_preferred_skills_failed', clearPreferredSkillsError.message)
        redirect(
          buildCreateErrorRedirect({
            message: clearPreferredSkillsError.message,
            reason: 'clear_preferred_skills_failed',
          })
        )
      }
      if (canonicalPreferredSkillIds.length > 0) {
        const { error: preferredSkillLinkError } = await supabaseAction.from('internship_preferred_skill_items').insert(
          canonicalPreferredSkillIds.map((skillId) => ({
            internship_id: persistedInternshipId,
            skill_id: skillId,
          }))
        )
        if (preferredSkillLinkError) {
          logPublishFailure('insert_preferred_skills_failed', preferredSkillLinkError.message)
          redirect(
            buildCreateErrorRedirect({
              message: preferredSkillLinkError.message,
              reason: 'insert_preferred_skills_failed',
            })
          )
        }
      }

      const { error: clearCourseCategoriesError } = await supabaseAction
        .from('internship_required_course_categories')
        .delete()
        .eq('internship_id', persistedInternshipId)
      if (clearCourseCategoriesError) {
        logPublishFailure('clear_course_categories_failed', clearCourseCategoriesError.message)
        redirect(
          buildCreateErrorRedirect({
            message: clearCourseCategoriesError.message,
            reason: 'clear_course_categories_failed',
          })
        )
      }
      if (selectedRequiredCourseCategoryIds.length > 0) {
        const { error: courseCategoryInsertError } = await supabaseAction
          .from('internship_required_course_categories')
          .insert(
            selectedRequiredCourseCategoryIds.map((categoryId) => ({
              internship_id: persistedInternshipId,
              category_id: categoryId,
            }))
          )
        if (courseCategoryInsertError) {
          logPublishFailure('insert_course_categories_failed', courseCategoryInsertError.message)
          redirect(
            buildCreateErrorRedirect({
              message: courseCategoryInsertError.message,
              reason: 'insert_course_categories_failed',
            })
          )
        }
      }

      const { error: clearMajorLinksError } = await supabaseAction
        .from('internship_major_links')
        .delete()
        .eq('internship_id', persistedInternshipId)
      if (clearMajorLinksError) {
        logPublishFailure('clear_major_links_failed', clearMajorLinksError.message)
        redirect(
          buildCreateErrorRedirect({
            message: clearMajorLinksError.message,
            reason: 'clear_major_links_failed',
          })
        )
      }
      if (selectedMajorIds.length > 0) {
        const { error: majorLinkInsertError } = await supabaseAction
          .from('internship_major_links')
          .insert(
            selectedMajorIds.map((majorId) => ({
              internship_id: persistedInternshipId,
              major_id: majorId,
            }))
          )
        if (majorLinkInsertError) {
          logPublishFailure('insert_major_links_failed', majorLinkInsertError.message)
          redirect(
            buildCreateErrorRedirect({
              message: majorLinkInsertError.message,
              reason: 'insert_major_links_failed',
            })
          )
        }
      }
    }

    const { data: persistedRow, error: persistedRowError } = await supabaseAction
      .from('internships')
      .select('id, employer_id, status, is_active')
      .eq('id', persistedInternshipId)
      .maybeSingle()

    if (persistedRowError || !persistedRow?.id) {
      logPublishFailure('post_write_lookup_failed', persistedRowError?.message ?? 'not_found')
      redirect(
        buildCreateErrorRedirect({
          message: 'Publish could not be confirmed. Please retry.',
          reason: 'post_write_lookup_failed',
        })
      )
    }

    console.info(
      '[internships.publish_owner_check] auth_uid=%s internship_id=%s persisted_employer_id=%s',
      currentUser.id,
      persistedRow.id,
      String(persistedRow.employer_id ?? '')
    )

    if (persistedRow.employer_id !== currentUser.id) {
      logPublishFailure(
        'owner_mismatch',
        `auth_uid=${currentUser.id} persisted_employer_id=${String(persistedRow.employer_id ?? '')}`
      )
      redirect(
        buildCreateErrorRedirect({
          message: 'Publish owner mismatch detected. Please contact support.',
          reason: 'owner_mismatch',
        })
      )
    }

    if (isPublishing && (persistedRow.status !== 'published' || persistedRow.is_active !== true)) {
      logPublishFailure(
        'post_write_state_mismatch',
        `status=${String(persistedRow.status)} is_active=${String(persistedRow.is_active)}`
      )
      redirect(
        buildCreateErrorRedirect({
          message: 'Publish did not complete correctly. Please retry.',
          reason: 'post_write_state_mismatch',
        })
      )
    }

    console.info(
      '[internships.publish_result] user_id=%s internship_id=%s employer_id=%s status=%s is_active=%s',
      currentUser.id,
      persistedRow.id,
      persistedRow.employer_id,
      String(persistedRow.status),
      String(persistedRow.is_active)
    )

    await trackAnalyticsEvent({
      eventName: isPublishing ? 'employer_listing_published' : 'employer_listing_draft_saved',
      userId: currentUser.id,
      properties: { internship_id: persistedInternshipId, mode: createMode },
    })

    revalidatePath('/dashboard/employer')
    revalidatePath('/dashboard/employer/new')

    if (internshipId.length > 0) {
      redirect(
        `/dashboard/employer?success=${isPublishing ? 'Listing+updated' : 'Draft+saved'}${
          isPublishing && draftId ? `&draft_cleared=${encodeURIComponent(draftId)}` : ''
        }${isPublishing ? `&published_id=${encodeURIComponent(persistedInternshipId)}` : ''}`
      )
    }
    if (isPublishing) {
      redirect(
        `/dashboard/employer?success=Internship+published&published_id=${encodeURIComponent(
          persistedInternshipId
        )}&draft_cleared=${encodeURIComponent(draftId || '')}`
      )
    }
    redirect('/dashboard/employer?success=Draft+saved')
  }

  async function publishDraft(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    if (!internshipId) redirect('/dashboard/employer?error=Missing+draft+id')

    const verificationGate = guardEmployerInternshipPublish(currentUser)
    if (!verificationGate.ok) {
      redirect(verificationGate.redirectTo)
    }

    const verification = await getEmployerVerificationStatus({ supabase: supabaseAction, userId: currentUser.id })
    const limit = verification.plan.maxActiveInternships

    const { data: draft } = await supabaseAction
      .from('internships')
      .select(
        'id, title, employer_id, work_mode, location_city, location_state, pay, pay_min, pay_max, hours_min, hours_max, term, majors, short_summary, description, target_student_year, target_student_years, desired_coursework_strength, remote_eligibility_scope, remote_eligible_states, remote_eligible_state, apply_mode, external_apply_url, is_active, status, internship_required_skill_items(skill_id), internship_required_course_categories(category_id)'
      )
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)
      .maybeSingle()

    if (!draft?.id) {
      redirect('/dashboard/employer?error=Draft+not+found')
    }

    let currentActive = 0
    try {
      currentActive = (await getEmployerInternshipCounts(supabaseAction, currentUser.id)).activeCount
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown'
      redirect(`/dashboard/employer?error=${encodeURIComponent(`Unable to verify plan capacity: ${message}`)}`)
    }

    const shouldCheckLimit = draft.status !== 'published' && !draft.is_active
    if (shouldCheckLimit && limit !== null && currentActive >= limit) {
      redirect(`/dashboard/employer?code=${PLAN_LIMIT_REACHED}&limit=${limit}&current=${currentActive}&reason=capacity_limit_reached`)
    }

    const requiredSkillIds = (draft.internship_required_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    const requiredCourseCategoryIds = (draft.internship_required_course_categories ?? [])
      .map((item) => item.category_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    const publishValidation = validateListingForPublish({
      title: draft.title,
      employerId: draft.employer_id,
      workMode: draft.work_mode,
      locationCity: draft.location_city,
      locationState: draft.location_state,
      payText: draft.pay,
      payMinHourly: draft.pay_min,
      payMaxHourly: draft.pay_max,
      hoursMin: draft.hours_min,
      hoursMax: draft.hours_max,
      term: draft.term,
      majors: draft.majors,
      shortSummary: draft.short_summary,
      description: draft.description,
      requiredSkillIds,
      requiredCourseCategoryIds,
      targetStudentYear: draft.target_student_year,
      targetStudentYears: Array.isArray(draft.target_student_years) ? draft.target_student_years : [],
      desiredCourseworkStrength: draft.desired_coursework_strength,
      remoteEligibleState: draft.remote_eligible_state,
      remoteEligibilityScope: draft.remote_eligibility_scope,
      remoteEligibleStates: Array.isArray(draft.remote_eligible_states) ? draft.remote_eligible_states : [],
      applyMode: draft.apply_mode,
      externalApplyUrl: draft.external_apply_url,
    })

    if (!publishValidation.ok) {
      redirect(`/dashboard/employer?create=1&edit=${encodeURIComponent(internshipId)}&code=${publishValidation.code}`)
    }

    const strictValidation = validateInternshipInput({
      work_mode: draft.work_mode,
      term: draft.term,
      hours_min: draft.hours_min,
      hours_max: draft.hours_max,
      location_city: draft.location_city,
      location_state: draft.location_state,
      required_skills: '',
      required_skill_ids: requiredSkillIds,
      required_course_category_ids: requiredCourseCategoryIds,
      target_student_year: draft.target_student_year,
      target_student_years: Array.isArray(draft.target_student_years) ? draft.target_student_years : [],
      desired_coursework_strength: draft.desired_coursework_strength,
      pay_min: draft.pay_min,
      pay_max: draft.pay_max,
      remote_eligible_state: draft.remote_eligible_state,
      remote_eligibility_scope: draft.remote_eligibility_scope,
      remote_eligible_states: Array.isArray(draft.remote_eligible_states) ? draft.remote_eligible_states : [],
    })
    if (!strictValidation.ok) {
      redirect(`/dashboard/employer?create=1&edit=${encodeURIComponent(internshipId)}&code=${strictValidation.code}`)
    }

    const { error } = await supabaseAction
      .from('internships')
      .update({ status: 'published', is_active: true })
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)
    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    const { data: persistedRow, error: persistedRowError } = await supabaseAction
      .from('internships')
      .select('id, employer_id, status, is_active')
      .eq('id', internshipId)
      .maybeSingle()
    if (persistedRowError || !persistedRow?.id) {
      redirect('/dashboard/employer?error=Publish+did+not+complete+correctly')
    }
    console.info(
      '[internships.publish_owner_check] auth_uid=%s internship_id=%s persisted_employer_id=%s',
      currentUser.id,
      persistedRow.id,
      String(persistedRow.employer_id ?? '')
    )
    if (persistedRow.employer_id !== currentUser.id) {
      redirect('/dashboard/employer?error=Publish+owner+mismatch+detected')
    }
    if (persistedRow.status !== 'published' || persistedRow.is_active !== true) {
      redirect('/dashboard/employer?error=Publish+did+not+complete+correctly')
    }

    console.info(
      '[internships.publish_result] user_id=%s internship_id=%s employer_id=%s status=%s is_active=%s',
      currentUser.id,
      persistedRow.id,
      persistedRow.employer_id,
      String(persistedRow.status),
      String(persistedRow.is_active)
    )

    await trackAnalyticsEvent({
      eventName: 'employer_listing_published',
      userId: currentUser.id,
      properties: { internship_id: internshipId, mode: 'publish_draft' },
    })

    revalidatePath('/dashboard/employer')
    revalidatePath('/dashboard/employer/new')

    redirect(
      `/dashboard/employer?success=Internship+published&published_id=${encodeURIComponent(
        internshipId
      )}&draft_cleared=${encodeURIComponent(internshipId)}`
    )
  }

  async function toggleInternshipActive(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const nextActive = String(formData.get('next_active') ?? '').trim() === '1'

    if (!internshipId) {
      redirect('/dashboard/employer?error=Missing+internship+id')
    }

    const { data: existingRow } = await supabaseAction
      .from('internships')
      .select('id, employer_id, is_active')
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)
      .maybeSingle()

    if (!existingRow?.id) {
      redirect('/dashboard/employer?error=Listing+not+found')
    }

    if (nextActive && !existingRow.is_active) {
      const verification = await getEmployerVerificationStatus({ supabase: supabaseAction, userId: currentUser.id })
      let currentActive = 0
      try {
        currentActive = (await getEmployerInternshipCounts(supabaseAction, currentUser.id)).activeCount
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown'
        redirect(`/dashboard/employer?error=${encodeURIComponent(`Unable to verify plan capacity: ${message}`)}`)
      }
      const limit = verification.plan.maxActiveInternships
      if (limit !== null && currentActive >= limit) {
        redirect(`/dashboard/employer?code=${PLAN_LIMIT_REACHED}&limit=${limit}&current=${currentActive}&reason=capacity_limit_reached`)
      }
    }

    const { error } = await supabaseAction
      .from('internships')
      .update({
        is_active: nextActive,
        status: nextActive ? 'published' : 'draft',
      })
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath('/dashboard/employer')
    redirect(`/dashboard/employer?success=Listing+${nextActive ? 'activated' : 'deactivated'}`)
  }

  async function deleteDraft(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    if (!internshipId) redirect('/dashboard/employer?error=Missing+draft+id')

    const { error } = await supabaseAction
      .from('internships')
      .delete()
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)
      .neq('status', 'published')

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    redirect(`/dashboard/employer?success=Draft+deleted&draft_cleared=${encodeURIComponent(internshipId)}`)
  }

  async function deletePublishedInternship(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer' })
    const supabaseAction = await supabaseServer()
    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const confirmationPhrase = String(formData.get('confirmation_phrase') ?? '').trim().toUpperCase()
    const acknowledged = String(formData.get('acknowledge_delete') ?? '').trim() === '1'

    if (!internshipId) {
      redirect('/dashboard/employer?error=Missing+internship+id')
    }
    if (!acknowledged || confirmationPhrase !== 'DELETE') {
      redirect('/dashboard/employer?error=Deletion+not+confirmed.+Please+check+the+box+and+type+DELETE')
    }

    const { error } = await supabaseAction
      .from('internships')
      .delete()
      .eq('id', internshipId)
      .eq('employer_id', currentUser.id)
      .eq('status', 'published')

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    redirect(`/dashboard/employer?success=Listing+deleted&draft_cleared=${encodeURIComponent(internshipId)}`)
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

  const isActuallyAtPlanLimit =
    plan.maxActiveInternships !== null && activeInternshipsCount >= plan.maxActiveInternships
  const rawCreateInternshipError = getCreateInternshipError(resolvedSearchParams)
  const createInternshipError =
    isPlanLimitReachedCode(resolvedSearchParams?.code) && !isActuallyAtPlanLimit ? null : rawCreateInternshipError
  const listingWizardServerError = createInternshipError
    ? {
        message: createInternshipError.message,
        code: typeof resolvedSearchParams?.code === 'string' ? resolvedSearchParams.code : null,
        field: createInternshipError.field ?? null,
        fields: createInternshipError.fields ?? null,
        reason: typeof resolvedSearchParams?.reason === 'string' ? resolvedSearchParams.reason : null,
        details: sanitizeErrorDetails(
          typeof resolvedSearchParams?.error === 'string' ? decodeURIComponent(resolvedSearchParams.error) : undefined
        ),
      }
    : null
  const showUpgradeModal = isPlanLimitReachedCode(resolvedSearchParams?.code) && isActuallyAtPlanLimit
  const internshipTotal = internshipCounts.totalCount
  const showCreateInternshipForm =
    createOnly ||
    resolvedSearchParams?.create === '1' ||
    Boolean(createInternshipError) ||
    Boolean(editingInternshipId)
  const isEditingListing = Boolean(editingInternship?.id)
  const employerBaseState = normalizeStateCode(String(employerProfile?.location_state ?? ''))
  const showConciergeForm =
    launchConciergeEnabled &&
    (resolvedSearchParams?.concierge === '1' ||
      resolvedSearchParams?.concierge_success === '1' ||
      Boolean(resolvedSearchParams?.concierge_error))
  const activeInternships = internships.filter((internship) => isEmployerInternshipActive(internship))
  const inactiveInternships = internships.filter((internship) => !isEmployerInternshipActive(internship))
  const activeInternshipItems: ActiveInternshipListItem[] = activeInternships.map((internship) => ({
    id: internship.id,
    title: internship.title,
    location: internship.location,
    stateLabel: formatListingState(internship),
    workMode: internship.work_mode,
    createdAtLabel: new Date(internship.created_at).toLocaleDateString(),
    targetYearsLabel: formatTargetStudentYears(internship.target_student_years ?? [internship.target_student_year]),
    majorsLabel: internship.majors ? formatMajors(internship.majors) : null,
  }))

  return (
    <main className="min-h-screen bg-white">
      <ListingDraftCleanup userId={user.id} clearedDraftId={String(resolvedSearchParams?.draft_cleared ?? '')} />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-3">
          {createOnly ? (
            <BackWithFallbackButton fallbackHref="/dashboard/employer" />
          ) : (
            <Link
              href="/"
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{createOnly ? (isEditingListing ? 'Edit internship' : 'Create new internship') : 'Employer dashboard'}</h1>
            <p className="mt-1 text-slate-600">
              {createOnly ? 'Share the core fields students scan first: work mode, pay, hours, timeline, and fit summary.' : 'Create internships and track what you have posted.'}
            </p>
          </div>
        </div>

        {!createOnly && resolvedSearchParams?.published_id ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Internship published.
            <Link href={`/jobs/${encodeURIComponent(resolvedSearchParams.published_id)}`} className="ml-2 font-medium underline">
              View listing
            </Link>
          </div>
        ) : null}
        {!createOnly && publishedOwnerMismatchMessage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {publishedOwnerMismatchMessage}
          </div>
        ) : null}

        {!createOnly ? (
        <div className="mt-5 grid gap-2 sm:ml-auto sm:max-w-md sm:grid-cols-2">
          <Link
            href="/dashboard/employer/applicants"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View applicants
          </Link>
          <Link
            href="/dashboard/employer/analytics"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Analytics
          </Link>
        </div>
        ) : null}

        {!createOnly ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">Your internships</h2>
              <p className="mt-1 text-xs text-slate-600">
                {isUnlimitedInternships(plan)
                  ? `Plan: ${plan.name}. Active internships: ${activeInternshipsCount}.`
                  : `Plan: ${plan.name}. Active: ${activeInternshipsCount}/${plan.maxActiveInternships}.`}
                <Link href="/upgrade" className="ml-1 font-medium text-slate-700 hover:underline">
                  {plan.id === 'free' ? 'Upgrade for more capacity.' : 'Manage plan.'}
                </Link>
              </p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <CreateInternshipCta
                atLimit={plan.maxActiveInternships !== null && activeInternshipsCount >= plan.maxActiveInternships}
                activeCount={activeInternshipsCount}
                planLimit={plan.maxActiveInternships}
              />
              <span className="text-xs text-slate-500 sm:text-right">{internshipTotal} total</span>
            </div>
          </div>

          {internships.length === 0 ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              You have not created any internships yet.
              <p className="mt-1 text-xs text-slate-500">Click “Create internship” to post your first role.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Active</h3>
                <ActiveInternshipsList
                  internships={activeInternshipItems}
                  toggleInternshipActiveAction={toggleInternshipActive}
                  deletePublishedInternshipAction={deletePublishedInternship}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Inactive</h3>
                {inactiveInternships.length === 0 ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No inactive listings.</div>
                ) : (
                  <div className="mt-2 grid gap-3">
                    {inactiveInternships.map((internship) => (
                      <div key={internship.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{internship.title || 'Untitled listing'}</div>
                            <div className="text-xs text-slate-500">
                              {formatListingState(internship)} •{' '}
                              Last updated: {internship.updated_at ? new Date(internship.updated_at).toLocaleString() : 'n/a'}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">Created: {new Date(internship.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/employer/new?edit=${encodeURIComponent(internship.id)}`}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </Link>
                          <form action={toggleInternshipActive}>
                            <input type="hidden" name="internship_id" value={internship.id} />
                            <input type="hidden" name="next_active" value="1" />
                            <button
                              type="submit"
                              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              Activate
                            </button>
                          </form>
                          <form action={deleteDraft}>
                            <input type="hidden" name="internship_id" value={internship.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        ) : null}

        {!createOnly && showConciergeForm ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Concierge post request</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Send us the internship details and our team will publish it for you.
                </p>
              </div>
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
            <ListingWizard
              formId="employer-create-internship-form"
              formAction={createInternship}
              internshipId={editingInternship?.id ?? ''}
              userId={user.id}
              draftId={editingInternship?.id ?? requestedDraftId ?? 'new'}
              clearOnSuccess={Boolean(resolvedSearchParams?.success)}
              serverError={listingWizardServerError}
              initialValues={{
                title: editingInternship?.title ?? '',
                companyName: editingInternship?.company_name ?? employerProfile?.company_name ?? '',
                category: editingInternship?.category ?? '',
                workMode: (editingInternship?.work_mode as 'on-site' | 'hybrid' | 'remote' | null) ?? 'hybrid',
                locationCity: editingInternship?.location_city ?? '',
                locationState: editingInternship?.location_state ?? '',
                applyMode:
                  (editingInternship?.apply_mode as 'native' | 'ats_link' | 'hybrid' | null) ??
                  (plan.id === 'free' ? 'native' : 'ats_link'),
                externalApplyUrl: editingInternship?.external_apply_url ?? '',
                externalApplyType: editingInternship?.external_apply_type ?? '',
                payType: 'hourly',
                payMin: String(editingInternship?.pay_min ?? '20'),
                payMax: String(editingInternship?.pay_max ?? '28'),
                hoursMin: String(editingInternship?.hours_min ?? '15'),
                hoursMax: String(editingInternship?.hours_max ?? '25'),
                durationWeeks: '12',
                startDate: '',
                applicationDeadline: editingInternship?.application_deadline ?? editingInternship?.apply_deadline ?? '',
                shortSummary: editingInternship?.short_summary ?? '',
                description: editingInternship?.description ?? '',
                responsibilities: Array.isArray(editingInternship?.responsibilities)
                  ? editingInternship.responsibilities.map((item) => `- ${item}`).join('\n')
                  : '',
                qualifications: Array.isArray(editingInternship?.qualifications)
                  ? editingInternship.qualifications.map((item) => `- ${item}`).join('\n')
                  : '',
                screeningQuestion: '',
                resumeRequired: editingInternship?.resume_required !== false,
                requiredSkillLabels: initialRequiredSkillLabels,
                preferredSkillLabels: Array.isArray(editingInternship?.preferred_skills) ? editingInternship.preferred_skills : [],
                majorLabels: initialMajorLabels,
                courseworkCategoryLabels: initialRequiredCourseCategoryLabels,
              }}
              categoryOptions={[...INTERNSHIP_CATEGORIES]}
              skillCatalog={skillCatalog}
              majorCatalog={canonicalMajorCatalog}
              courseworkCategoryCatalog={courseCategoryCatalog}
              employerBaseState={employerBaseState}
            />
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
