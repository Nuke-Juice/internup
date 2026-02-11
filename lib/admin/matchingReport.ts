import { DEFAULT_MATCHING_WEIGHTS, evaluateInternshipMatch } from '../matching.ts'
import { mockInternships, mockStudents } from '../matching.fixtures.ts'
import { getMatchingReportSummary } from './matchingPreview.ts'

export const MATCHING_CANONICAL_ENUMS = {
  experienceLevelsInternship: ['entry', 'mid', 'senior'],
  experienceLevelsStudent: ['none', 'projects', 'internship'],
  workModes: ['remote', 'hybrid', 'on-site'],
  termSeasons: ['spring', 'summer', 'fall', 'winter'],
}

export type MatchingDataSourceField = {
  field: string
  usedFor: string
  sourceTable: string
  sourceColumn: string
  notes: string
}

export const MATCHING_DATA_SOURCES: MatchingDataSourceField[] = [
  {
    field: 'Student majors',
    usedFor: 'Major/category alignment',
    sourceTable: 'student_profiles + canonical_majors',
    sourceColumn: 'student_profiles.major_id / student_profiles.majors',
    notes: 'Canonical major relation first, text fallback if needed.',
  },
  {
    field: 'Student grad year',
    usedFor: 'Graduation-year eligibility + scoring',
    sourceTable: 'student_profiles',
    sourceColumn: 'year',
    notes: 'Compared against internship target years.',
  },
  {
    field: 'Student experience',
    usedFor: 'Experience eligibility + scoring',
    sourceTable: 'student_profiles',
    sourceColumn: 'experience_level',
    notes: 'Mapped to ordinal levels none/projects/internship.',
  },
  {
    field: 'Student availability',
    usedFor: 'Hours eligibility + availability fit',
    sourceTable: 'student_profiles',
    sourceColumn: 'availability_hours_per_week',
    notes: 'Hard-filter if internship hours exceed availability.',
  },
  {
    field: 'Student preferred terms/work mode/location',
    usedFor: 'Eligibility + location/mode scoring',
    sourceTable: 'student_profiles',
    sourceColumn: 'interests JSON',
    notes: 'Parsed via preference signal parser with month fallback for terms.',
  },
  {
    field: 'Student canonical skills',
    usedFor: 'Required/preferred skill overlap',
    sourceTable: 'student_skill_items + skills',
    sourceColumn: 'student_skill_items.skill_id',
    notes: 'Canonical skill IDs are primary matching path.',
  },
  {
    field: 'Student canonical coursework categories',
    usedFor: 'Coursework alignment (primary)',
    sourceTable: 'student_coursework_category_links + coursework_categories',
    sourceColumn: 'category_id',
    notes: 'Category overlap is preferred over coursework-item or text overlap.',
  },
  {
    field: 'Student canonical coursework items',
    usedFor: 'Coursework alignment (secondary)',
    sourceTable: 'student_coursework_items + coursework_items',
    sourceColumn: 'coursework_item_id',
    notes: 'Used when category IDs are not available on either side.',
  },
  {
    field: 'Internship majors/category',
    usedFor: 'Major/category alignment',
    sourceTable: 'internships',
    sourceColumn: 'majors, category, role_category',
    notes: 'Major overlap first, category text fallback.',
  },
  {
    field: 'Internship required/preferred skills',
    usedFor: 'Skills alignment',
    sourceTable: 'internships + internship_*_skill_items',
    sourceColumn: 'required_skills, preferred_skills, skill_id links',
    notes: 'Canonical IDs first; text lines in description are also parsed.',
  },
  {
    field: 'Internship coursework categories/items',
    usedFor: 'Coursework alignment',
    sourceTable: 'internships + internship_coursework_* links',
    sourceColumn: 'coursework_category_ids, coursework_item_ids, recommended_coursework',
    notes: 'Order: category IDs -> item IDs -> text.',
  },
  {
    field: 'Internship term/work mode/location/hours',
    usedFor: 'Eligibility + fit scoring',
    sourceTable: 'internships',
    sourceColumn: 'term, work_mode, location, hours_per_week',
    notes: 'Term/mode/location are strict filters in mismatch cases.',
  },
]

export const QUALITY_OVER_QUANTITY_BULLETS = [
  'Canonical category-first matching: we match by normalized skill/coursework/major IDs before falling back to raw text.',
  'Explainable fit: each ranking shows why it matched and where gaps exist, reducing blind applicant spam.',
  'Verification gates: email verification and role constraints reduce low-effort, fake, or duplicate submissions.',
  'Constraint-aware ranking: internships that fail core constraints (term, availability, mode, location, grad year, experience) are filtered out.',
  'Curated local inventory + concierge posting support makes quality internship supply a product feature, not just volume.',
]

