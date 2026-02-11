import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_MATCHING_WEIGHTS,
  MATCH_SIGNAL_DEFINITIONS,
  MATCH_SIGNAL_KEYS,
  MATCHING_VERSION,
  evaluateInternshipMatch,
  getMatchMaxScore,
  parseMajors,
  rankInternships,
  type InternshipMatchInput,
  type MatchSignalKey,
  type StudentMatchProfile,
} from '../matching.ts'
import { parseStudentPreferenceSignals } from '../student/preferenceSignals.ts'

export type MatchingPreviewFilters = {
  category?: string
  remote?: 'all' | 'remote_only'
  term?: string
}

export type MatchingCoverage = {
  totalDimensions: number
  presentDimensions: number
  missingDimensions: string[]
}

export type AdminStudentPreviewOption = {
  userId: string
  name: string
  email: string
  school: string | null
  majorLabel: string
  year: string | null
  experienceLevel: string | null
  canonicalSkillLabels: string[]
  courseworkCategoryNames: string[]
  preferredTerms: string[]
  preferredWorkModes: string[]
  preferredLocations: string[]
  coverage: MatchingCoverage
  profile: StudentMatchProfile
}

export type AdminInternshipPreviewItem = {
  id: string
  title: string | null
  companyName: string | null
  category: string | null
  roleCategory: string | null
  experienceLevel: string | null
  location: string | null
  workMode: string | null
  term: string | null
  requiredSkills: string[]
  preferredSkills: string[]
  recommendedCoursework: string[]
  majors: string[]
  targetGraduationYears: string[]
  hoursPerWeek: number | null
  coverage: MatchingCoverage
  matchInput: InternshipMatchInput
}

export type AdminPreviewRankedItem = {
  internship: AdminInternshipPreviewItem
  match: ReturnType<typeof evaluateInternshipMatch>
}

type StudentProfileRow = {
  user_id: string
  school: string | null
  year: string | null
  experience_level: string | null
  interests: string | null
  majors: string[] | string | null
  major?: { name?: string | null } | Array<{ name?: string | null }> | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
}

type StudentSkillRow = {
  student_id: string | null
  skill_id: string | null
  skill?: { label?: string | null } | Array<{ label?: string | null }> | null
}

type StudentCourseworkCategoryRow = {
  student_id: string | null
  category_id: string | null
  category?: { name?: string | null } | Array<{ name?: string | null }> | null
}

type StudentCourseworkItemRow = {
  student_id: string | null
  coursework_item_id: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  company_name: string | null
  description: string | null
  majors: string[] | string | null
  target_graduation_years: string[] | null
  experience_level: string | null
  role_category: string | null
  category: string | null
  hours_per_week: number | null
  location: string | null
  work_mode: string | null
  term: string | null
  required_skills: string[] | null
  preferred_skills: string[] | null
  recommended_coursework: string[] | null
  location_city: string | null
  location_state: string | null
  remote_allowed: boolean | null
  internship_required_skill_items?: Array<{ skill_id: string | null }> | null
  internship_preferred_skill_items?: Array<{ skill_id: string | null }> | null
  internship_coursework_items?: Array<{ coursework_item_id: string | null }> | null
  internship_coursework_category_links?: Array<{ category_id: string | null; category?: { name?: string | null } | null }> | null
}

function canonicalMajorName(value: unknown) {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as { name?: unknown } | undefined
    return typeof first?.name === 'string' ? first.name : null
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { name?: unknown }
    return typeof maybe.name === 'string' ? maybe.name : null
  }
  return null
}

function nameFromAuthMetadata(input: { firstName?: string; lastName?: string; email?: string; fallbackId: string }) {
  const first = input.firstName?.trim() ?? ''
  const last = input.lastName?.trim() ?? ''
  const joined = `${first} ${last}`.trim()
  if (joined) return joined
  const emailName = input.email?.split('@')[0]?.trim()
  if (emailName) return emailName
  return `Student ${input.fallbackId.slice(0, 8)}`
}

