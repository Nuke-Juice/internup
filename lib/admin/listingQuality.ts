export type ListingQualityInput = {
  employerWebsite: string | null
  employerOverview: string | null
  employerLogoUrl: string | null
  verificationTier: string | null
  employerContactEmail: string | null
  payPresent: boolean
  hoursPresent: boolean
  locationPresent: boolean
  externalApplyUrl: string | null
  employerPostCount: number
  duplicateDescriptionCount: number
}

export type ListingQualityResult = {
  score: number
  flags: string[]
  externalDomainMismatch: boolean
}

function normalizeHost(input: string | null | undefined) {
  const value = (input ?? '').trim()
  if (!value) return ''
  try {
    const parsed = value.startsWith('http://') || value.startsWith('https://') ? new URL(value) : new URL(`https://${value}`)
    return parsed.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function emailDomain(email: string | null | undefined) {
  const value = (email ?? '').trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 0) return ''
  return value.slice(at + 1).replace(/^www\./, '')
}

export function computeListingQualityScore(input: ListingQualityInput): ListingQualityResult {
  let score = 0
  const flags: string[] = []

  if ((input.employerWebsite ?? '').trim()) score += 15
  if ((input.employerOverview ?? '').trim()) score += 12
  if ((input.employerLogoUrl ?? '').trim()) score += 8
  if ((input.verificationTier ?? '').trim() && input.verificationTier !== 'free') score += 20

  const websiteHost = normalizeHost(input.employerWebsite)
  const applyHost = normalizeHost(input.externalApplyUrl)
  const mailDomain = emailDomain(input.employerContactEmail)

  if (websiteHost && mailDomain && (mailDomain === websiteHost || mailDomain.endsWith(`.${websiteHost}`))) {
    score += 10
  }

  if (input.payPresent) score += 12
  if (input.hoursPresent) score += 8
  if (input.locationPresent) score += 8

  if (input.employerPostCount > 10) {
    flags.push('High posting volume in short window')
    score -= 10
  }
  if (input.duplicateDescriptionCount > 2) {
    flags.push('Potential duplicate listing content')
    score -= 10
  }

  const externalDomainMismatch = Boolean(applyHost && websiteHost && applyHost !== websiteHost && !applyHost.endsWith(`.${websiteHost}`))
  if (externalDomainMismatch) {
    flags.push('External apply URL domain does not match employer website')
    score -= 20
  }

  if (!input.payPresent && (input.verificationTier ?? '') === 'pro') {
    flags.push('Pro-tier listing missing pay range')
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    flags,
    externalDomainMismatch,
  }
}
