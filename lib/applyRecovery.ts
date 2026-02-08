const APPLY_RETURN_TO_STORAGE_KEY = 'internup:apply:returnTo'

function hasProtocolPrefix(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)
}

export function normalizeReturnTo(value: string | null | undefined) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  if (hasProtocolPrefix(trimmed)) return null
  if (trimmed.includes('\n') || trimmed.includes('\r')) return null
  return trimmed
}

export function buildAccountRecoveryHref(input: { returnTo: string; code: string }) {
  const safeReturnTo = normalizeReturnTo(input.returnTo)
  const params = new URLSearchParams()
  params.set('complete', '1')
  params.set('recoveryCode', input.code)
  if (safeReturnTo) {
    params.set('returnTo', safeReturnTo)
  }
  return `/account?${params.toString()}`
}

export function addRecoverySuccessParam(returnTo: string) {
  const safeReturnTo = normalizeReturnTo(returnTo)
  if (!safeReturnTo) return '/jobs'

  const [path, existingQuery] = safeReturnTo.split('?', 2)
  const params = new URLSearchParams(existingQuery ?? '')
  params.set('recovery', '1')
  const query = params.toString()
  return query ? `${path}?${query}` : `${path}?recovery=1`
}

export function setStoredReturnTo(value: string) {
  const safeReturnTo = normalizeReturnTo(value)
  if (!safeReturnTo || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(APPLY_RETURN_TO_STORAGE_KEY, safeReturnTo)
    window.localStorage.setItem(APPLY_RETURN_TO_STORAGE_KEY, safeReturnTo)
  } catch {
    // ignore storage failures
  }
}

export function getStoredReturnTo() {
  if (typeof window === 'undefined') return null
  try {
    const sessionValue = normalizeReturnTo(window.sessionStorage.getItem(APPLY_RETURN_TO_STORAGE_KEY))
    if (sessionValue) return sessionValue
    return normalizeReturnTo(window.localStorage.getItem(APPLY_RETURN_TO_STORAGE_KEY))
  } catch {
    return null
  }
}

export function clearStoredReturnTo() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(APPLY_RETURN_TO_STORAGE_KEY)
    window.localStorage.removeItem(APPLY_RETURN_TO_STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}