function seasonFromMonth(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.startsWith('jun') || normalized.startsWith('jul') || normalized.startsWith('aug')) return 'summer'
  if (normalized.startsWith('sep') || normalized.startsWith('oct') || normalized.startsWith('nov')) return 'fall'
  if (normalized.startsWith('dec') || normalized.startsWith('jan') || normalized.startsWith('feb')) return 'winter'
  if (normalized.startsWith('mar') || normalized.startsWith('apr') || normalized.startsWith('may')) return 'spring'
  return ''
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function extractLabel(value: { name?: string | null } | { label?: string | null } | null | undefined) {
  if (!value) return ''
  if ('name' in value) return typeof value.name === 'string' ? value.name.trim() : ''
  if ('label' in value) return typeof value.label === 'string' ? value.label.trim() : ''
  return ''
}

function buildStudentCoverage(params: {
  majors: string[]
  year: string | null
  experienceLevel: string | null
  preferredTerms: string[]
  availabilityHours: number | null
  preferredLocations: string[]
  preferredWorkModes: string[]
  skillCount: number
  courseworkCategoryCount: number
}) {
  const checks = [
    ['majors', params.majors.length > 0],
    ['skills', params.skillCount > 0],
    ['coursework categories', params.courseworkCategoryCount > 0],
    ['term', params.preferredTerms.length > 0],
    ['hours', typeof params.availabilityHours === 'number' && params.availabilityHours > 0],
    ['location/work mode', params.preferredLocations.length > 0 || params.preferredWorkModes.length > 0],
    ['grad year', typeof params.year === 'string' && params.year.trim().length > 0],
    ['experience', typeof params.experienceLevel === 'string' && params.experienceLevel.trim().length > 0],
  ] as const

  return {
    totalDimensions: checks.length,
    presentDimensions: checks.filter(([, ok]) => ok).length,
    missingDimensions: checks.filter(([, ok]) => !ok).map(([label]) => label),
  }
}

function buildInternshipCoverage(internship: InternshipRow) {
  const majors = parseMajors(internship.majors)
  const requiredSkillCount = internship.required_skills?.length ?? 0
  const preferredSkillCount = internship.preferred_skills?.length ?? 0
  const courseworkCategoryCount = (internship.internship_coursework_category_links ?? []).filter((item) => item.category_id).length

  const checks = [
    ['majors', majors.length > 0],
    ['skills', requiredSkillCount + preferredSkillCount > 0],
    ['coursework categories', courseworkCategoryCount > 0],
    ['term', Boolean(internship.term?.trim())],
    ['hours', typeof internship.hours_per_week === 'number' && internship.hours_per_week > 0],
    ['location/remote', Boolean(internship.remote_allowed) || Boolean(internship.location_city?.trim() || internship.location_state?.trim())],
    ['grad year', Array.isArray(internship.target_graduation_years) && internship.target_graduation_years.length > 0],
    ['experience', Boolean(internship.experience_level?.trim())],
  ] as const

  return {
    totalDimensions: checks.length,
    presentDimensions: checks.filter(([, ok]) => ok).length,
    missingDimensions: checks.filter(([, ok]) => !ok).map(([label]) => label),
  }
}

