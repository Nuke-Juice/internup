import { NextResponse } from 'next/server'
import { resendVerificationEmailAction } from '@/lib/auth/emailVerificationServer'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // no-op
  }

  const next = normalizeNextPathOrDefault(
    body && typeof body === 'object' && 'next' in body ? String((body as { next?: unknown }).next ?? '') : '/'
  )
  const result = await resendVerificationEmailAction(user.email ?? '', next)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: result.message })
}
