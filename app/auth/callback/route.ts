import { NextResponse } from 'next/server'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { supabaseServer } from '@/lib/supabase/server'

function normalizeNext(value: string | null) {
  const next = (value ?? '/').trim()
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  return next
}

function readRoleHint(nextUrl: string, userMetadata: Record<string, unknown> | null): 'student' | 'employer' | null {
  const next = new URL(nextUrl, 'https://app.local')
  const roleFromQuery = next.searchParams.get('role')
  if (roleFromQuery === 'student' || roleFromQuery === 'employer') return roleFromQuery
  const roleFromMetadata = typeof userMetadata?.role_hint === 'string' ? userMetadata.role_hint : null
  if (roleFromMetadata === 'student' || roleFromMetadata === 'employer') return roleFromMetadata
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextUrl = normalizeNext(url.searchParams.get('next'))

  const supabase = await supabaseServer()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(new URL('/login?error=Could+not+finish+OAuth+sign-in', url.origin))
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const authUser = user
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const roleHint = readRoleHint(nextUrl, metadata)
    const admin = hasSupabaseAdminCredentials() ? supabaseAdmin() : null

    async function upsertUsersRow(role: 'student' | 'employer') {
      const payload = { id: authUser.id, role, verified: false }
      const result = await supabase.from('users').upsert(payload, { onConflict: 'id' })
      if (!result.error) return true
      if (!admin) return false
      const adminResult = await admin.from('users').upsert(payload, { onConflict: 'id' })
      return !adminResult.error
    }

    if (roleHint === 'student') {
      const wroteUser = await upsertUsersRow('student')
      if (!wroteUser) {
        return NextResponse.redirect(new URL('/login?error=Could+not+finish+OAuth+sign-in', url.origin))
      }
    } else if (roleHint === 'employer') {
      const wroteUser = await upsertUsersRow('employer')
      if (!wroteUser) {
        return NextResponse.redirect(new URL('/login?error=Could+not+finish+OAuth+sign-in', url.origin))
      }
    }
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const { destination } = await resolvePostAuthRedirect({
    supabase,
    userId: user.id,
    requestedNextPath: nextUrl,
    user,
  })

  const redirectUrl = new URL(destination, url.origin)
  if (user?.email_confirmed_at) {
    redirectUrl.searchParams.set('verified', '1')
  }

  return NextResponse.redirect(redirectUrl)
}
