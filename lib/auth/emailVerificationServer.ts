'use server'

import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { resendVerificationEmail, type ResendVerificationResult } from '@/lib/auth/emailVerification'
import { resolveServerAppOrigin } from '@/lib/url/origin'
import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'
import { normalizeAuthError } from '@/lib/auth/normalizeAuthError'

async function resolveAppOrigin() {
  const headerStore = await headers()
  const origin = resolveServerAppOrigin({
    configuredPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    configuredAppUrl: process.env.APP_URL,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelUrl: process.env.VERCEL_URL,
    requestHost: headerStore.get('x-forwarded-host') ?? headerStore.get('host'),
    requestProto: headerStore.get('x-forwarded-proto') ?? 'https',
    nodeEnv: process.env.NODE_ENV,
  })

  if (origin) return origin
  throw new Error('Could not resolve app origin for verification email redirect')
}

export async function resendVerificationEmailAction(
  email: string,
  nextUrl = '/'
): Promise<ResendVerificationResult> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be logged in.' }
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || normalizedEmail !== (user.email ?? '').trim().toLowerCase()) {
    return { ok: false, error: 'Email does not match the signed-in account.' }
  }

  // If Auth already has confirmed email, heal the app-level verified flag
  // instead of pretending to send another verification email.
  if (user.email_confirmed_at) {
    const { error: verifySyncError } = await supabase
      .from('users')
      .update({ verified: true })
      .eq('id', user.id)
      .eq('verified', false)

    if (verifySyncError) {
      console.warn('[auth] verified_sync_failed', {
        reasonCode: 'verified_sync_failed_resend',
        userId: user.id,
      })
    }

    return { ok: true, message: 'Email is already verified. Continue to your account.' }
  }

  const appOrigin = await resolveAppOrigin()
  const callback = new URL('/auth/callback', appOrigin)
  callback.searchParams.set('next', normalizeNextPathOrDefault(nextUrl))

  const result = await resendVerificationEmail({
    email: normalizedEmail,
    emailRedirectTo: callback.toString(),
    resend: (input) => supabase.auth.resend(input),
  })

  if (!result.ok) {
    const normalized = normalizeAuthError({ message: result.error }, 'verify')
    console.warn('[auth] resend_verification_failed', { reasonCode: normalized.reasonCode, userId: user.id })
    return { ok: false, error: normalized.publicMessage }
  }

  return result
}
