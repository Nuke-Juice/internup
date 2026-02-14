const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_SET = new Set(MONTH_OPTIONS)

function normalize(value: string | null | undefined) {
  const text = (value ?? '').trim()
  return MONTH_SET.has(text as (typeof MONTH_OPTIONS)[number]) ? text : ''
}

export function getMonthOptions() {
  return [...MONTH_OPTIONS]
}

export function getStartYearOptions() {
  return ['2026', '2027']
}

export function getEndYearOptions() {
  return getStartYearOptions()
}

function normalizeYear(value: string | null | undefined) {
  const text = (value ?? '').trim()
  return /^\d{4}$/.test(text) ? text : ''
}

export function deriveTermFromStart(startMonth: string | null | undefined, startYear: string | null | undefined) {
  return deriveTermFromRange(startMonth, startYear, null, null)
}

export function inferStartFromTerm(term: string | null | undefined) {
  const { startMonth, startYear } = inferRangeFromTerm(term)
  return { startMonth, startYear }
}

export function deriveTermFromRange(
  startMonth: string | null | undefined,
  startYear: string | null | undefined,
  endMonth: string | null | undefined,
  endYear: string | null | undefined
) {
  const start = normalize(startMonth)
  const startYearNormalized = normalizeYear(startYear)
  const end = normalize(endMonth)
  const endYearNormalized = normalizeYear(endYear)
  if (!start || !startYearNormalized || !end || !endYearNormalized) return null
  return `${start} ${startYearNormalized} - ${end} ${endYearNormalized}`
}

export function inferRangeFromTerm(term: string | null | undefined) {
  const raw = (term ?? '').trim()
  if (!raw) return { startMonth: '', startYear: '', endMonth: '', endYear: '' }

  const rangeMatch = raw.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
  )
  if (rangeMatch) {
    return {
      startMonth: capitalize(rangeMatch[1]),
      startYear: rangeMatch[2],
      endMonth: capitalize(rangeMatch[3]),
      endYear: rangeMatch[4],
    }
  }

  const monthYearMatch = raw.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
  )
  if (monthYearMatch) {
    return {
      startMonth: capitalize(monthYearMatch[1]),
      startYear: monthYearMatch[2],
      endMonth: '',
      endYear: '',
    }
  }

  const lower = raw.toLowerCase()
  const currentYear = String(new Date().getUTCFullYear())
  if (lower.includes('spring')) return { startMonth: 'January', startYear: currentYear, endMonth: 'April', endYear: currentYear }
  if (lower.includes('summer')) return { startMonth: 'May', startYear: currentYear, endMonth: 'August', endYear: currentYear }
  if (lower.includes('fall')) return { startMonth: 'September', startYear: currentYear, endMonth: 'December', endYear: currentYear }
  if (lower.includes('winter')) {
    const nextYear = String(Number(currentYear) + 1)
    return { startMonth: 'December', startYear: currentYear, endMonth: 'February', endYear: nextYear }
  }

  return { startMonth: '', startYear: '', endMonth: '', endYear: '' }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