function toInternshipPreviewItem(row: InternshipRow): AdminInternshipPreviewItem {
  const courseworkCategoryNames = (row.internship_coursework_category_links ?? [])
    .map((item) => extractLabel(item.category ?? null))
    .filter(Boolean)

  const matchInput: InternshipMatchInput = {
    id: row.id,
    title: row.title,
    description: row.description,
    majors: row.majors,
    target_graduation_years: row.target_graduation_years,
    experience_level: row.experience_level,
    category: row.role_category ?? row.category,
    hours_per_week: row.hours_per_week,
    location: row.location,
    work_mode: row.work_mode,
    term: row.term,
    required_skills: row.required_skills,
    preferred_skills: row.preferred_skills,
    recommended_coursework: row.recommended_coursework,
    required_skill_ids: (row.internship_required_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((value): value is string => typeof value === 'string'),
    preferred_skill_ids: (row.internship_preferred_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((value): value is string => typeof value === 'string'),
    coursework_item_ids: (row.internship_coursework_items ?? [])
      .map((item) => item.coursework_item_id)
      .filter((value): value is string => typeof value === 'string'),
    coursework_category_ids: (row.internship_coursework_category_links ?? [])
      .map((item) => item.category_id)
      .filter((value): value is string => typeof value === 'string'),
    coursework_category_names: courseworkCategoryNames,
  }

  return {
    id: row.id,
    title: row.title,
    companyName: row.company_name,
    category: row.category,
    roleCategory: row.role_category,
    experienceLevel: row.experience_level,
    location: row.location,
    workMode: row.work_mode,
    term: row.term,
    requiredSkills: row.required_skills ?? [],
    preferredSkills: row.preferred_skills ?? [],
    recommendedCoursework: row.recommended_coursework ?? [],
    majors: parseMajors(row.majors),
    targetGraduationYears: row.target_graduation_years ?? [],
    hoursPerWeek: row.hours_per_week,
    coverage: buildInternshipCoverage(row),
    matchInput,
  }
}

export async function loadAdminStudentPreviewOptions(admin: SupabaseClient, query: string) {
  const { data: studentRowsData } = await admin
    .from('student_profiles')
    .select('user_id, school, major:canonical_majors(name), majors, year, experience_level, interests, availability_start_month, availability_hours_per_week')
    .limit(250)

  const studentRows = (studentRowsData ?? []) as StudentProfileRow[]

  const [skillRowsResult, courseworkCategoryRowsResult, courseworkItemRowsResult] = await Promise.all([
    admin
      .from('student_skill_items')
      .select('student_id, skill_id, skill:skills(label)')
      .in('student_id', studentRows.map((row) => row.user_id)),
    admin
      .from('student_coursework_category_links')
      .select('student_id, category_id, category:coursework_categories(name)')
      .in('student_id', studentRows.map((row) => row.user_id)),
    admin
      .from('student_coursework_items')
      .select('student_id, coursework_item_id')
      .in('student_id', studentRows.map((row) => row.user_id)),
  ])

  const skillRows = (skillRowsResult.data ?? []) as StudentSkillRow[]
  const courseworkCategoryRows = (courseworkCategoryRowsResult.data ?? []) as StudentCourseworkCategoryRow[]
  const courseworkItemRows = (courseworkItemRowsResult.data ?? []) as StudentCourseworkItemRow[]

  const skillIdsByStudent = new Map<string, string[]>()
  const skillLabelsByStudent = new Map<string, string[]>()
  for (const row of skillRows) {
    const studentId = row.student_id
    if (!studentId) continue
    if (typeof row.skill_id === 'string') {
      const values = skillIdsByStudent.get(studentId) ?? []
      values.push(row.skill_id)
      skillIdsByStudent.set(studentId, values)
    }
    const labels = asArray(row.skill).map((item) => extractLabel(item)).filter(Boolean)
    if (labels.length > 0) {
      const values = skillLabelsByStudent.get(studentId) ?? []
      values.push(...labels)
      skillLabelsByStudent.set(studentId, values)
    }
  }

  const courseworkCategoryIdsByStudent = new Map<string, string[]>()
  const courseworkCategoryNamesByStudent = new Map<string, string[]>()
  for (const row of courseworkCategoryRows) {
    const studentId = row.student_id
    if (!studentId) continue
    if (typeof row.category_id === 'string') {
      const values = courseworkCategoryIdsByStudent.get(studentId) ?? []
      values.push(row.category_id)
      courseworkCategoryIdsByStudent.set(studentId, values)
    }
    const names = asArray(row.category).map((item) => extractLabel(item)).filter(Boolean)
    if (names.length > 0) {
      const values = courseworkCategoryNamesByStudent.get(studentId) ?? []
      values.push(...names)
      courseworkCategoryNamesByStudent.set(studentId, values)
    }
  }

  const courseworkItemIdsByStudent = new Map<string, string[]>()
  for (const row of courseworkItemRows) {
    const studentId = row.student_id
    if (!studentId || typeof row.coursework_item_id !== 'string') continue
    const values = courseworkItemIdsByStudent.get(studentId) ?? []
    values.push(row.coursework_item_id)
    courseworkItemIdsByStudent.set(studentId, values)
  }

  const authUsersEntries = await Promise.all(
    studentRows.map(async (student) => {
      const { data: authData } = await admin.auth.admin.getUserById(student.user_id)
      return [student.user_id, authData.user] as const
    })
  )
  const authUserByStudentId = new Map(authUsersEntries)

  const rows = studentRows.map((row) => {
    const authUser = authUserByStudentId.get(row.user_id)
    const metadata = (authUser?.user_metadata ?? {}) as { first_name?: string; last_name?: string }
    const majorName = canonicalMajorName(row.major)
    const majors = majorName ? parseMajors([majorName]) : parseMajors(row.majors)
    const preferenceSignals = parseStudentPreferenceSignals(row.interests)
    const fallbackSeason = seasonFromMonth(row.availability_start_month)
    const preferredTerms =
      preferenceSignals.preferredTerms.length > 0
        ? preferenceSignals.preferredTerms
        : fallbackSeason
          ? [fallbackSeason]
          : []

    const skillIds = Array.from(new Set(skillIdsByStudent.get(row.user_id) ?? []))
    const courseworkCategoryIds = Array.from(new Set(courseworkCategoryIdsByStudent.get(row.user_id) ?? []))
    const courseworkItemIds = Array.from(new Set(courseworkItemIdsByStudent.get(row.user_id) ?? []))
    const skillLabels = Array.from(new Set(skillLabelsByStudent.get(row.user_id) ?? []))
    const courseworkCategoryNames = Array.from(new Set(courseworkCategoryNamesByStudent.get(row.user_id) ?? []))

    const coverage = buildStudentCoverage({
      majors,
      year: row.year,
      experienceLevel: row.experience_level,
      preferredTerms,
      availabilityHours: row.availability_hours_per_week,
      preferredLocations: preferenceSignals.preferredLocations,
      preferredWorkModes: preferenceSignals.preferredWorkModes,
      skillCount: skillIds.length,
      courseworkCategoryCount: courseworkCategoryIds.length,
    })

    const profile: StudentMatchProfile = {
      majors,
      year: row.year,
      experience_level: row.experience_level,
      skills: preferenceSignals.skills,
      skill_ids: skillIds,
      coursework_item_ids: courseworkItemIds,
      coursework_category_ids: courseworkCategoryIds,
      coursework: [],
      availability_hours_per_week: row.availability_hours_per_week,
      preferred_terms: preferredTerms,
      preferred_locations: preferenceSignals.preferredLocations,
      preferred_work_modes: preferenceSignals.preferredWorkModes,
      remote_only: preferenceSignals.remoteOnly,
    }

    return {
      userId: row.user_id,
      name: nameFromAuthMetadata({
        firstName: metadata.first_name,
        lastName: metadata.last_name,
        email: authUser?.email,
        fallbackId: row.user_id,
      }),
      email: authUser?.email ?? 'Email not set',
      school: row.school,
      majorLabel: majors[0] ?? 'Major not set',
      year: row.year,
      experienceLevel: row.experience_level,
      canonicalSkillLabels: skillLabels,
      courseworkCategoryNames,
      preferredTerms,
      preferredWorkModes: preferenceSignals.preferredWorkModes,
      preferredLocations: preferenceSignals.preferredLocations,
      coverage,
      profile,
    } satisfies AdminStudentPreviewOption
  })

  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return rows.sort((a, b) => a.email.localeCompare(b.email)).slice(0, 150)
  }

  return rows
    .filter((row) => {
      const haystack = [row.name, row.email, row.school ?? '', row.majorLabel, row.year ?? '', row.userId].join(' ').toLowerCase()
      return haystack.includes(normalizedQuery)
    })
    .sort((a, b) => a.email.localeCompare(b.email))
    .slice(0, 150)
}

export async function loadAdminInternshipPreviewItems(
  admin: SupabaseClient,
  filters: MatchingPreviewFilters,
  options?: { includeInactive?: boolean; internshipId?: string | null }
) {
  let query = admin
    .from('internships')
    .select(
      'id, title, company_name, description, majors, target_graduation_years, experience_level, role_category, category, hours_per_week, location, location_city, location_state, remote_allowed, work_mode, term, required_skills, preferred_skills, recommended_coursework, is_active, internship_required_skill_items(skill_id), internship_preferred_skill_items(skill_id), internship_coursework_items(coursework_item_id), internship_coursework_category_links(category_id, category:coursework_categories(name))'
    )
    .order('created_at', { ascending: false })
    .limit(600)

  if (!options?.includeInactive) {
    query = query.eq('is_active', true)
  }

  if (options?.internshipId) {
    query = query.eq('id', options.internshipId)
  }

  const { data } = await query
  const rows = (data ?? []) as InternshipRow[]

  const normalizedCategory = (filters.category ?? '').trim().toLowerCase()
  const normalizedTerm = (filters.term ?? '').trim().toLowerCase()

  return rows
    .filter((row) => {
      if (normalizedCategory) {
        const rowCategory = (row.category ?? row.role_category ?? '').trim().toLowerCase()
        if (!rowCategory.includes(normalizedCategory)) return false
      }
      if (filters.remote === 'remote_only') {
        const workMode = (row.work_mode ?? '').toLowerCase()
        const location = (row.location ?? '').toLowerCase()
        const isRemote = workMode.includes('remote') || location.includes('remote') || Boolean(row.remote_allowed)
        if (!isRemote) return false
      }
      if (normalizedTerm) {
        const rowTerm = (row.term ?? '').trim().toLowerCase()
        if (!rowTerm.includes(normalizedTerm)) return false
      }
      return true
    })
    .map(toInternshipPreviewItem)
}

export function rankInternshipsForStudentPreview(
  internships: AdminInternshipPreviewItem[],
  studentProfile: StudentMatchProfile,
  options: { explain?: boolean } = {}
): AdminPreviewRankedItem[] {
  const ranked = rankInternships(
    internships.map((item) => item.matchInput),
    studentProfile,
    DEFAULT_MATCHING_WEIGHTS,
    { explain: options.explain }
  )

  const internshipById = new Map(internships.map((item) => [item.id, item]))
  return ranked
    .map((item) => {
      const internship = internshipById.get(item.internship.id)
      if (!internship) return null
      return {
        internship,
        match: item.match,
      }
    })
    .filter((item): item is AdminPreviewRankedItem => item !== null)
}

export function evaluateSinglePreviewMatch(internship: AdminInternshipPreviewItem, studentProfile: StudentMatchProfile) {
  return evaluateInternshipMatch(internship.matchInput, studentProfile, DEFAULT_MATCHING_WEIGHTS, { explain: true })
}

export function getMatchingReportSummary() {
  const maxScore = getMatchMaxScore(DEFAULT_MATCHING_WEIGHTS)
  return {
    matchingVersion: MATCHING_VERSION,
    signalKeys: [...MATCH_SIGNAL_KEYS],
    signalDefinitions: MATCH_SIGNAL_DEFINITIONS,
    weights: DEFAULT_MATCHING_WEIGHTS,
    maxScore,
    normalizationFormula: 'normalizedScore = totalScore / maxScore',
  }
}

export function buildSignalContributionRows(match: ReturnType<typeof evaluateInternshipMatch>) {
  const rows = match.breakdown?.perSignalContributions ?? []
  return rows.map((row) => ({
    signalKey: row.signalKey,
    weight: row.weight,
    rawMatchValue: row.rawMatchValue,
    pointsAwarded: row.pointsAwarded,
    evidence: row.evidence,
  }))
}

export function expectedSignalKeys() {
  return [...MATCH_SIGNAL_KEYS] as MatchSignalKey[]
}
