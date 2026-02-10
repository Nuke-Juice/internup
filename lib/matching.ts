export type WorkMode = 'remote' | 'hybrid' | 'on-site'

export type InternshipMatchInput = {
  id: string
  title?: string | null
  majors?: string[] | string | null
  target_graduation_years?: string[] | string | null
  hours_per_week?: number | null
  location?: string | null
  description?: string | null
  work_mode?: string | null
  term?: string | null
  experience_level?: string | null
  category?: string | null
  required_skills?: string[] | string | null
  preferred_skills?: string[] | string | null
  recommended_coursework?: string[] | string | null
  required_skill_ids?: string[] | null
  preferred_skill_ids?: string[] | null
  coursework_item_ids?: string[] | null
  coursework_category_ids?: string[] | null
  coursework_category_names?: string[] | null
}

export type StudentMatchProfile = {
  majors: string[]
  year?: string | null
  experience_level?: string | null
  skills?: string[]
  skill_ids?: string[]
  coursework_item_ids?: string[]
  coursework_category_ids?: string[]
  coursework?: string[]
  availability_hours_per_week?: number | null
  preferred_terms?: string[]
  preferred_locations?: string[]
  preferred_work_modes?: WorkMode[]
  remote_only?: boolean
}

export type MatchWeights = {
  skillsRequired: number
  skillsPreferred: number
  courseworkAlignment: number
  majorCategoryAlignment: number
  graduationYearAlignment: number
  experienceAlignment: number
  availability: number
  locationModePreference: number
}

export const DEFAULT_MATCHING_WEIGHTS: MatchWeights = {
  skillsRequired: 4,
  skillsPreferred: 2,
  courseworkAlignment: 1.5,
  majorCategoryAlignment: 3,
  graduationYearAlignment: 1.5,
  experienceAlignment: 1.5,
  availability: 2,
  locationModePreference: 1,
}

export const MATCHING_VERSION = 'v1.1'

export type InternshipMatchResult = {
  internshipId: string
  score: number
  reasons: string[]
  gaps: string[]
  eligible: boolean
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function parseMajors(value: string[] | string | null | undefined) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean)
  }

  return value
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

function parseList(value: string[] | string | null | undefined) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean)
  }

  return value
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

function parseWorkMode(value: string | null | undefined): WorkMode | null {
  if (!value) return null
  const normalized = normalizeText(value)

  if (normalized.includes('remote')) return 'remote'
  if (normalized.includes('hybrid')) return 'hybrid'
  if (normalized.includes('on-site') || normalized.includes('onsite') || normalized.includes('in person')) {
    return 'on-site'
  }

  return null
}

function deriveWorkMode(internship: InternshipMatchInput): WorkMode | null {
  const explicit = parseWorkMode(internship.work_mode)
  if (explicit) return explicit

  const location = internship.location ?? ''
  const modeMatch = location.match(/\(([^)]+)\)\s*$/)
  if (!modeMatch) return null

  return parseWorkMode(modeMatch[1])
}

function deriveTerm(internship: InternshipMatchInput) {
  if (internship.term && internship.term.trim().length > 0) {
    return normalizeText(internship.term)
  }

  const description = internship.description ?? ''
  const seasonLine = description.match(/^season:\s*(.+)$/im)
  if (!seasonLine) return ''

  return normalizeText(seasonLine[1])
}

function deriveLocationName(internship: InternshipMatchInput) {
  const location = internship.location ?? ''
  if (!location) return ''

  return normalizeText(location.replace(/\s*\([^)]*\)\s*$/, ''))
}

function seasonFromTerm(term: string) {
  if (!term) return ''
  if (term.includes('summer')) return 'summer'
  if (term.includes('fall')) return 'fall'
  if (term.includes('spring')) return 'spring'
  if (term.includes('winter')) return 'winter'
  if (term.includes('june') || term.includes('july') || term.includes('august') || term.includes('may')) return 'summer'
  if (term.includes('september') || term.includes('october') || term.includes('november')) return 'fall'
  if (term.includes('december') || term.includes('january') || term.includes('february')) return 'winter'
  if (term.includes('march') || term.includes('april')) return 'spring'
  return term
}

