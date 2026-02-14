export type InternshipLocationType = 'remote' | 'in_person' | 'hybrid'
export type InternshipSource = 'concierge' | 'employer_self' | 'partner'
export type EmployerVerificationTier = 'free' | 'starter' | 'pro'

export function normalizeEnumValue<T extends string>(input: string | null | undefined, allowed: readonly T[]): T | null {
  const normalized = (input ?? '').trim().toLowerCase()
  if (!normalized) return null
  const match = allowed.find((value) => value.toLowerCase() === normalized)
  return match ?? null
}

export function normalizeLocationType(input: string | null | undefined): InternshipLocationType | null {
  const normalized = (input ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'remote') return 'remote'
  if (normalized === 'hybrid') return 'hybrid'
  if (
    normalized === 'in_person' ||
    normalized === 'in-person' ||
    normalized === 'in person' ||
    normalized === 'on-site' ||
    normalized === 'onsite'
  ) {
    return 'in_person'
  }
  return null
}

export function normalizeInternshipSource(input: string | null | undefined): InternshipSource | null {
  return normalizeEnumValue(input, ['concierge', 'employer_self', 'partner'] as const)
}

export function normalizeEmployerVerificationTier(input: string | null | undefined): EmployerVerificationTier | null {
  return normalizeEnumValue(input, ['free', 'starter', 'pro'] as const)
}
