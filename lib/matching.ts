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

export const MATCH_SIGNAL_KEYS = [
  'skillsRequired',
  'skillsPreferred',
  'courseworkAlignment',
  'majorCategoryAlignment',
  'graduationYearAlignment',
  'experienceAlignment',
  'availability',
  'locationModePreference',
] as const

export type MatchSignalKey = (typeof MATCH_SIGNAL_KEYS)[number]

export const MATCH_SIGNAL_DEFINITIONS: Record<MatchSignalKey, { label: string; description: string }> = {
  skillsRequired: {
    label: 'Required skills',
    description: 'Core required skills overlap (canonical IDs first, then text fallback).',
  },
  skillsPreferred: {
    label: 'Preferred skills',
    description: 'Optional preferred skills overlap (canonical IDs first, then text fallback).',
  },
  courseworkAlignment: {
    label: 'Coursework alignment',
    description: 'Coursework category/item overlap (category IDs first, then item IDs, then text fallback).',
  },
  majorCategoryAlignment: {
    label: 'Major/category alignment',
    description: 'Student major alignment with internship majors or category text.',
  },
  graduationYearAlignment: {
    label: 'Graduation year fit',
    description: 'Target graduation year compatibility (hard filter when target years are set).',
  },
  experienceAlignment: {
    label: 'Experience alignment',
    description: 'Experience level compatibility (hard filter when required level is set).',
  },
  availability: {
    label: 'Availability fit',
    description: 'Hours per week closeness to student availability.',
  },
  locationModePreference: {
    label: 'Location/mode fit',
    description: 'Work mode preference match (includes remote-only and location hard filters).',
  },
}

export const DEFAULT_MATCHING_WEIGHTS: MatchWeights = {
  skillsRequired: 4,
  skillsPreferred: 2,
  courseworkAlignment: 1.5,
  majorCategoryAlignment: 3.5,
  graduationYearAlignment: 1.5,
  experienceAlignment: 1.5,
  availability: 2,
  locationModePreference: 1,
}

export const MATCHING_VERSION = 'v1.1'

export type MatchReason = {
  reasonKey: string
  humanText: string
  evidence: string[]
}

export type MatchSignalContribution = {
  signalKey: MatchSignalKey
  weight: number
  rawMatchValue: number
  pointsAwarded: number
  evidence: string[]
}

export type InternshipMatchBreakdown = {
  totalScore: number
  maxScore: number
  normalizedScore: number
  perSignalContributions: MatchSignalContribution[]
  reasons: MatchReason[]
}

export type InternshipMatchResult = {
  internshipId: string
  score: number
  reasons: string[]
  gaps: string[]
  eligible: boolean
  matchingVersion: string
  maxScore: number
  normalizedScore: number
  breakdown?: InternshipMatchBreakdown
}

