export const LISTING_PUBLISH_ERROR = {
  TITLE_REQUIRED: 'TITLE_REQUIRED',
  EMPLOYER_REQUIRED: 'EMPLOYER_REQUIRED',
  WORK_MODE_REQUIRED: 'WORK_MODE_REQUIRED',
  LOCATION_REQUIRED: 'LOCATION_REQUIRED',
  PAY_REQUIRED: 'PAY_REQUIRED',
  HOURS_REQUIRED: 'HOURS_REQUIRED',
  TERM_REQUIRED: 'TERM_REQUIRED',
  MAJORS_REQUIRED: 'MAJORS_REQUIRED',
  SHORT_SUMMARY_REQUIRED: 'SHORT_SUMMARY_REQUIRED',
  DESCRIPTION_REQUIRED: 'DESCRIPTION_REQUIRED',
} as const

export type ListingPublishErrorCode = (typeof LISTING_PUBLISH_ERROR)[keyof typeof LISTING_PUBLISH_ERROR]

export type ListingPublishValidationInput = {
  title: string | null
  employerId: string | null
  workMode: string | null
  locationCity: string | null
  locationState: string | null
  payText?: string | null
  payMinHourly?: number | null
  payMaxHourly?: number | null
  hoursMin?: number | null
  hoursMax?: number | null
  term?: string | null
  majors?: string[] | string | null
  shortSummary?: string | null
  description?: string | null
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim()
}

function parseMajors(value: string[] | string | null | undefined) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean)
  }
  return value
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

export function validateListingForPublish(
  input: ListingPublishValidationInput
): { ok: true } | { ok: false; code: ListingPublishErrorCode } {
  const title = normalizeText(input.title)
  const employerId = normalizeText(input.employerId)
  const workMode = normalizeText(input.workMode).toLowerCase()
  const locationCity = normalizeText(input.locationCity)
  const locationState = normalizeText(input.locationState)
  const term = normalizeText(input.term)
  const majors = parseMajors(input.majors)
  const shortSummary = normalizeText(input.shortSummary)
  const description = normalizeText(input.description)
  const payText = normalizeText(input.payText)
  const hasNumericPay = typeof input.payMinHourly === 'number' || typeof input.payMaxHourly === 'number'
  const hasHoursMin = typeof input.hoursMin === 'number' && Number.isFinite(input.hoursMin)
  const hasHoursMax = typeof input.hoursMax === 'number' && Number.isFinite(input.hoursMax)

  if (!title) return { ok: false, code: LISTING_PUBLISH_ERROR.TITLE_REQUIRED }
  if (!employerId) return { ok: false, code: LISTING_PUBLISH_ERROR.EMPLOYER_REQUIRED }
  if (!workMode || (workMode !== 'remote' && workMode !== 'hybrid' && workMode !== 'on-site')) {
    return { ok: false, code: LISTING_PUBLISH_ERROR.WORK_MODE_REQUIRED }
  }
  if ((workMode === 'hybrid' || workMode === 'on-site') && (!locationCity || !locationState)) {
    return { ok: false, code: LISTING_PUBLISH_ERROR.LOCATION_REQUIRED }
  }
  if (!payText && !hasNumericPay) {
    return { ok: false, code: LISTING_PUBLISH_ERROR.PAY_REQUIRED }
  }
  if (!hasHoursMin || !hasHoursMax || (input.hoursMin ?? 0) > (input.hoursMax ?? 0)) {
    return { ok: false, code: LISTING_PUBLISH_ERROR.HOURS_REQUIRED }
  }
  if (!term) return { ok: false, code: LISTING_PUBLISH_ERROR.TERM_REQUIRED }
  if (majors.length === 0) return { ok: false, code: LISTING_PUBLISH_ERROR.MAJORS_REQUIRED }
  if (!shortSummary) return { ok: false, code: LISTING_PUBLISH_ERROR.SHORT_SUMMARY_REQUIRED }
  if (!description) return { ok: false, code: LISTING_PUBLISH_ERROR.DESCRIPTION_REQUIRED }

  return { ok: true }
}
