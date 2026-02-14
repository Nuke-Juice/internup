const ATS_HOST_HINTS = ['greenhouse', 'workday', 'lever', 'icims', 'smartrecruiters', 'ashby', 'bamboohr']

export function inferExternalApplyType(value: string) {
  const url = value.trim().toLowerCase()
  if (!url) return null
  for (const hint of ATS_HOST_HINTS) {
    if (url.includes(hint)) return hint
  }
  return 'other'
}

export function normalizeExternalApplyUrl(value: string | null | undefined) {
  const input = (value ?? '').trim()
  if (!input) return null
  if (input.startsWith('//')) return null
  if (input.toLowerCase().startsWith('javascript:')) return null
  if (input.toLowerCase().startsWith('data:')) return null
  if (input.toLowerCase().startsWith('vbscript:')) return null

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:') return null
  if (!parsed.hostname || parsed.hostname === 'localhost') return null

  const normalizedPath = parsed.pathname.toLowerCase()
  if (normalizedPath.startsWith('/admin') || normalizedPath.startsWith('/dashboard')) return null

  return parsed.toString()
}

export function normalizeApplyMode(value: string | null | undefined): 'native' | 'ats_link' | 'hybrid' {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'ats_link' || normalized === 'hybrid') return normalized
  return 'native'
}