export type EvaluateMatchOptions = {
  explain?: boolean
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

export function getMatchMaxScore(weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS) {
  return MATCH_SIGNAL_KEYS.reduce((sum, signalKey) => sum + Math.max(0, weights[signalKey]), 0)
}

function emptySignalContributions(weights: MatchWeights): Record<MatchSignalKey, MatchSignalContribution> {
  return {
    skillsRequired: {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    skillsPreferred: {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    courseworkAlignment: {
      signalKey: 'courseworkAlignment',
      weight: weights.courseworkAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    majorCategoryAlignment: {
      signalKey: 'majorCategoryAlignment',
      weight: weights.majorCategoryAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    graduationYearAlignment: {
      signalKey: 'graduationYearAlignment',
      weight: weights.graduationYearAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    experienceAlignment: {
      signalKey: 'experienceAlignment',
      weight: weights.experienceAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    availability: {
      signalKey: 'availability',
      weight: weights.availability,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    locationModePreference: {
      signalKey: 'locationModePreference',
      weight: weights.locationModePreference,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
  }
}

function finalizeMatchResult(params: {
  internshipId: string
  reasonsWithPoints: Array<{ text: string; points: number; reasonKey: string; evidence: string[] }>
  gaps: string[]
  eligible: boolean
  explain: boolean
  signalContributions: Record<MatchSignalKey, MatchSignalContribution>
  weights: MatchWeights
}) {
  const totalScore = MATCH_SIGNAL_KEYS.reduce((sum, signalKey) => sum + params.signalContributions[signalKey].pointsAwarded, 0)
  const maxScore = getMatchMaxScore(params.weights)
  const normalizedScore = maxScore > 0 ? totalScore / maxScore : 0

  const sortedReasons = [...params.reasonsWithPoints].sort((a, b) => b.points - a.points)

  const result: InternshipMatchResult = {
    internshipId: params.internshipId,
    score: Number(totalScore.toFixed(3)),
    reasons: sortedReasons.map((reason) => reason.text),
    gaps: params.gaps.map(mapGap),
    eligible: params.eligible,
    matchingVersion: MATCHING_VERSION,
    maxScore: Number(maxScore.toFixed(3)),
    normalizedScore: Number(normalizedScore.toFixed(4)),
  }

  if (params.explain) {
    const breakdownReasons: MatchReason[] = sortedReasons.map((reason) => ({
      reasonKey: reason.reasonKey,
      humanText: reason.text,
      evidence: reason.evidence,
    }))

    result.breakdown = {
      totalScore: Number(totalScore.toFixed(3)),
      maxScore: Number(maxScore.toFixed(3)),
      normalizedScore: Number(normalizedScore.toFixed(4)),
      perSignalContributions: MATCH_SIGNAL_KEYS.map((signalKey) => ({
        ...params.signalContributions[signalKey],
        pointsAwarded: Number(params.signalContributions[signalKey].pointsAwarded.toFixed(3)),
        rawMatchValue: Number(params.signalContributions[signalKey].rawMatchValue.toFixed(4)),
      })),
      reasons: breakdownReasons,
    }
  }

  return result
}

export function evaluateInternshipMatch(
  internship: InternshipMatchInput,
  profile: StudentMatchProfile,
  weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS,
  options: EvaluateMatchOptions = {}
): InternshipMatchResult {
  const explain = options.explain === true
  const reasonsWithPoints: Array<{ text: string; points: number; reasonKey: string; evidence: string[] }> = []
  const gaps: string[] = []
  const signalContributions = emptySignalContributions(weights)

  const workMode = deriveWorkMode(internship)
  const term = deriveTerm(internship)
  const locationName = deriveLocationName(internship)

  const preferredModes = profile.preferred_work_modes ?? []
  const preferredTerms = (profile.preferred_terms ?? []).map((value) => seasonFromTerm(normalizeText(value)))
  const preferredLocations = (profile.preferred_locations ?? []).map(normalizeText)

  const internshipIsInPerson = workMode === 'on-site' || workMode === 'hybrid'

  if (profile.remote_only && internshipIsInPerson) {
    gaps.push('Requires in-person work but your profile is remote-only.')
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
    })
  }

  if (preferredModes.length > 0 && workMode && !preferredModes.includes(workMode)) {
    gaps.push(`Work mode mismatch (${workMode}).`)
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
    })
  }

  if (preferredTerms.length > 0 && term) {
    const internshipSeason = seasonFromTerm(term)
    const hasTermOverlap = preferredTerms.includes(internshipSeason)
    if (!hasTermOverlap) {
      gaps.push(`Term mismatch (${term}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }
  }

  if (
    typeof internship.hours_per_week === 'number' &&
    typeof profile.availability_hours_per_week === 'number' &&
    internship.hours_per_week > profile.availability_hours_per_week
  ) {
    gaps.push(`Hours exceed availability (${internship.hours_per_week} > ${profile.availability_hours_per_week} hrs/week).`)
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
    })
  }

  if (internshipIsInPerson && preferredLocations.length > 0 && locationName) {
    const matchesPreferredLocation = preferredLocations.some(
      (preferred) => locationName.includes(preferred) || preferred.includes(locationName)
    )

    if (!matchesPreferredLocation) {
      gaps.push(`In-person location mismatch (${locationName}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
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
    signalContributions.skillsRequired = {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: requiredRatio,
      pointsAwarded: points,
      evidence: [`${requiredHits}/${requiredIds.length} canonical required skill IDs matched`],
    }

    if (requiredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.required.canonical_overlap',
        text: describeReason('Required skills', points, `${requiredHits}/${requiredIds.length} matched`),
        points,
        evidence: [`matched=${requiredHits}`, `required=${requiredIds.length}`],
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
    signalContributions.skillsRequired = {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: requiredRatio,
      pointsAwarded: points,
      evidence: [`${requiredHits}/${required.length} required skill tokens matched`],
    }

    if (requiredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.required.text_overlap',
        text: describeReason('Required skills', points, `${requiredHits}/${required.length} matched`),
        points,
        evidence: [`matched=${requiredHits}`, `required=${required.length}`],
      })
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
    signalContributions.skillsPreferred = {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: preferredRatio,
      pointsAwarded: points,
      evidence: [`${preferredHits}/${preferredIds.length} canonical preferred skill IDs matched`],
    }

    if (preferredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.preferred.canonical_overlap',
        text: describeReason('Preferred skills', points, `${preferredHits}/${preferredIds.length} matched`),
        points,
        evidence: [`matched=${preferredHits}`, `preferred=${preferredIds.length}`],
      })
    }
  } else if (preferred.length > 0) {
    const preferredHits = overlapCount(preferred, studentSkills)
    const preferredRatio = ratio(preferredHits, preferred.length)
    const points = weights.skillsPreferred * preferredRatio
    signalContributions.skillsPreferred = {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: preferredRatio,
      pointsAwarded: points,
      evidence: [`${preferredHits}/${preferred.length} preferred skill tokens matched`],
    }

    if (preferredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.preferred.text_overlap',
        text: describeReason('Preferred skills', points, `${preferredHits}/${preferred.length} matched`),
        points,
        evidence: [`matched=${preferredHits}`, `preferred=${preferred.length}`],
      })
    }
  }

  const recommendedCourseworkCategoryIds = Array.from(new Set((internship.coursework_category_ids ?? []).filter(Boolean)))
  const recommendedCourseworkCategoryNames = Array.from(new Set(parseList(internship.coursework_category_names)))

  if (recommendedCourseworkCategoryIds.length > 0 && studentCourseworkCategoryIds.length > 0) {
    const categoryHits = overlapCount(recommendedCourseworkCategoryIds, studentCourseworkCategoryIds)
    const categoryRatio = ratio(categoryHits, recommendedCourseworkCategoryIds.length)
    const points = weights.courseworkAlignment * categoryRatio
    signalContributions.courseworkAlignment = {
      signalKey: 'courseworkAlignment',
      weight: weights.courseworkAlignment,
      rawMatchValue: categoryRatio,
      pointsAwarded: points,
      evidence: [`${categoryHits}/${recommendedCourseworkCategoryIds.length} coursework categories matched`],
    }

    if (categoryHits > 0) {
      const categoryDetail =
        recommendedCourseworkCategoryNames.length > 0
          ? recommendedCourseworkCategoryNames.slice(0, categoryHits).join(', ')
          : `${categoryHits}/${recommendedCourseworkCategoryIds.length} category matches`
      reasonsWithPoints.push({
        reasonKey: 'coursework.categories.canonical_overlap',
        text: describeReason('Coursework categories', points, categoryDetail),
        points,
        evidence: recommendedCourseworkCategoryNames.slice(0, categoryHits),
      })
    }
  } else {
    const recommendedCourseworkIds = Array.from(new Set((internship.coursework_item_ids ?? []).filter(Boolean)))
    if (recommendedCourseworkIds.length > 0 && studentCourseworkIds.length > 0) {
      const courseworkHits = overlapCount(recommendedCourseworkIds, studentCourseworkIds)
      const courseworkRatio = ratio(courseworkHits, recommendedCourseworkIds.length)
      const points = weights.courseworkAlignment * courseworkRatio
      signalContributions.courseworkAlignment = {
        signalKey: 'courseworkAlignment',
        weight: weights.courseworkAlignment,
        rawMatchValue: courseworkRatio,
        pointsAwarded: points,
        evidence: [`${courseworkHits}/${recommendedCourseworkIds.length} coursework items matched`],
      }

      if (courseworkHits > 0) {
        reasonsWithPoints.push({
          reasonKey: 'coursework.items.canonical_overlap',
          text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCourseworkIds.length} matched`),
          points,
          evidence: [`matched=${courseworkHits}`, `recommended=${recommendedCourseworkIds.length}`],
        })
      }
    } else {
      const recommendedCoursework = parseList(internship.recommended_coursework)
      const studentCoursework = parseList(profile.coursework)
      if (recommendedCoursework.length > 0 && studentCoursework.length > 0) {
        const courseworkHits = overlapCount(recommendedCoursework, studentCoursework)
        const courseworkRatio = ratio(courseworkHits, recommendedCoursework.length)
        const points = weights.courseworkAlignment * courseworkRatio
        signalContributions.courseworkAlignment = {
          signalKey: 'courseworkAlignment',
          weight: weights.courseworkAlignment,
          rawMatchValue: courseworkRatio,
          pointsAwarded: points,
          evidence: [`${courseworkHits}/${recommendedCoursework.length} coursework text tokens matched`],
        }

        if (courseworkHits > 0) {
          reasonsWithPoints.push({
            reasonKey: 'coursework.text_overlap',
            text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCoursework.length} matched`),
            points,
            evidence: [`matched=${courseworkHits}`, `recommended=${recommendedCoursework.length}`],
          })
        }
      }
    }
  }

  if (targetGradYears.length > 0 && studentYear) {
    const yearMatch = targetGradYears.includes(studentYear)
    signalContributions.graduationYearAlignment = {
      signalKey: 'graduationYearAlignment',
      weight: weights.graduationYearAlignment,
      rawMatchValue: yearMatch ? 1 : 0,
      pointsAwarded: yearMatch ? weights.graduationYearAlignment : 0,
      evidence: [`student_year=${profile.year ?? studentYear}`, `target_years=${targetGradYears.join('|')}`],
    }

    if (!yearMatch) {
      gaps.push(`Graduation year mismatch (${profile.year ?? 'unknown'}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }

    reasonsWithPoints.push({
      reasonKey: 'graduation_year.fit',
      text: describeReason('Graduation year fit', weights.graduationYearAlignment, profile.year ?? studentYear),
      points: weights.graduationYearAlignment,
      evidence: [`student_year=${profile.year ?? studentYear}`],
    })
  }

  if (internshipExperienceLevel !== null && studentExperienceLevel !== null) {
    const passes = studentExperienceLevel >= internshipExperienceLevel
    signalContributions.experienceAlignment = {
      signalKey: 'experienceAlignment',
      weight: weights.experienceAlignment,
      rawMatchValue: passes ? 1 : 0,
      pointsAwarded: passes ? weights.experienceAlignment : 0,
      evidence: [
        `student_level=${profile.experience_level ?? 'unknown'}`,
        `required_level=${internship.experience_level ?? 'unknown'}`,
      ],
    }

    if (!passes) {
      gaps.push(`Experience mismatch (requires ${internship.experience_level}, profile is ${profile.experience_level ?? 'unknown'}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }

    reasonsWithPoints.push({
      reasonKey: 'experience.fit',
      text: describeReason('Experience alignment', weights.experienceAlignment, profile.experience_level ?? 'aligned'),
      points: weights.experienceAlignment,
      evidence: [`student_level=${profile.experience_level ?? 'unknown'}`],
    })
  }

  if (studentMajors.length > 0) {
    const majorHits = overlapCount(internshipMajors, studentMajors)
    const categoryHit = internshipCategory && studentMajors.some((major) => internshipCategory.includes(major))
    const alignmentRatio = majorHits > 0 ? ratio(majorHits, Math.max(1, internshipMajors.length)) : categoryHit ? 0.5 : 0
    const points = weights.majorCategoryAlignment * alignmentRatio
    signalContributions.majorCategoryAlignment = {
      signalKey: 'majorCategoryAlignment',
      weight: weights.majorCategoryAlignment,
      rawMatchValue: alignmentRatio,
      pointsAwarded: points,
      evidence: majorHits > 0 ? [`major_hits=${majorHits}/${Math.max(1, internshipMajors.length)}`] : categoryHit ? [`category_hit=${internshipCategory}`] : [],
    }

    if (points > 0) {
      reasonsWithPoints.push({
        reasonKey: majorHits > 0 ? 'major.overlap' : 'major.category_fallback',
        text: describeReason(
          'Major/category alignment',
          points,
          majorHits > 0 ? `${majorHits} major overlap` : `category match (${internshipCategory})`
        ),
        points,
        evidence: majorHits > 0 ? [`major_hits=${majorHits}`] : [`category=${internshipCategory}`],
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
    signalContributions.availability = {
      signalKey: 'availability',
      weight: weights.availability,
      rawMatchValue: closeness,
      pointsAwarded: points,
      evidence: [`hours_diff=${diff}`, `student_hours=${profile.availability_hours_per_week}`],
    }

    if (points > 0) {
      reasonsWithPoints.push({
        reasonKey: 'availability.fit',
        text: describeReason('Availability fit', points, `${internship.hours_per_week} hrs/week`),
        points,
        evidence: [`internship_hours=${internship.hours_per_week}`],
      })
    }
  }

  if (workMode) {
    const modePreferenceHit = preferredModes.length === 0 || preferredModes.includes(workMode)
    const points = modePreferenceHit ? weights.locationModePreference : 0
    signalContributions.locationModePreference = {
      signalKey: 'locationModePreference',
      weight: weights.locationModePreference,
      rawMatchValue: modePreferenceHit ? 1 : 0,
      pointsAwarded: points,
      evidence: [`work_mode=${workMode}`],
    }

    if (points > 0) {
      reasonsWithPoints.push({
        reasonKey: 'location_mode.fit',
        text: describeReason('Work mode fit', points, workMode),
        points,
        evidence: [`work_mode=${workMode}`],
      })
    }
  }

  return finalizeMatchResult({
    internshipId: internship.id,
    reasonsWithPoints,
    gaps,
    eligible: true,
    explain,
    signalContributions,
    weights,
  })
}

export function rankInternships(
  internships: InternshipMatchInput[],
  profile: StudentMatchProfile,
  weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS,
  options: EvaluateMatchOptions = {}
) {
  return internships
    .map((internship) => ({
      internship,
      match: evaluateInternshipMatch(internship, profile, weights, options),
    }))
    .filter((item) => item.match.eligible)
    .sort((left, right) => {
      if (right.match.score !== left.match.score) return right.match.score - left.match.score
      const leftCreatedAt = new Date((left.internship as { created_at?: string | null }).created_at ?? 0).getTime()
      const rightCreatedAt = new Date((right.internship as { created_at?: string | null }).created_at ?? 0).getTime()
      return rightCreatedAt - leftCreatedAt
    })
}
