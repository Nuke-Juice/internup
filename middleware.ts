import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logAccessDecision, logRoleLookupWarning } from '@/lib/auth/devAccessLog'
import { isAdminRole, isUserRole } from '@/lib/auth/roles'
import { buildNextPath } from '@/lib/auth/nextPath'

function redirectTo(pathname: string, request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  if (pathname === '/login') {
    const nextPath = buildNextPath(request.nextUrl.pathname, request.nextUrl.search)
    url.searchParams.set('next', nextPath)
  }
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const requestedPath = request.nextUrl.pathname
  const response = NextResponse.next()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectTo('/login', request)
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    logAccessDecision({
      requestedPath,
      authUserId: null,
      role: null,
      decision: 'denied',
    })
    return redirectTo('/login', request)
  }

  let role: string | null = null
  try {
    const { data: userRow, error: roleError } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (roleError) {
      logRoleLookupWarning({
        requestedPath,
        authUserId: user.id,
        warning: roleError.message,
      })
    } else if (isUserRole(userRow?.role)) {
      role = userRow.role
    }
  } catch (lookupError) {
    const warning = lookupError instanceof Error ? lookupError.message : 'unknown role lookup failure'
    logRoleLookupWarning({
      requestedPath,
      authUserId: user.id,
      warning,
    })
  }

  if (!isAdminRole(role)) {
    logAccessDecision({
      requestedPath,
      authUserId: user.id,
      role,
      decision: 'denied',
    })
    return redirectTo('/unauthorized', request)
  }

  logAccessDecision({
    requestedPath,
    authUserId: user.id,
    role,
    decision: 'granted',
  })

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
