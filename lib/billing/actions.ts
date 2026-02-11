'use server'

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { getAppUrl, getProEmployerPriceId, getStarterEmployerPriceId, getStripeClient } from '@/lib/billing/stripe'
import { supabaseServer } from '@/lib/supabase/server'

function isNextRedirectError(error: unknown): error is { digest: string } {
  if (!error || typeof error !== 'object' || !('digest' in error)) return false
  return typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')
}

function idempotencyKeyFor(action: 'customer' | 'checkout' | 'billing_portal', userId: string, extra = '') {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000))
  return `${action}:${userId}:${extra}:${bucket}`
}

async function getOrCreateStripeCustomerForUser(params: {
  userId: string
  email: string | null
}) {
  const { userId, email } = params
  const supabase = await supabaseServer()

  const { data: existing, error: existingError } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      user_id: userId,
    },
  }, {
    idempotencyKey: idempotencyKeyFor('customer', userId),
  })

  const { error: upsertError } = await supabase.from('stripe_customers').upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return customer.id
}

type PaidEmployerPlan = 'starter' | 'pro'

function priceIdForPlan(plan: PaidEmployerPlan) {
  return plan === 'pro' ? getProEmployerPriceId() : getStarterEmployerPriceId()
}

export async function startEmployerCheckoutAction(plan: PaidEmployerPlan) {
  try {
    const { user } = await requireRole('employer', { requestedPath: '/upgrade' })
    const supabase = await supabaseServer()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: authUser?.email ?? null,
    })

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      success_url: `${getAppUrl()}/upgrade?checkout=success`,
      cancel_url: `${getAppUrl()}/upgrade?checkout=canceled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_id: plan,
      },
      allow_promotion_codes: true,
    }, {
      idempotencyKey: idempotencyKeyFor('checkout', user.id, plan),
    })

    if (!session.url) {
      redirect('/upgrade?error=Could+not+start+checkout')
    }

    redirect(session.url)
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Could not start checkout'
    redirect(`/upgrade?error=${encodeURIComponent(message)}`)
  }
}

export async function startStarterEmployerCheckoutAction() {
  return startEmployerCheckoutAction('starter')
}

export async function startProEmployerCheckoutAction() {
  return startEmployerCheckoutAction('pro')
}

export async function startGrowthEmployerCheckoutAction() {
  return startEmployerCheckoutAction('pro')
}

export async function startVerifiedEmployerCheckoutAction() {
  return startEmployerCheckoutAction('starter')
}

export async function createBillingPortalSessionAction() {
  try {
    const { user } = await requireRole('employer', { requestedPath: '/upgrade' })
    const supabase = await supabaseServer()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: authUser?.email ?? null,
    })

    const stripe = getStripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/upgrade`,
    }, {
      idempotencyKey: idempotencyKeyFor('billing_portal', user.id),
    })

    redirect(session.url)
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Could not open billing portal'
    redirect(`/upgrade?error=${encodeURIComponent(message)}`)
  }
}
