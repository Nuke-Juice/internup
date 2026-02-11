type AuthErrorInput = {
  message?: string | null
}

export type NormalizedAuthError = {
  publicMessage: string
  reasonCode: string
}

function messageOf(error: unknown) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as AuthErrorInput).message
    return typeof value === 'string' ? value : ''
  }
  return ''
}

function isLikelyExpiredLink(message: string) {
  return (
    message.includes('expired') ||
    message.includes('invalid') ||
    message.includes('otp') ||
    message.includes('token') ||
    message.includes('code verifier') ||
    message.includes('code challenge') ||
    message.includes('auth session missing')
  )
}

export function normalizeAuthError(error: unknown, context: 'login' | 'oauth' | 'verify' | 'reset_exchange' | 'reset_update') {
  const raw = messageOf(error).toLowerCase()

  if (context === 'login') {
    if (raw.includes('invalid login credentials')) {
      return { publicMessage: 'Invalid email or password.', reasonCode: 'invalid_credentials' }
    }
    if (raw.includes('email not confirmed')) {
      return { publicMessage: 'Verify your email to continue.', reasonCode: 'email_unconfirmed' }
    }
    return { publicMessage: 'Could not sign in. Please try again.', reasonCode: 'login_failed' }
  }

  if (context === 'oauth') {
    if (isLikelyExpiredLink(raw)) {
      return { publicMessage: 'Email link is invalid or has expired.', reasonCode: 'oauth_link_invalid_or_expired' }
    }
    return { publicMessage: 'Could not finish OAuth sign-in.', reasonCode: 'oauth_failed' }
  }

  if (context === 'verify') {
    if (raw.includes('rate limit')) {
      return { publicMessage: 'Please wait before requesting another verification email.', reasonCode: 'verify_rate_limited' }
    }
    return { publicMessage: 'Could not resend verification email. Please try again.', reasonCode: 'verify_resend_failed' }
  }

  if (context === 'reset_exchange') {
    if (isLikelyExpiredLink(raw)) {
      return { publicMessage: 'Email link is invalid or has expired.', reasonCode: 'reset_link_invalid_or_expired' }
    }
    return { publicMessage: 'Could not start password reset. Request a new reset link.', reasonCode: 'reset_exchange_failed' }
  }

  if (raw.includes('session') || raw.includes('token') || raw.includes('expired')) {
    return { publicMessage: 'Could not update password. Request a new reset link.', reasonCode: 'reset_session_invalid' }
  }
  return { publicMessage: 'Could not update password. Please try again.', reasonCode: 'reset_update_failed' }
}

