const SCHEME_LIKE_PATTERN = /(?:https?|javascript|data|vbscript|file):/i

export function normalizeNextPath(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed)
    } catch {
      return trimmed
    }
  })()
  const candidates = [trimmed, decoded]

  for (const candidate of candidates) {
    if (!candidate.startsWith('/')) return null
    if (candidate.startsWith('//')) return null
    if (candidate.startsWith('/\\')) return null
    if (candidate.includes('\u0000')) return null
    if (SCHEME_LIKE_PATTERN.test(candidate)) return null
  }

  return trimmed
}

export function normalizeNextPathOrDefault(value: string | null | undefined, fallback = '/') {
  return normalizeNextPath(value) ?? fallback
}

export function buildNextPath(pathname: string, search = '') {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return normalizeNextPathOrDefault(`${path}${search}`)
}
