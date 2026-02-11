import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'

export const EMAIL_VERIFICATION_ERROR = 'EMAIL_NOT_VERIFIED' as const

export type EmailVerificationErrorCode = typeof EMAIL_VERIFICATION_ERROR

export type EmailVerificationSubject = {
  id?: string
  email?: string | null
  email_confirmed_at?: string | null
} | null | undefined

export type VerifiedEmailCheck =
  | { ok: true }
  | {
      ok: false
      code: EmailVerificationErrorCode
      actionName: string
      redirectTo: string
    }

export function isEmailVerified(user: EmailVerificationSubject) {
  return Boolean(user?.email_confirmed_at)
}

export function buildVerifyRequiredHref(nextUrl: string, actionName?: string) {
  const params = new URLSearchParams()
  params.set('next', normalizeNextPathOrDefault(nextUrl))
  if (actionName) {
    params.set('action', actionName)
  }
  return `/verify-required?${params.toString()}`
}

export function requireVerifiedEmail(params: {
  user: EmailVerificationSubject
  nextUrl: string
  actionName: string
}): VerifiedEmailCheck {
  if (isEmailVerified(params.user)) {
    return { ok: true }
  }

  return {
    ok: false,
    code: EMAIL_VERIFICATION_ERROR,
    actionName: params.actionName,
    redirectTo: buildVerifyRequiredHref(params.nextUrl, params.actionName),
  }
}

export type ResendVerificationResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

export async function resendVerificationEmail(params: {
  email: string
  emailRedirectTo: string
  resend: (input: {
    type: 'signup'
    email: string
    options?: { emailRedirectTo?: string }
  }) => Promise<{ error: { message?: string } | null }>
}): Promise<ResendVerificationResult> {
  const email = params.email.trim().toLowerCase()
  if (!email) {
    return { ok: false, error: 'Email is required.' }
  }

  const response = await params.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: params.emailRedirectTo },
  })

  if (response.error) {
    return { ok: false, error: response.error.message ?? 'Could not resend verification email.' }
  }

  return { ok: true, message: 'Verification email sent.' }
}
