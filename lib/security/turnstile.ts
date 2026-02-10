import 'server-only'

type VerifyTurnstileParams = {
  token: string
  remoteIp?: string | null
  expectedAction?: string | null
}

type VerifyTurnstileResult = {
  ok: boolean
  errorCodes: string[]
  action: string | null
}

type TurnstileVerifyResponse = {
  success: boolean
  action?: string
  'error-codes'?: string[]
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstileToken(params: VerifyTurnstileParams): Promise<VerifyTurnstileResult> {
  const token = params.token.trim()
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? ''

  if (!secret) {
    return { ok: false, errorCodes: ['missing-secret'], action: null }
  }
  if (!token) {
    return { ok: false, errorCodes: ['missing-token'], action: null }
  }

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (params.remoteIp) {
    form.set('remoteip', params.remoteIp)
  }

  let payload: TurnstileVerifyResponse | null = null
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      cache: 'no-store',
    })

    payload = (await response.json()) as TurnstileVerifyResponse
  } catch {
    return { ok: false, errorCodes: ['verification-request-failed'], action: null }
  }

  const action = payload.action ?? null
  if (params.expectedAction && action && params.expectedAction !== action) {
    return { ok: false, errorCodes: ['action-mismatch'], action }
  }

  return {
    ok: Boolean(payload.success),
    errorCodes: payload['error-codes'] ?? [],
    action,
  }
}
