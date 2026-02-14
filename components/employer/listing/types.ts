export type ApplyMode = 'native' | 'ats_link' | 'hybrid'
export type WorkMode = 'on-site' | 'hybrid' | 'remote'

export type CatalogOption = {
  id: string
  name: string
}

export type ListingStep1FieldKey =
  | 'title'
  | 'category'
  | 'work_mode'
  | 'location_city'
  | 'location_state'
  | 'external_apply_url'

export type ListingStep2FieldKey =
  | 'pay_min'
  | 'pay_max'
  | 'hours_min'
  | 'hours_max'
  | 'duration_weeks'
  | 'start_date'
  | 'application_deadline'

export type ListingStep4FieldKey =
  | 'short_summary'

export type ListingTemplate = {
  key: string
  label: string
  title: string
  category: string
  requiredSkills: string[]
  preferredSkills: string[]
  majors: string[]
  courseworkCategories: string[]
  responsibilities: string[]
  qualifications: string[]
}

export type ListingWizardInitialValues = {
  title: string
  companyName: string
  category: string
  workMode: WorkMode
  locationCity: string
  locationState: string
  applyMode: ApplyMode
  externalApplyUrl: string
  externalApplyType: string
  payType: 'hourly'
  payMin: string
  payMax: string
  hoursMin: string
  hoursMax: string
  durationWeeks: string
  startDate: string
  applicationDeadline: string
  shortSummary: string
  description: string
  responsibilities: string
  qualifications: string
  screeningQuestion: string
  resumeRequired: boolean
  requiredSkillLabels: string[]
  preferredSkillLabels: string[]
  majorLabels: string[]
  courseworkCategoryLabels: string[]
}
