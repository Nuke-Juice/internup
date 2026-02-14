import Link from 'next/link'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import ApplyButton from './ApplyButton'

type Listing = {
  id: string
  title: string | null
  company_name: string | null
  employer_id?: string | null
  employer_verification_tier?: string | null
  location: string | null
  location_city?: string | null
  location_state?: string | null
  remote_eligibility?: string | null
  remote_eligibility_scope?: string | null
  role_category?: string | null
  work_mode?: string | null
  apply_mode?: string | null
  term?: string | null
  hours_min?: number | null
  hours_max?: number | null
  application_deadline?: string | null
  created_at?: string | null
  experience_level: string | null
  hours_per_week: number | null
  majorsText: string | null
  pay: string | null
  short_summary?: string | null
  description?: string | null
  skills?: string[] | null
  required_skills?: string[] | null
  preferred_skills?: string[] | null
  commuteMinutes?: number | null
  maxCommuteMinutes?: number | null
}

type Props = {
  listing: Listing
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  showWhyMatch?: boolean
  whyMatchReasons?: string[]
}

type LocationChip = {
  label: string
  primary?: boolean
}

function badgeClass(primary = false) {
  if (primary) {
    return 'inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700'
  }
  return 'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700'
}

function toWorkModeLabel(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

function deriveBaseLocationLabel(listing: Listing) {
  const city = listing.location_city?.trim()
  const state = listing.location_state?.trim().toUpperCase()
  if (city && state) return `${city}, ${state}`

  const locationText = (listing.location ?? '').trim()
  if (!locationText) return null
  const normalized = locationText.toLowerCase()
  const remoteWithinMatch = normalized.match(/remote\s+within\s+([a-z\s]+)/i)
  if (remoteWithinMatch?.[1]) {
    return `${remoteWithinMatch[1].trim().replace(/\b\w/g, (token) => token.toUpperCase())}-based`
  }
  const commaLocation = locationText.match(/^\s*([^,]+),\s*([A-Za-z]{2})\s*$/)
  if (commaLocation) {
    const parsedCity = commaLocation[1]?.trim()
    const parsedState = commaLocation[2]?.trim().toUpperCase()
    if (parsedCity && parsedState) return `${parsedCity}, ${parsedState}`
  }
  return null
}

function getLocationChips(listing: Listing): LocationChip[] {
  const chips: LocationChip[] = []
  const workModeLabel = toWorkModeLabel(listing.work_mode)
  const baseLocationLabel = deriveBaseLocationLabel(listing)

  if (workModeLabel) {
    chips.push({ label: workModeLabel, primary: true })
  }

  if (workModeLabel === 'Remote') {
    const remoteEligibility = listing.remote_eligibility?.trim()
    const remoteEligibilityScope = listing.remote_eligibility_scope?.trim()
    const locationText = (listing.location ?? '').toLowerCase()
    const state = listing.location_state?.trim().toUpperCase()
    const city = listing.location_city?.trim()
    if (city) {
      chips.push({ label: `${city}-based` })
    } else if (state) {
      chips.push({ label: `${state === 'UT' ? 'Utah' : state}-based` })
    } else if (remoteEligibility) {
      chips.push({ label: remoteEligibility })
    } else if (remoteEligibilityScope === 'us_only') {
      chips.push({ label: 'US only' })
    } else if (remoteEligibilityScope === 'worldwide') {
      chips.push({ label: 'Worldwide' })
    } else if (locationText.includes('utah')) {
      chips.push({ label: 'Utah-based' })
    } else if (locationText.includes('salt lake city') || locationText.includes('slc')) {
      chips.push({ label: 'SLC-based' })
    }
    return chips
  }

  if (baseLocationLabel) {
    chips.push({ label: baseLocationLabel })
  } else if (!workModeLabel && listing.location) {
    chips.push({ label: listing.location })
  }

  return chips
}

function formatDateShort(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function daysUntil(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  const diff = endOfDay.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function daysSince(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diff = Date.now() - date.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function mapExperienceLevel(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'freshman') return 'Freshman'
  if (normalized === 'sophomore') return 'Sophomore'
  if (normalized === 'junior') return 'Junior'
  if (normalized === 'senior') return 'Senior'
  if (normalized === 'any') return 'Any year'
  return value
}

function getRolePreview(listing: Listing) {
  const summary = listing.short_summary?.trim()
  if (summary) return summary.slice(0, 110)

  const source = listing.description?.replace(/\s+/g, ' ').trim()
  if (!source) return null
  const firstSentence = source.match(/[^.!?]+[.!?]?/)
  const chosen = (firstSentence?.[0] ?? source).trim()
  if (chosen.length <= 110) return chosen
  return `${chosen.slice(0, 107).trimEnd()}...`
}

function getPrimaryMajorLabel(majorsText: string | null | undefined) {
  if (!majorsText) return null
  const primary = majorsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0]
  return primary?.toLowerCase() ?? null
}

function getIndustryLabel(roleCategory: string | null | undefined, majorsText: string | null | undefined) {
  const category = roleCategory?.trim()
  if (!category) return null
  const normalizedCategory = category.toLowerCase()
  const primaryMajor = getPrimaryMajorLabel(majorsText)
  if (primaryMajor && primaryMajor === normalizedCategory) return null
  return category
}

function getHoursText(listing: Listing) {
  if (typeof listing.hours_min === 'number' || typeof listing.hours_max === 'number') {
    return `${listing.hours_min ?? '—'}-${listing.hours_max ?? '—'} hrs/week`
  }
  if (typeof listing.hours_per_week === 'number') {
    return `${listing.hours_per_week} hrs/week`
  }
  return null
}

function getSkillChips(listing: Listing) {
  const source = listing.skills ?? listing.required_skills ?? listing.preferred_skills ?? []
  const unique = Array.from(
    new Set(source.map((skill) => skill.trim()).filter((skill) => skill.length > 0))
  )
  if (unique.length === 0) return { visible: [] as string[], overflow: 0 }
  return {
    visible: unique.slice(0, 2),
    overflow: Math.max(0, unique.length - 2),
  }
}

export default function JobCard({
  listing,
  isAuthenticated,
  userRole = null,
  showWhyMatch = false,
  whyMatchReasons = [],
}: Props) {
  const locationChips = getLocationChips(listing)
  const levelLabel = mapExperienceLevel(listing.experience_level)
  const rolePreview = getRolePreview(listing)
  const industryLabel = getIndustryLabel(listing.role_category, listing.majorsText)
  const hoursText = getHoursText(listing)
  const deadlineDays = listing.application_deadline ? daysUntil(listing.application_deadline) : null
  const deadlineShort = listing.application_deadline ? formatDateShort(listing.application_deadline) : null
  const postedDays = listing.created_at ? daysSince(listing.created_at) : null
  const isClosed = typeof deadlineDays === 'number' && deadlineDays < 0
  const isUrgent = typeof deadlineDays === 'number' && deadlineDays >= 0 && deadlineDays <= 7
  const { visible: skillChips, overflow: skillsOverflow } = getSkillChips(listing)

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900">{listing.title || 'Internship'}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {listing.employer_id ? (
              <Link
                href={`/employers/${encodeURIComponent(listing.employer_id)}`}
                className="text-sm font-medium text-blue-700 hover:underline"
                title="View employer profile"
              >
                {listing.company_name || 'Company'}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-700">{listing.company_name || 'Company'}</p>
            )}
            <EmployerVerificationBadge tier={listing.employer_verification_tier ?? 'free'} />
          </div>
        </div>
        {listing.pay ? <span className={badgeClass(true)}>{listing.pay}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {locationChips.map((chip) => (
          <span key={chip.label} className={badgeClass(Boolean(chip.primary))}>
            {chip.label}
          </span>
        ))}
        {listing.term ? <span className={badgeClass()}>{listing.term}</span> : null}
        {levelLabel ? <span className={badgeClass()}>{levelLabel}</span> : null}
      </div>

      {rolePreview ? <p className="mt-3 line-clamp-1 text-sm text-slate-700">{rolePreview}</p> : null}

      <div className="mt-3 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
        {hoursText ? <p className="font-medium text-slate-700">{hoursText}</p> : null}
        {listing.application_deadline && deadlineDays !== null ? (
          <p className={`text-right sm:text-left ${isClosed ? 'font-semibold text-slate-500' : isUrgent ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>
            {isClosed ? 'Closed' : `Closes in ${deadlineDays} day${deadlineDays === 1 ? '' : 's'}`}
            {deadlineShort ? <span className="ml-1 text-[11px] text-slate-500">({deadlineShort})</span> : null}
          </p>
        ) : null}
        {postedDays !== null ? (
          <p className="text-[11px] text-slate-500">Posted {postedDays === 0 ? 'today' : `${postedDays} day${postedDays === 1 ? '' : 's'} ago`}</p>
        ) : null}
        {industryLabel ? (
          <p className="text-[11px] text-slate-600">
            <span className="font-medium text-slate-700">Industry:</span> {industryLabel}
          </p>
        ) : null}
      </div>

      {listing.majorsText ? (
        <p className="mt-2 line-clamp-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Majors:</span> {listing.majorsText}
        </p>
      ) : null}

      {skillChips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skillChips.map((skill) => (
            <span key={skill} className={badgeClass()}>
              {skill}
            </span>
          ))}
          {skillsOverflow > 0 ? <span className={badgeClass()}>{`+${skillsOverflow}`}</span> : null}
        </div>
      ) : null}

      {typeof listing.commuteMinutes === 'number' ? (
        <p className={`mt-2 text-xs ${typeof listing.maxCommuteMinutes === 'number' && listing.commuteMinutes > listing.maxCommuteMinutes ? 'text-amber-700' : 'text-slate-600'}`}>
          <span className="font-medium text-slate-700">Commute:</span> ~{listing.commuteMinutes} min
          {typeof listing.maxCommuteMinutes === 'number' ? ` (${listing.maxCommuteMinutes} min target)` : ''}
        </p>
      ) : null}

      {isAuthenticated && showWhyMatch && whyMatchReasons.length > 0 ? (
        <details className="mt-3 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          <summary className="cursor-pointer list-none font-medium">Why this matches</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-left text-[11px] text-emerald-900">
            {whyMatchReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/jobs/${listing.id}`}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          View details
        </Link>
        <ApplyButton
          listingId={listing.id}
          applyMode={listing.apply_mode}
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          isClosed={isClosed}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </div>
    </article>
  )
}
