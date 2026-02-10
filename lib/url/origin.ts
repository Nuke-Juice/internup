function normalizeOrigin(value: string | null | undefined) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function isLocalhostOrigin(value: string | null | undefined) {
  const normalized = normalizeOrigin(value)
  if (!normalized) return false
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
}

export function resolveClientAppOrigin(
  configuredAppUrl: string | null | undefined,
  currentOrigin: string
) {
  const normalizedCurrent = normalizeOrigin(currentOrigin) ?? currentOrigin.replace(/\/+$/, '')
  const normalizedConfigured = normalizeOrigin(configuredAppUrl)

  if (normalizedConfigured) {
    if (!(isLocalhostOrigin(normalizedConfigured) && !isLocalhostOrigin(normalizedCurrent))) {
      return normalizedConfigured
    }
  }

  return normalizedCurrent
}

export function resolveServerAppOrigin(params: {
  configuredPublicAppUrl?: string | null
  configuredAppUrl?: string | null
  vercelProductionUrl?: string | null
  vercelUrl?: string | null
  requestHost?: string | null
  requestProto?: string | null
  nodeEnv?: string | null
}) {
  const configured =
    normalizeOrigin(params.configuredPublicAppUrl) ??
    normalizeOrigin(params.configuredAppUrl) ??
    normalizeOrigin(params.vercelProductionUrl) ??
    normalizeOrigin(params.vercelUrl)

  const host = (params.requestHost ?? '').trim()
  const proto = (params.requestProto ?? '').trim() || 'https'
  const headerOrigin = host ? normalizeOrigin(`${proto}://${host}`) : null

  if (configured) {
    if (!(isLocalhostOrigin(configured) && headerOrigin && !isLocalhostOrigin(headerOrigin))) {
      return configured
    }
  }

  if (headerOrigin) return headerOrigin
  if (params.nodeEnv !== 'production') return 'http://localhost:3000'
  return null
}
