import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmployerPlan, type EmployerPlan, type EmployerPlanId } from './plan.ts'
import { getOptionalPriceIdForPlan } from './prices'

const VERIFIED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export function isVerifiedEmployerStatus(status: string | null | undefined) {
  if (!status) return false
  return VERIFIED_SUBSCRIPTION_STATUSES.has(status)
}

export function resolveEmployerPlanId(params: { status: string | null | undefined; priceId: string | null | undefined }): EmployerPlanId {
  const { status, priceId } = params
  if (!isVerifiedEmployerStatus(status)) return 'free'
  if (!priceId) return 'starter'

  const starterPriceId = getOptionalPriceIdForPlan('starter')
  const proPriceId = getOptionalPriceIdForPlan('pro')
  const legacyGrowthPriceId = (process.env.GROWTH_PRICE_ID || '').trim()

  if ((proPriceId && priceId === proPriceId) || (legacyGrowthPriceId && priceId === legacyGrowthPriceId)) return 'pro'
  if (starterPriceId && priceId === starterPriceId) return 'starter'
  return 'starter'
}

export function resolveEmployerPlan(params: { status: string | null | undefined; priceId: string | null | undefined }): EmployerPlan {
  return getEmployerPlan(resolveEmployerPlanId(params))
}

export async function getEmployerVerificationStatus(params: {
  supabase: SupabaseClient
  userId: string
}) {
  const { supabase, userId } = params
  const [{ data: subscriptionData, error: subscriptionError }, { data: employerProfileData }] = await Promise.all([
    supabase.from('subscriptions').select('status, price_id').eq('user_id', userId).maybeSingle(),
    supabase
      .from('employer_profiles')
      .select('verified_employer, verified_employer_manual_override')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (subscriptionError) {
    const fallbackPlan = getEmployerPlan('free')
    return { isVerifiedEmployer: false, status: null as string | null, planId: fallbackPlan.id, plan: fallbackPlan, priceId: null as string | null }
  }

  const status = subscriptionData?.status ?? null
  const priceId = subscriptionData?.price_id ?? null
  const plan = resolveEmployerPlan({ status, priceId })
  const hasManualOverride = Boolean((employerProfileData as { verified_employer_manual_override?: boolean | null } | null)?.verified_employer_manual_override)
  const paidVerifiedTier = isVerifiedEmployerStatus(status) && plan.id === 'pro'
  const isVerifiedEmployer = hasManualOverride || paidVerifiedTier

  return {
    isVerifiedEmployer,
    status,
    planId: plan.id,
    plan,
    priceId,
  }
}
