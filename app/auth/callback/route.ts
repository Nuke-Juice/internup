import { NextResponse } from 'next/server'
import { buildVerifyRequiredHref } from '@/lib/auth/emailVerification'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeAuthError } from '@/lib/auth/normalizeAuthError'
import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'
import { isUserRole } from '@/lib/auth/roles'

function isOtpType(value: string | null): value is 'signup' | 'email' | 'recovery' | 'invite' | 'email_change' | 'magiclink' {
  return (
    value === 'signup' ||
    value === 'email' ||
    value === 'recovery' ||
    value === 'invite' ||
    value === 'email_change' ||
    value === 'magiclink'
  )
}

function isSignupDetailsPath(path: string) {
  return (
    path === '/signup/student/details' ||
    path === '/signup/employer/details' ||
    path.startsWith('/signup/student/details?') ||
    path.startsWith('/signup/employer/details?')
  )
}

function roleFromSignupDetailsPath(nextUrl: string): 'student' | 'employer' | null {
  const next = new URL(nextUrl, 'https://app.local')
  if (next.pathname === '/signup/student/details') return 'student'
  if (next.pathname === '/signup/employer/details') return 'employer'
  return null
}

function readRoleHint(nextUrl: string, userMetadata: Record<string, unknown> | null): 'student' | 'employer' | null {
  const next = new URL(nextUrl, 'https://app.local')
  const roleFromQuery = next.searchParams.get('role')
  if (roleFromQuery === 'student' || roleFromQuery === 'employer') return roleFromQuery
  const roleFromMetadata = typeof userMetadata?.role_hint === 'string' ? userMetadata.role_hint : null
  if (roleFromMetadata === 'student' || roleFromMetadata === 'employer') return roleFromMetadata
  return null
}

function safeProvider(value: string | null) {
  if (value === 'google' || value === 'linkedin' || value === 'linkedin_oidc') return value
  return null
}

function loginRedirect(params: {
  origin: string
  message: string
  reason: string
  flow?: 'code' | 'otp'
  provider?: string | null
  next?: string | null
}) {
  const nextPath = normalizeNextPathOrDefault(params.next ?? null, '/')
  const loginUrl = new URL('/login', params.origin)
  loginUrl.searchParams.set('error', params.message)
  loginUrl.searchParams.set('reason', params.reason)
  if (params.flow) loginUrl.searchParams.set('flow', params.flow)
  if (params.provider) loginUrl.searchParams.set('provider', params.provider)
  if (nextPath !== '/') loginUrl.searchParams.set('next', nextPath)
  return NextResponse.redirect(loginUrl)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const otpType = url.searchParams.get('type')
  const nextUrl = normalizeNextPathOrDefault(url.searchParams.get('next'))
  const provider = safeProvider(url.searchParams.get('provider'))

  const supabase = await supabaseServer()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      const normalized = normalizeAuthError(exchangeError, 'oauth')
      console.warn('[auth] oauth_exchange_failed', {
        reasonCode: 'oauth_exchange_failed',
        provider,
      })
      return loginRedirect({
        origin: url.origin,
        message: normalized.publicMessage,
        reason: 'oauth_exchange_failed',
        flow: 'code',
        provider,
        next: nextUrl,
      })
    }
  } else if (tokenHash && isOtpType(otpType)) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    })
    if (verifyError) {
      const normalized = normalizeAuthError(verifyError, 'oauth')
      console.warn('[auth] otp_verify_failed', {
        reasonCode: 'otp_verify_failed',
        otpType,
      })
      return loginRedirect({
        origin: url.origin,
        message: normalized.publicMessage,
        reason: 'otp_verify_failed',
        flow: 'otp',
        next: nextUrl,
      })
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const authUser = user
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const hintedRole = readRoleHint(nextUrl, metadata)
    const controlledRole = roleFromSignupDetailsPath(nextUrl)
    const admin = hasSupabaseAdminCredentials() ? supabaseAdmin() : null
    const { data: existingUserRow } = await supabase
      .from('users')
      .select('id, role, verified')
      .eq('id', authUser.id)
      .maybeSingle<{ id: string; role: string | null; verified: boolean | null }>()

    const existingRole = isUserRole(existingUserRow?.role) ? existingUserRow.role : null
    const roleForWrite: 'student' | 'employer' | undefined = existingRole
      ? undefined
      : existingUserRow?.id
        ? (controlledRole ?? undefined)
        : (controlledRole ?? hintedRole ?? undefined)

    async function upsertUsersRow(role?: 'student' | 'employer') {
      const payload: { id: string; role?: 'student' | 'employer'; verified?: boolean } = { id: authUser.id }
      if (role) payload.role = role
      if (authUser.email_confirmed_at) payload.verified = true
      const result = await supabase.from('users').upsert(payload, { onConflict: 'id' })
      if (!result.error) return true
      if (!admin) return false
      const adminResult = await admin.from('users').upsert(payload, { onConflict: 'id' })
      return !adminResult.error
    }

    const shouldUpsert = Boolean(roleForWrite || authUser.email_confirmed_at || !existingUserRow?.id)
    if (shouldUpsert) {
      const wroteUser = await upsertUsersRow(roleForWrite)
      if (!wroteUser) {
        console.warn('[auth] users_upsert_failed', {
          reasonCode: 'users_upsert_failed',
          userId: authUser.id,
        })
        return loginRedirect({
          origin: url.origin,
          message: 'Could not finish OAuth sign-in.',
          reason: 'users_upsert_failed',
          flow: code ? 'code' : tokenHash ? 'otp' : undefined,
          provider,
          next: nextUrl,
        })
      }
    }
  }

  if (!user) {
    if (isSignupDetailsPath(nextUrl)) {
      return NextResponse.redirect(new URL(buildVerifyRequiredHref(nextUrl, 'signup_profile_completion'), url.origin))
    }
    const missingReason = code || tokenHash ? 'user_missing' : 'session_missing'
    return loginRedirect({
      origin: url.origin,
      message: 'Could not finish OAuth sign-in.',
      reason: missingReason,
      flow: code ? 'code' : tokenHash ? 'otp' : undefined,
      provider,
      next: nextUrl,
    })
  }

  const { destination } = await resolvePostAuthRedirect({
    supabase,
    userId: user.id,
    requestedNextPath: nextUrl,
    user,
  })

  const redirectUrl = new URL(destination, url.origin)
  if (user.email_confirmed_at) {
    redirectUrl.searchParams.set('verified', '1')
  }

  return NextResponse.redirect(redirectUrl)
}
