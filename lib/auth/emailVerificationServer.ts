'use server'

import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { resendVerificationEmail, type ResendVerificationResult } from '@/lib/auth/emailVerification'
import { resolveServerAppOrigin } from '@/lib/url/origin'

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

function normalizeNext(nextUrl: string) {
  if (!nextUrl.startsWith('/')) return '/'
  if (nextUrl.startsWith('//')) return '/'
  return nextUrl
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

  const appOrigin = await resolveAppOrigin()
  const callback = new URL('/auth/callback', appOrigin)
  callback.searchParams.set('next', normalizeNext(nextUrl))

  return resendVerificationEmail({
    email: normalizedEmail,
    emailRedirectTo: callback.toString(),
    resend: (input) => supabase.auth.resend(input),
  })
}
