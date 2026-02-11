import 'server-only'

export type StripeMode = 'test' | 'live'
export type PaidEmployerPlan = 'starter' | 'pro'

function normalizeMode(value: string | undefined): StripeMode | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'test') return 'test'
  if (normalized === 'live') return 'live'
  return null
}

function resolveModeFromSecretKey(secretKey: string | null): StripeMode {
  if (typeof secretKey === 'string' && secretKey.startsWith('sk_live_')) return 'live'
  return 'test'
}

function readEnvForMode(base: string, mode: StripeMode) {
  const suffix = mode === 'live' ? '_LIVE' : '_TEST'
  const key = `${base}${suffix}`
  const value = process.env[key]?.trim()
  return value && value.length > 0 ? value : null
}

function readLegacyStarterPriceId() {
  const value = (process.env.STARTER_PRICE_ID || process.env.STRIPE_PRICE_VERIFIED_EMPLOYER || '').trim()
  return value.length > 0 ? value : null
}

function readLegacyProPriceId() {
  const value = (process.env.PRO_PRICE_ID || process.env.GROWTH_PRICE_ID || '').trim()
  return value.length > 0 ? value : null
}

export function getStripeMode(): StripeMode {
  const explicit = normalizeMode(process.env.STRIPE_MODE)
  if (explicit) return explicit

  const explicitSecret =
    process.env.STRIPE_SECRET_KEY_LIVE?.trim() ||
    process.env.STRIPE_SECRET_KEY_TEST?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim() ||
    null
  return resolveModeFromSecretKey(explicitSecret)
}

export function getStripeSecretKeyForMode(mode = getStripeMode()) {
  const modeSpecific = readEnvForMode('STRIPE_SECRET_KEY', mode)
  if (modeSpecific) return modeSpecific
  const fallback = (process.env.STRIPE_SECRET_KEY || '').trim()
  if (fallback) return fallback
  throw new Error(`Missing Stripe secret key for mode=${mode}`)
}

export function getStripePublishableKeyForMode(mode = getStripeMode()) {
  const modeSpecific = readEnvForMode('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', mode)
  if (modeSpecific) return modeSpecific
  const fallback = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim()
  if (fallback) return fallback
  return ''
}

export function getStripeWebhookSecretForMode(mode = getStripeMode()) {
  const modeSpecific = readEnvForMode('STRIPE_WEBHOOK_SECRET', mode)
  if (modeSpecific) return modeSpecific
  const fallback = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (fallback) return fallback
  throw new Error(`Missing Stripe webhook secret for mode=${mode}`)
}

export function getPriceIdForPlan(plan: PaidEmployerPlan, mode = getStripeMode()) {
  const value = getOptionalPriceIdForPlan(plan, mode)
  if (value) return value
  throw new Error(`Missing ${plan} price id for mode=${mode}`)
}

export function getOptionalPriceIdForPlan(plan: PaidEmployerPlan, mode = getStripeMode()) {
  if (plan === 'starter') {
    const modeSpecific = readEnvForMode('STARTER_PRICE_ID', mode)
    if (modeSpecific) return modeSpecific
    const legacy = readLegacyStarterPriceId()
    if (legacy) return legacy
    return null
  }

  const modeSpecific = readEnvForMode('PRO_PRICE_ID', mode)
  if (modeSpecific) return modeSpecific
  const legacy = readLegacyProPriceId()
  if (legacy) return legacy
  return null
}

export function getPriceIdMapForMode(mode = getStripeMode()) {
  return {
    starter: getPriceIdForPlan('starter', mode),
    pro: getPriceIdForPlan('pro', mode),
  } as const
}