function inferSkills(internship: InternshipMatchInput) {
  const requiredIds = Array.from(new Set((internship.required_skill_ids ?? []).filter(Boolean)))
  const preferredIds = Array.from(new Set((internship.preferred_skill_ids ?? []).filter(Boolean)))
  const required = parseList(internship.required_skills)
  const preferred = parseList(internship.preferred_skills)

  const description = internship.description ?? ''
  const requiredMatch = description.match(/^required skills?:\s*(.+)$/im)
  const preferredMatch = description.match(/^preferred skills?:\s*(.+)$/im)

  const requiredFromDescription = requiredMatch ? parseList(requiredMatch[1]) : []
  const preferredFromDescription = preferredMatch ? parseList(preferredMatch[1]) : []

  return {
    requiredIds,
    preferredIds,
    required: [...new Set([...required, ...requiredFromDescription])],
    preferred: [...new Set([...preferred, ...preferredFromDescription])],
  }
}

function overlapCount(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0

  const rightSet = new Set(right)
  return left.filter((item) => rightSet.has(item)).length
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return numerator / denominator
}

function describeReason(label: string, points: number, details: string) {
  return `${label}: ${details} (+${points.toFixed(1)})`
}

function mapGap(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeGradYearToken(value: string) {
  return normalizeText(value).replace(/\s+/g, '')
}

function parseInternshipExperienceLevel(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizeText(value)
  if (normalized === 'entry') return 0
  if (normalized === 'mid') return 1
  if (normalized === 'senior') return 2
  return null
}

function parseStudentExperienceLevel(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizeText(value)
  if (normalized === 'none') return 0
  if (normalized === 'projects') return 1
  if (normalized === 'internship') return 2
  return null
}

export function evaluateInternshipMatch(
  internship: InternshipMatchInput,
  profile: StudentMatchProfile,
  weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS
): InternshipMatchResult {
  const reasons: Array<{ text: string; points: number }> = []
  const gaps: string[] = []

  const workMode = deriveWorkMode(internship)
  const term = deriveTerm(internship)
  const locationName = deriveLocationName(internship)

  const preferredModes = profile.preferred_work_modes ?? []
  const preferredTerms = (profile.preferred_terms ?? []).map((value) => seasonFromTerm(normalizeText(value)))
  const preferredLocations = (profile.preferred_locations ?? []).map(normalizeText)

  const internshipIsInPerson = workMode === 'on-site' || workMode === 'hybrid'

  if (profile.remote_only && internshipIsInPerson) {
    return {
      internshipId: internship.id,
      score: 0,
      reasons: [],
      gaps: ['Requires in-person work but your profile is remote-only.'],
      eligible: false,
    }
  }

  if (preferredModes.length > 0 && workMode && !preferredModes.includes(workMode)) {
    return {
      internshipId: internship.id,
      score: 0,
      reasons: [],
      gaps: [`Work mode mismatch (${workMode}).`],
      eligible: false,
    }
  }

  if (preferredTerms.length > 0 && term) {
    const internshipSeason = seasonFromTerm(term)
    const hasTermOverlap = preferredTerms.includes(internshipSeason)
    if (!hasTermOverlap) {
      return {
        internshipId: internship.id,
        score: 0,
        reasons: [],
        gaps: [`Term mismatch (${term}).`],
        eligible: false,
      }
    }
  }

  if (
    typeof internship.hours_per_week === 'number' &&
    typeof profile.availability_hours_per_week === 'number' &&
    internship.hours_per_week > profile.availability_hours_per_week
  ) {
    return {
      internshipId: internship.id,
      score: 0,
      reasons: [],
      gaps: [
        `Hours exceed availability (${internship.hours_per_week} > ${profile.availability_hours_per_week} hrs/week).`,
      ],
      eligible: false,
    }
  }

  if (internshipIsInPerson && preferredLocations.length > 0 && locationName) {
    const matchesPreferredLocation = preferredLocations.some(
      (preferred) => locationName.includes(preferred) || preferred.includes(locationName)
    )

    if (!matchesPreferredLocation) {
      return {
        internshipId: internship.id,
        score: 0,
        reasons: [],
        gaps: [`In-person location mismatch (${locationName}).`],
        eligible: false,
      }
    }
  }

  const studentMajors = profile.majors.map(normalizeText).filter(Boolean)
  const studentYear = normalizeGradYearToken(profile.year ?? '')
  const studentExperienceLevel = parseStudentExperienceLevel(profile.experience_level)
  const internshipMajors = parseMajors(internship.majors)
  const targetGradYears = parseList(internship.target_graduation_years).map(normalizeGradYearToken)
  const internshipExperienceLevel = parseInternshipExperienceLevel(internship.experience_level)
  const internshipCategory = internship.category ? normalizeText(internship.category) : internshipMajors[0] ?? ''

  const studentSkills = [
    ...(profile.skills ?? []),
    ...(profile.coursework ?? []),
    ...studentMajors,
  ]
    .map(normalizeText)
    .filter(Boolean)
  const studentSkillIds = Array.from(new Set((profile.skill_ids ?? []).filter(Boolean)))
  const studentCourseworkIds = Array.from(new Set((profile.coursework_item_ids ?? []).filter(Boolean)))
  const studentCourseworkCategoryIds = Array.from(new Set((profile.coursework_category_ids ?? []).filter(Boolean)))

  const { requiredIds, preferredIds, required, preferred } = inferSkills(internship)

  if (requiredIds.length > 0 && studentSkillIds.length > 0) {
    const requiredHits = overlapCount(requiredIds, studentSkillIds)
    const requiredRatio = ratio(requiredHits, requiredIds.length)
    const points = weights.skillsRequired * requiredRatio
    if (requiredHits > 0) {
      reasons.push({
        text: describeReason('Required skills', points, `${requiredHits}/${requiredIds.length} matched`),
        points,
      })
    }

    const missingRequiredCount = Math.max(0, requiredIds.length - requiredHits)
    if (missingRequiredCount > 0) {
      gaps.push(`Missing required skills: ${missingRequiredCount} canonical skill(s)`)
    }
  } else if (required.length > 0) {
    const requiredHits = overlapCount(required, studentSkills)
    const requiredRatio = ratio(requiredHits, required.length)
    const points = weights.skillsRequired * requiredRatio
    if (requiredHits > 0) {
      reasons.push(
        {
          text: describeReason('Required skills', points, `${requiredHits}/${required.length} matched`),
          points,
        }
      )
    }

    const missingRequired = required.filter((skill) => !studentSkills.includes(skill))
    if (missingRequired.length > 0) {
      gaps.push(`Missing required skills: ${missingRequired.join(', ')}`)
    }
  }

  if (preferredIds.length > 0 && studentSkillIds.length > 0) {
    const preferredHits = overlapCount(preferredIds, studentSkillIds)
    const preferredRatio = ratio(preferredHits, preferredIds.length)
    const points = weights.skillsPreferred * preferredRatio
    if (preferredHits > 0) {
      reasons.push({
        text: describeReason('Preferred skills', points, `${preferredHits}/${preferredIds.length} matched`),
        points,
      })
    }
  } else if (preferred.length > 0) {
    const preferredHits = overlapCount(preferred, studentSkills)
    const preferredRatio = ratio(preferredHits, preferred.length)
    const points = weights.skillsPreferred * preferredRatio
    if (preferredHits > 0) {
      reasons.push(
        {
          text: describeReason('Preferred skills', points, `${preferredHits}/${preferred.length} matched`),
          points,
        }
      )
    }
  }

  const recommendedCourseworkCategoryIds = Array.from(new Set((internship.coursework_category_ids ?? []).filter(Boolean)))
  const recommendedCourseworkCategoryNames = Array.from(new Set(parseList(internship.coursework_category_names)))

  if (recommendedCourseworkCategoryIds.length > 0 && studentCourseworkCategoryIds.length > 0) {
    const categoryHits = overlapCount(recommendedCourseworkCategoryIds, studentCourseworkCategoryIds)
    const categoryRatio = ratio(categoryHits, recommendedCourseworkCategoryIds.length)
    const points = weights.courseworkAlignment * categoryRatio
    if (categoryHits > 0) {
      const categoryDetail =
        recommendedCourseworkCategoryNames.length > 0
          ? recommendedCourseworkCategoryNames.slice(0, categoryHits).join(', ')
          : `${categoryHits}/${recommendedCourseworkCategoryIds.length} category matches`
      reasons.push({
        text: describeReason('Coursework categories', points, categoryDetail),
        points,
      })
    }
  } else {
    const recommendedCourseworkIds = Array.from(new Set((internship.coursework_item_ids ?? []).filter(Boolean)))
    if (recommendedCourseworkIds.length > 0 && studentCourseworkIds.length > 0) {
      const courseworkHits = overlapCount(recommendedCourseworkIds, studentCourseworkIds)
      const courseworkRatio = ratio(courseworkHits, recommendedCourseworkIds.length)
      const points = weights.courseworkAlignment * courseworkRatio
      if (courseworkHits > 0) {
        reasons.push({
          text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCourseworkIds.length} matched`),
          points,
        })
      }
    } else {
      const recommendedCoursework = parseList(internship.recommended_coursework)
      const studentCoursework = parseList(profile.coursework)
      if (recommendedCoursework.length > 0 && studentCoursework.length > 0) {
        const courseworkHits = overlapCount(recommendedCoursework, studentCoursework)
        const courseworkRatio = ratio(courseworkHits, recommendedCoursework.length)
        const points = weights.courseworkAlignment * courseworkRatio
        if (courseworkHits > 0) {
          reasons.push({
            text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCoursework.length} matched`),
            points,
          })
        }
      }
    }
  }

  if (targetGradYears.length > 0 && studentYear) {
    const yearMatch = targetGradYears.includes(studentYear)
    if (!yearMatch) {
      return {
        internshipId: internship.id,
        score: 0,
        reasons: [],
        gaps: [`Graduation year mismatch (${profile.year ?? 'unknown'}).`],
        eligible: false,
      }
    }

    reasons.push({
      text: describeReason('Graduation year fit', weights.graduationYearAlignment, profile.year ?? studentYear),
      points: weights.graduationYearAlignment,
    })
  }

  if (internshipExperienceLevel !== null && studentExperienceLevel !== null) {
    if (studentExperienceLevel < internshipExperienceLevel) {
      return {
        internshipId: internship.id,
        score: 0,
        reasons: [],
        gaps: [
          `Experience mismatch (requires ${internship.experience_level}, profile is ${profile.experience_level ?? 'unknown'}).`,
        ],
        eligible: false,
      }
    }

    reasons.push({
      text: describeReason('Experience alignment', weights.experienceAlignment, profile.experience_level ?? 'aligned'),
      points: weights.experienceAlignment,
    })
  }

  if (studentMajors.length > 0) {
    const majorHits = overlapCount(internshipMajors, studentMajors)
    const categoryHit = internshipCategory && studentMajors.some((major) => internshipCategory.includes(major))
    const alignmentRatio = majorHits > 0 ? ratio(majorHits, Math.max(1, internshipMajors.length)) : categoryHit ? 0.5 : 0
    const points = weights.majorCategoryAlignment * alignmentRatio

    if (points > 0) {
      reasons.push({
        text: describeReason(
          'Major/category alignment',
          points,
          majorHits > 0 ? `${majorHits} major overlap` : `category match (${internshipCategory})`
        ),
        points,
      })
    } else {
      gaps.push('No major/category alignment')
    }
  }

  if (
    typeof internship.hours_per_week === 'number' &&
    typeof profile.availability_hours_per_week === 'number'
  ) {
    const diff = Math.abs(internship.hours_per_week - profile.availability_hours_per_week)
    const closeness = Math.max(0, 1 - diff / Math.max(1, profile.availability_hours_per_week))
    const points = weights.availability * closeness

    if (points > 0) {
      reasons.push({
        text: describeReason('Availability fit', points, `${internship.hours_per_week} hrs/week`),
        points,
      })
    }
  }

  if (workMode) {
    const modePreferenceHit = preferredModes.length === 0 || preferredModes.includes(workMode)
    const points = modePreferenceHit ? weights.locationModePreference : 0

    if (points > 0) {
      reasons.push({
        text: describeReason('Work mode fit', points, workMode),
        points,
      })
    }
  }

  const totalScore = reasons.reduce((sum, reason) => sum + reason.points, 0)

  const topReasons = reasons
    .sort((a, b) => b.points - a.points)
    .map((reason) => reason.text)

  return {
    internshipId: internship.id,
    score: Number(totalScore.toFixed(3)),
    reasons: topReasons,
    gaps: gaps.map(mapGap),
    eligible: true,
  }
}

export function rankInternships(
  internships: InternshipMatchInput[],
  profile: StudentMatchProfile,
  weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS
) {
  return internships
    .map((internship) => ({
      internship,
      match: evaluateInternshipMatch(internship, profile, weights),
    }))
    .filter((item) => item.match.eligible)
    .sort((left, right) => {
      if (right.match.score !== left.match.score) return right.match.score - left.match.score
      const leftCreatedAt = new Date((left.internship as { created_at?: string | null }).created_at ?? 0).getTime()
      const rightCreatedAt = new Date((right.internship as { created_at?: string | null }).created_at ?? 0).getTime()
      return rightCreatedAt - leftCreatedAt
    })
}
