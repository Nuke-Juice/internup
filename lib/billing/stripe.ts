import 'server-only'

import Stripe from 'stripe'
import {
  getPriceIdForPlan,
  getStripeMode,
  getStripePublishableKeyForMode,
  getStripeSecretKeyForMode,
  getStripeWebhookSecretForMode,
} from './prices'

let stripeClient: Stripe | null = null

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient
  }

  const stripeSecretKey = getStripeSecretKeyForMode()

  stripeClient = new Stripe(stripeSecretKey)
  return stripeClient
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
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

export function getAppUrl() {
  const configured = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL ?? '') ?? normalizeUrl(process.env.APP_URL ?? '')
  if (configured) return configured

  // On Vercel, prefer the stable production domain over per-deployment hosts.
  const vercelProductionUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '')
  if (vercelProductionUrl) return vercelProductionUrl

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, '')}`
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  throw new Error('Missing NEXT_PUBLIC_APP_URL')
}

export function getStarterEmployerPriceId() {
  return getPriceIdForPlan('starter')
}

export function getProEmployerPriceId() {
  return getPriceIdForPlan('pro')
}

export function getGrowthEmployerPriceId() {
  return getProEmployerPriceId()
}

export { getStripeMode, getStripePublishableKeyForMode, getStripeWebhookSecretForMode }
