export const MINIMUM_PROFILE_FIELDS = [
  'school',
  'major',
  'availability_start_month',
  'availability_hours_per_week',
] as const

export type MinimumProfileField = (typeof MINIMUM_PROFILE_FIELDS)[number]

export type MinimumProfileInput = {
  school?: string | null
  major_id?: string | null
  majors?: string[] | string | null
  availability_start_month?: string | null
  availability_hours_per_week?: number | string | null
}

export type MinimumProfileCompleteness = {
  ok: boolean
  missing: MinimumProfileField[]
}

const MINIMUM_PROFILE_LABELS: Record<MinimumProfileField, string> = {
  school: 'School',
  major: 'Major',
  availability_start_month: 'Availability start month',
  availability_hours_per_week: 'Availability hours per week',
}

function parseMajors(value: MinimumProfileInput['majors']) {
  if (Array.isArray(value)) {
    return value.map((major) => String(major).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((major) => major.trim())
      .filter(Boolean)
  }

  return []
}

function hasPositiveHours(value: MinimumProfileInput['availability_hours_per_week']) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed > 0
  }
  return false
}

export function getMinimumProfileCompleteness(profile: MinimumProfileInput | null): MinimumProfileCompleteness {
  if (!profile) {
    return { ok: false, missing: [...MINIMUM_PROFILE_FIELDS] }
  }

  const majors = parseMajors(profile.majors)

  const checks: Record<MinimumProfileField, boolean> = {
    school: typeof profile.school === 'string' && profile.school.trim().length > 0,
    major: (typeof profile.major_id === 'string' && profile.major_id.trim().length > 0) || majors.length > 0,
    availability_start_month:
      typeof profile.availability_start_month === 'string' && profile.availability_start_month.trim().length > 0,
    availability_hours_per_week: hasPositiveHours(profile.availability_hours_per_week),
  }

  const missing = MINIMUM_PROFILE_FIELDS.filter((field) => !checks[field])
  return { ok: missing.length === 0, missing }
}

export function getMinimumProfileFieldLabel(field: MinimumProfileField) {
  return MINIMUM_PROFILE_LABELS[field]
}

export function normalizeMissingProfileFields(input: string | null | undefined): MinimumProfileField[] {
  if (!input) return []

  const values = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const unique = new Set(values)
  return MINIMUM_PROFILE_FIELDS.filter((field) => unique.has(field))
}
