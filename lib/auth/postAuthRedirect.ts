import type { SupabaseClient } from '@supabase/supabase-js'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { isAdminRole, isAppRole, isUserRole, type AppRole, type UserRole } from '@/lib/auth/roles'
import { buildVerifyRequiredHref } from '@/lib/auth/emailVerification'

type RoleLookupRow = { role: UserRole | null; verified?: boolean | null } | null

function isNonEmpty(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeNextPath(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  return trimmed
}

function defaultDestinationForRole(role: AppRole) {
  return role === 'student' ? '/' : '/dashboard/employer'
}

function signupDetailsPathForRole(role: AppRole) {
  return role === 'student' ? '/signup/student/details' : '/signup/employer/details'
}

function isAccountPath(path: string | null) {
  return path === '/account' || Boolean(path?.startsWith('/account?'))
}

function isSignupDetailsPath(path: string | null) {
  return (
    path === '/signup/student/details' ||
    path === '/signup/employer/details' ||
    Boolean(path?.startsWith('/signup/student/details?')) ||
    Boolean(path?.startsWith('/signup/employer/details?'))
  )
}

async function isOnboardingComplete(supabase: SupabaseClient, userId: string, role: AppRole) {
  if (role === 'student') {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('school, major_id, majors, availability_start_month, availability_hours_per_week')
      .eq('user_id', userId)
      .maybeSingle()

    return getMinimumProfileCompleteness(profile).ok
  }

  const { data: profile } = await supabase
    .from('employer_profiles')
    .select('company_name, location_address_line1')
    .eq('user_id', userId)
    .maybeSingle()

  return isNonEmpty(profile?.company_name) && isNonEmpty(profile?.location_address_line1)
}

export async function resolvePostAuthRedirect(params: {
  supabase: SupabaseClient
  userId: string
  requestedNextPath?: string | null
  user?: { email_confirmed_at?: string | null } | null
}) {
  const normalizedNext = normalizeNextPath(params.requestedNextPath ?? null)
  const authUser =
    params.user ??
    (
      await params.supabase.auth.getUser()
    ).data.user

  if (!authUser?.email_confirmed_at) {
    const verifyNext = normalizedNext ?? '/account'
    return {
      destination: buildVerifyRequiredHref(verifyNext, 'signup_continue'),
      role: null as UserRole | null,
      onboardingComplete: false,
    }
  }

  const { data: userRow } = await params.supabase
    .from('users')
    .select('role, verified')
    .eq('id', params.userId)
    .maybeSingle<RoleLookupRow>()

  const role = isUserRole(userRow?.role) ? userRow.role : null
  let isVerificationComplete = userRow?.verified === true
  if (!isVerificationComplete && Boolean(authUser?.email_confirmed_at)) {
    const { error: markVerifiedError } = await params.supabase
      .from('users')
      .update({ verified: true })
      .eq('id', params.userId)
      .eq('verified', false)
    if (!markVerifiedError) {
      isVerificationComplete = true
    }
  }
  if (!isVerificationComplete) {
    const verifyNext = normalizedNext ?? (isAppRole(role) ? signupDetailsPathForRole(role) : '/account')
    return {
      destination: buildVerifyRequiredHref(verifyNext, 'signup_email_verification_pending'),
      role,
      onboardingComplete: false,
    }
  }

  if (!role) {
    return {
      destination: '/account',
      role: null as UserRole | null,
      onboardingComplete: false,
    }
  }

  if (isAdminRole(role)) {
    return {
      destination: normalizedNext ?? '/admin/internships',
      role,
      onboardingComplete: true,
    }
  }

  if (!isAppRole(role)) {
    return {
      destination: '/account',
      role,
      onboardingComplete: false,
    }
  }

  const onboardingComplete = await isOnboardingComplete(params.supabase, params.userId, role)
  if (!onboardingComplete) {
    const onboardingPath = signupDetailsPathForRole(role)
    return {
      destination: onboardingPath,
      role,
      onboardingComplete: false,
    }
  }

  const fallback = defaultDestinationForRole(role)
  if (!normalizedNext || isAccountPath(normalizedNext) || isSignupDetailsPath(normalizedNext)) {
    return {
      destination: fallback,
      role,
      onboardingComplete: true,
    }
  }

  return {
    destination: normalizedNext,
    role,
    onboardingComplete: true,
  }
}
