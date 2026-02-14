export const INTERNSHIP_VALIDATION_ERROR = {
  WORK_MODE_REQUIRED: 'WORK_MODE_REQUIRED',
  TERM_REQUIRED: 'TERM_REQUIRED',
  INVALID_HOURS_RANGE: 'INVALID_HOURS_RANGE',
  LOCATION_REQUIRED: 'LOCATION_REQUIRED',
  REQUIRED_SKILLS_MISSING: 'REQUIRED_SKILLS_MISSING',
  REQUIRED_COURSE_CATEGORIES_MISSING: 'REQUIRED_COURSE_CATEGORIES_MISSING',
  TARGET_STUDENT_YEAR_REQUIRED: 'TARGET_STUDENT_YEAR_REQUIRED',
  COURSEWORK_STRENGTH_REQUIRED: 'COURSEWORK_STRENGTH_REQUIRED',
  INVALID_PAY_RANGE: 'INVALID_PAY_RANGE',
  REMOTE_ELIGIBILITY_REQUIRED: 'REMOTE_ELIGIBILITY_REQUIRED',
  DEADLINE_INVALID: 'DEADLINE_INVALID',
} as const

export type InternshipValidationErrorCode =
  (typeof INTERNSHIP_VALIDATION_ERROR)[keyof typeof INTERNSHIP_VALIDATION_ERROR]

export type InternshipValidationInput = {
  work_mode: string | null
  term: string | null
  hours_min: number | null
  hours_max: number | null
  location_city: string | null
  location_state: string | null
  required_skills: string[] | string | null
  required_skill_ids?: string[] | string | null
  required_course_category_ids?: string[] | string | null
  target_student_year?: string | null
  target_student_years?: string[] | null
  desired_coursework_strength?: string | null
  pay_min?: number | null
  pay_max?: number | null
  remote_eligible_state?: string | null
  remote_eligibility_scope?: string | null
  remote_eligible_states?: string[] | string | null
  application_deadline?: string | null
}

const MIN_HOURS = 1
const MAX_HOURS = 80

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim()
}

function parseList(value: string[] | string | null | undefined) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean)
  }
  return value
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

function parseDateOnly(value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function todayUtcDateOnly(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function validateInternshipInput(
  input: InternshipValidationInput,
  options?: { now?: Date }
):
  | { ok: true }
  | {
      ok: false
      code: InternshipValidationErrorCode
    } {
  const workMode = normalizeText(input.work_mode).toLowerCase()
  const term = normalizeText(input.term)
  const locationCity = normalizeText(input.location_city)
  const locationState = normalizeText(input.location_state)
  const remoteEligibleState = normalizeText(input.remote_eligible_state).toUpperCase()
  const remoteEligibilityScope = normalizeText(input.remote_eligibility_scope).toLowerCase()
  const remoteEligibleStates = parseList(input.remote_eligible_states ?? null)
  const deadline = normalizeText(input.application_deadline)

  if (!workMode) {
    return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.WORK_MODE_REQUIRED }
  }

  if (workMode !== 'remote' && workMode !== 'hybrid' && workMode !== 'on-site') {
    return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.WORK_MODE_REQUIRED }
  }

  if (!term) {
    return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.TERM_REQUIRED }
  }

  if (
    typeof input.hours_min !== 'number' ||
    typeof input.hours_max !== 'number' ||
    !Number.isFinite(input.hours_min) ||
    !Number.isFinite(input.hours_max) ||
    input.hours_min < MIN_HOURS ||
    input.hours_max < MIN_HOURS ||
    input.hours_min > MAX_HOURS ||
    input.hours_max > MAX_HOURS ||
    input.hours_min > input.hours_max
  ) {
    return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.INVALID_HOURS_RANGE }
  }

  if ((workMode === 'hybrid' || workMode === 'on-site') && (!locationCity || !locationState)) {
    return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.LOCATION_REQUIRED }
  }

  if (
    typeof input.pay_min !== 'number' ||
    typeof input.pay_max !== 'number' ||
    !Number.isFinite(input.pay_min) ||
    !Number.isFinite(input.pay_max) ||
    input.pay_min < 0 ||
    input.pay_max < input.pay_min
  ) {
    return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.INVALID_PAY_RANGE }
  }
  if (workMode === 'remote' || workMode === 'hybrid') {
    if (!remoteEligibleState && remoteEligibilityScope === 'us_states' && remoteEligibleStates.length === 0) {
      return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.REMOTE_ELIGIBILITY_REQUIRED }
    }
  }

  if (deadline) {
    const parsedDeadline = parseDateOnly(deadline)
    if (!parsedDeadline) {
      return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.DEADLINE_INVALID }
    }

    const now = options?.now ?? new Date()
    const today = todayUtcDateOnly(now)
    if (parsedDeadline.getTime() < today.getTime()) {
      return { ok: false, code: INTERNSHIP_VALIDATION_ERROR.DEADLINE_INVALID }
    }
  }

  return { ok: true }
}
