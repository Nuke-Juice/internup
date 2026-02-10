import { verifyTurnstileToken } from '@/lib/security/turnstile'

const FRIENDLY_ERROR = 'Please verify you’re human and try again.'

function getRemoteIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return null
  return forwarded.split(',')[0]?.trim() || null
}

export async function POST(request: Request) {
  let token = ''
  let action: string | null = null

  try {
    const body = (await request.json()) as { token?: string; action?: string }
    token = String(body.token ?? '').trim()
    action = body.action ? String(body.action) : null
  } catch {
    return Response.json({ ok: false, error: FRIENDLY_ERROR }, { status: 400 })
  }

  const verification = await verifyTurnstileToken({
    token,
    expectedAction: action,
    remoteIp: getRemoteIp(request),
  })

  if (!verification.ok) {
    console.debug('[turnstile] verification failed', {
      action,
      remoteIp: getRemoteIp(request),
      errorCodes: verification.errorCodes,
    })
    return Response.json({ ok: false, error: FRIENDLY_ERROR }, { status: 400 })
  }

  return Response.json({ ok: true })
}
