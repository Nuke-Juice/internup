import {
  evaluateInternshipMatch,
  MATCHING_VERSION,
  type InternshipMatchInput,
  type StudentMatchProfile,
  type WorkMode,
} from '@/lib/matching'

type SnapshotInternship = {
  id: string
  title?: string | null
  majors?: string[] | string | null
  hours_per_week?: number | null
  location?: string | null
  description?: string | null
  work_mode?: string | null
  term?: string | null
  role_category?: string | null
  required_skills?: string[] | string | null
  preferred_skills?: string[] | string | null
}

type SnapshotProfile = {
  majors?: string[] | string | null
  skills?: string[] | string | null
  coursework?: string[] | string | null
  availability_start_month?: string | null
  availability_hours_per_week?: number | null
  preferred_terms?: string[] | string | null
  preferred_locations?: string[] | string | null
  preferred_work_modes?: string[] | string | null
  remote_only?: boolean | null
} | null

export type ApplicationMatchSnapshot = {
  match_score: number
  match_reasons: string[]
  match_gaps: string[]
  matching_version: string
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function asStringArray(value: string[] | string | null | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function asWorkModes(value: string[] | string | null | undefined): WorkMode[] {
  return asStringArray(value)
    .map((item) => normalizeText(item))
    .map((item): WorkMode | null => {
      if (item.includes('remote')) return 'remote'
      if (item.includes('hybrid')) return 'hybrid'
      if (item.includes('on-site') || item.includes('onsite') || item.includes('in person')) return 'on-site'
      return null
    })
    .filter((item): item is WorkMode => item !== null)
}

function seasonFromMonth(value: string | null | undefined) {
  const normalized = normalizeText(value ?? '')
  if (normalized.startsWith('jun') || normalized.startsWith('jul') || normalized.startsWith('aug')) return 'summer'
  if (normalized.startsWith('sep') || normalized.startsWith('oct') || normalized.startsWith('nov')) return 'fall'
  if (normalized.startsWith('dec') || normalized.startsWith('jan') || normalized.startsWith('feb')) return 'winter'
  if (normalized.startsWith('mar') || normalized.startsWith('apr') || normalized.startsWith('may')) return 'spring'
  return ''
}

export function buildApplicationMatchSnapshot(input: {
  internship: SnapshotInternship
  profile: SnapshotProfile
}): ApplicationMatchSnapshot {
  const internshipInput: InternshipMatchInput = {
    id: input.internship.id,
    title: input.internship.title ?? null,
    majors: input.internship.majors ?? null,
    hours_per_week: input.internship.hours_per_week ?? null,
    location: input.internship.location ?? null,
    description: input.internship.description ?? null,
    work_mode: input.internship.work_mode ?? null,
    term: input.internship.term ?? null,
    category: input.internship.role_category ?? null,
    required_skills: input.internship.required_skills ?? null,
    preferred_skills: input.internship.preferred_skills ?? null,
  }

  const profileInput: StudentMatchProfile = {
    // If explicit preferred terms are unavailable, map availability month to a seasonal preference.
    preferred_terms: (() => {
      const explicit = asStringArray(input.profile?.preferred_terms ?? null)
      if (explicit.length > 0) return explicit
      const fallbackSeason = seasonFromMonth(input.profile?.availability_start_month ?? null)
      return fallbackSeason ? [fallbackSeason] : []
    })(),
    majors: asStringArray(input.profile?.majors ?? null),
    skills: asStringArray(input.profile?.skills ?? null),
    coursework: asStringArray(input.profile?.coursework ?? null),
    availability_hours_per_week: input.profile?.availability_hours_per_week ?? null,
    preferred_locations: asStringArray(input.profile?.preferred_locations ?? null),
    preferred_work_modes: asWorkModes(input.profile?.preferred_work_modes ?? null),
    remote_only: Boolean(input.profile?.remote_only),
  }

  const match = evaluateInternshipMatch(internshipInput, profileInput)

  return {
    match_score: Math.round(match.score),
    match_reasons: match.reasons,
    match_gaps: match.gaps,
    matching_version: MATCHING_VERSION,
  }
}