export const DIFFERENTIATION_MESSAGING = [
  'Fewer but better applicants: we optimize for eligibility and fit before exposure.',
  'Transparent matching: employers can see why candidates are being prioritized.',
  'Structured student signals: major/coursework/skill categories are standardized, not free-form guesswork.',
  'Spam resistance by design: verification + profile completeness expectations improve inbound quality.',
]

export const DIFFERENTIATION_RISKS_AND_MITIGATIONS = [
  {
    risk: 'If canonical tags are missing on internships or students, scoring quality drops toward text fallback behavior.',
    mitigation: 'Admin match-coverage indicators highlight missing majors/skills/coursework/term/hours/location/grad year/experience.',
  },
  {
    risk: 'Sparse student profiles can suppress good opportunities through hard filters.',
    mitigation: 'Profile completion nudges and admin student-coverage views make gaps visible and actionable.',
  },
]

export type MajorInternshipMatrixRow = {
  major: string
  suggestedCourseworkCategories: string[]
  internshipTypes: string[]
}

export const MAJOR_INTERNSHIP_MATRIX: MajorInternshipMatrixRow[] = [
  {
    major: 'Computer Science',
    suggestedCourseworkCategories: ['Software Engineering Fundamentals', 'SQL / Databases', 'Statistics / Probability'],
    internshipTypes: ['Software Engineering Intern', 'Backend Engineer Intern', 'Data Engineering Intern'],
  },
  {
    major: 'Information Systems',
    suggestedCourseworkCategories: ['SQL / Databases', 'Data Visualization (Tableau/Power BI)', 'Product Management Fundamentals'],
    internshipTypes: ['Business Systems Analyst Intern', 'Product Operations Intern', 'Business Intelligence Intern'],
  },
  {
    major: 'Finance',
    suggestedCourseworkCategories: ['Corporate Finance / Valuation', 'Financial Modeling (Excel)', 'Statistics / Probability'],
    internshipTypes: ['Financial Analyst Intern', 'FP&A Intern', 'Investment Analyst Intern'],
  },
  {
    major: 'Accounting',
    suggestedCourseworkCategories: ['Financial Accounting', 'Managerial Accounting', 'Financial Modeling (Excel)'],
    internshipTypes: ['Audit Intern', 'Tax Intern', 'Corporate Accounting Intern'],
  },
  {
    major: 'Marketing',
    suggestedCourseworkCategories: ['Marketing Analytics', 'Data Visualization (Tableau/Power BI)', 'Statistics / Probability'],
    internshipTypes: ['Growth Marketing Intern', 'Digital Marketing Intern', 'Market Research Intern'],
  },
  {
    major: 'Data Science / Statistics',
    suggestedCourseworkCategories: ['Statistics / Probability', 'Econometrics / Regression', 'SQL / Databases'],
    internshipTypes: ['Data Analyst Intern', 'Data Science Intern', 'Analytics Engineering Intern'],
  },
  {
    major: 'Business Administration',
    suggestedCourseworkCategories: ['Operations / Supply Chain', 'Corporate Finance / Valuation', 'Product Management Fundamentals'],
    internshipTypes: ['Operations Intern', 'Business Analyst Intern', 'Strategy Intern'],
  },
  {
    major: 'Economics',
    suggestedCourseworkCategories: ['Econometrics / Regression', 'Statistics / Probability', 'Corporate Finance / Valuation'],
    internshipTypes: ['Economic Research Intern', 'Policy Analyst Intern', 'Quantitative Analyst Intern'],
  },
]

export function buildSampleBreakdown() {
  const sampleStudent = mockStudents[0]
  const sampleInternship = mockInternships[0]
  const sampleMatch = evaluateInternshipMatch(sampleInternship, sampleStudent.profile, DEFAULT_MATCHING_WEIGHTS, {
    explain: true,
  })

  return {
    studentLabel: sampleStudent.name,
    internshipLabel: sampleInternship.title ?? sampleInternship.id,
    match: sampleMatch,
  }
}

export function buildMatchingReportModel() {
  const summary = getMatchingReportSummary()
  const sample = buildSampleBreakdown()

  return {
    generatedAtIso: new Date().toISOString(),
    summary,
    canonicalEnums: MATCHING_CANONICAL_ENUMS,
    dataSources: MATCHING_DATA_SOURCES,
    qualityOverQuantity: {
      bullets: QUALITY_OVER_QUANTITY_BULLETS,
      messaging: DIFFERENTIATION_MESSAGING,
      risksAndMitigations: DIFFERENTIATION_RISKS_AND_MITIGATIONS,
    },
    majorInternshipMatrix: MAJOR_INTERNSHIP_MATRIX,
    sample,
  }
}
