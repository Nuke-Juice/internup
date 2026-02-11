import Link from 'next/link'
import { redirect } from 'next/navigation'
import EmployerAccount from '@/components/account/EmployerAccount'
import StudentAccount from '@/components/account/StudentAccount'
import ConfirmSignOutButton from '@/components/auth/ConfirmSignOutButton'
import { ensureUserRole } from '@/lib/auth/ensureUserRole'
import { buildVerifyRequiredHref } from '@/lib/auth/emailVerification'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import { isAdminRole, isAppRole, isUserRole, type AppRole, type UserRole } from '@/lib/auth/roles'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { supabaseServer } from '@/lib/supabase/server'

const isDev = process.env.NODE_ENV !== 'production'

type StudentProfileRow = {
  university_id: string | number | null
  school: string | null
  major_id: string | null
  major?: { id?: string | null; slug?: string | null; name?: string | null } | null
  majors: string[] | string | null
  year: string | null
  coursework: string[] | null
  experience_level: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
  interests: string | null
  preferred_city: string | null
  preferred_state: string | null
  preferred_zip: string | null
  max_commute_minutes: number | null
  transport_mode: string | null
  exact_address_line1: string | null
  location_lat: number | null
  location_lng: number | null
}

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  founded_date: string | null
  location: string | null
  location_city: string | null
  location_state: string | null
  location_zip: string | null
  location_address_line1: string | null
  location_lat: number | null
  location_lng: number | null
  overview: string | null
  avatar_url: string | null
  header_image_url: string | null
}

type EmployerPublicProfileRow = {
  employer_id: string
  company_name: string | null
  tagline: string | null
  about_us: string | null
  website: string | null
  industry: string | null
  founded_date: string | null
  location_city: string | null
  location_state: string | null
  avatar_url: string | null
  header_image_url: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  company_name?: string | null
  location: string | null
  role_category?: string | null
  category?: string | null
  description?: string | null
  pay: string | null
  created_at: string | null
}

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0
}

function cleanLocation(value: string | null | undefined) {
  if (!value) return null
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim() || null
}

function parseCityState(value: string | null | undefined) {
  if (!value) return { city: null as string | null, state: null as string | null }
  const cleaned = cleanLocation(value)
  if (!cleaned) return { city: null as string | null, state: null as string | null }
  const [cityRaw, stateRaw] = cleaned.split(',').map((part) => part.trim())
  const state = stateRaw ? stateRaw.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() : null
  return {
    city: cityRaw || null,
    state: state && state.length === 2 ? state : null,
  }
}

export default async function AccountPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to manage your student preferences or company internships.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Log in
            </Link>
            <Link
              href="/signup/student"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign up as student
            </Link>
            <Link
              href="/signup/employer"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign up as employer
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!user.email_confirmed_at) {
    const verifyHref = `${buildVerifyRequiredHref('/account', 'signup_continue')}&email=${encodeURIComponent(user.email ?? '')}`
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Verify your email to continue</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account is signed in but email verification is still required before profile access.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={verifyHref}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open verification page
            </Link>
            <ConfirmSignOutButton
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              confirmMessage="Sign out and return to login?"
            />
          </div>
        </div>
      </main>
    )
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role, verified')
    .eq('id', user.id)
    .maybeSingle()

  const role: UserRole | null = isUserRole(userRow?.role) ? userRow.role : null
  let isVerificationComplete = userRow?.verified === true
  if (!isVerificationComplete && Boolean(user.email_confirmed_at)) {
    const { error: markVerifiedError } = await supabase
      .from('users')
      .update({ verified: true })
      .eq('id', user.id)
      .eq('verified', false)
    if (!markVerifiedError) {
      isVerificationComplete = true
    }
  }

  if (!isVerificationComplete) {
    const verifyHref = `${buildVerifyRequiredHref('/account', 'signup_email_verification_pending')}&email=${encodeURIComponent(user.email ?? '')}`
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Verification in progress</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your email is confirmed but final verification is still processing for this account.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={verifyHref}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open verification page
            </Link>
            <ConfirmSignOutButton
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              confirmMessage="Sign out and return to login?"
            />
          </div>
        </div>
      </main>
    )
  }

  if (role && isAdminRole(role)) {
    if (isDev) {
      console.debug('[RBAC] role chooser bypassed for admin', {
        userId: user.id,
        role,
        route: '/account',
      })
    }
    redirect('/admin')
  }

  async function chooseRole(formData: FormData) {
    'use server'

    const selectedRoleRaw = String(formData.get('role') ?? '')
    if (selectedRoleRaw !== 'student' && selectedRoleRaw !== 'employer') {
      redirect('/account?error=Choose+an+account+type')
    }
    const selectedRole = selectedRoleRaw as AppRole

    const actionSupabase = await supabaseServer()
    const {
      data: { user: actionUser },
    } = await actionSupabase.auth.getUser()

    if (!actionUser) redirect('/login')
    if (!actionUser.email_confirmed_at) {
      redirect(buildVerifyRequiredHref('/account', 'signup_continue'))
    }
    const { data: verificationRow } = await actionSupabase
      .from('users')
      .select('verified')
      .eq('id', actionUser.id)
      .maybeSingle<{ verified: boolean | null }>()
    if (verificationRow?.verified !== true) {
      redirect(buildVerifyRequiredHref('/account', 'signup_email_verification_pending'))
    }

    let finalRole: UserRole
    try {
      finalRole = await ensureUserRole(actionUser.id, selectedRole, { explicitSwitch: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update role'
      redirect(`/account?error=${encodeURIComponent(message)}`)
    }

    if (isAdminRole(finalRole)) {
      if (isDev) {
        console.debug('[RBAC] chooser submit ignored for admin role', {
          userId: actionUser.id,
          selectedRole,
          finalRole,
        })
      }
      redirect('/admin')
    }

    if (finalRole === 'student') {
      redirect('/signup/student/details')
    }

    if (finalRole === 'employer') {
      redirect('/signup/employer/details')
    }

    redirect('/account')
  }

  if (!role) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Choose account type</h1>
          <p className="mt-2 text-sm text-slate-600">
            Pick this once so we can route your account automatically.
          </p>

          <form action={chooseRole} className="mt-6 grid gap-3">
            <button
              type="submit"
              name="role"
              value="student"
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Student
            </button>
            <button
              type="submit"
              name="role"
              value="employer"
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Employer
            </button>
          </form>
        </div>
      </main>
    )
  }

  if (!isAppRole(role)) {
    redirect('/')
  }

  if (role === 'student') {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select(
        'university_id, school, major_id, major:canonical_majors(id, slug, name), majors, year, coursework, experience_level, availability_start_month, availability_hours_per_week, interests, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode, exact_address_line1, location_lat, location_lng'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (!getMinimumProfileCompleteness(profile).ok) {
      redirect('/signup/student/details')
    }

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex justify-end">
            <Link
              href="/account/security"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Security settings
            </Link>
          </div>
          <StudentAccount userId={user.id} initialProfile={(profile ?? null) as StudentProfileRow | null} />
        </div>
      </main>
    )
  }

  const [{ data: employerProfile }, { data: publicProfile }, { data: internships }] = await Promise.all([
    supabase
      .from('employer_profiles')
      .select('company_name, website, contact_email, industry, founded_date, location, location_city, location_state, location_zip, location_address_line1, location_lat, location_lng, overview, avatar_url, header_image_url')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('employer_public_profiles')
      .select('employer_id, company_name, tagline, about_us, website, industry, founded_date, location_city, location_state, avatar_url, header_image_url')
      .eq('employer_id', user.id)
      .maybeSingle(),
    supabase
      .from('internships')
      .select('id, title, company_name, location, role_category, category, description, pay, created_at')
      .eq('employer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const recentInternships = (internships ?? []) as InternshipRow[]
  const latestInternship = recentInternships[0] ?? null

  const inferredCompanyName = latestInternship?.company_name?.trim() || null
  const inferredLocation = cleanLocation(latestInternship?.location ?? null)
  const inferredCityState = parseCityState(inferredLocation)
  const inferredIndustry = latestInternship?.role_category?.trim() || latestInternship?.category?.trim() || null
  const inferredOverview = latestInternship?.description?.trim() || null

  const profileWithFallback: EmployerProfileRow | null = employerProfile
    ? {
        ...employerProfile,
        company_name: isBlank(employerProfile.company_name) ? inferredCompanyName : employerProfile.company_name,
        location: isBlank(employerProfile.location) ? inferredLocation : employerProfile.location,
        location_city: isBlank(employerProfile.location_city) ? inferredCityState.city : employerProfile.location_city,
        location_state: isBlank(employerProfile.location_state) ? inferredCityState.state : employerProfile.location_state,
        location_zip: employerProfile.location_zip,
        location_address_line1: employerProfile.location_address_line1,
        location_lat: employerProfile.location_lat,
        location_lng: employerProfile.location_lng,
        industry: isBlank(employerProfile.industry) ? inferredIndustry : employerProfile.industry,
        founded_date: employerProfile.founded_date,
        overview: isBlank(employerProfile.overview) ? inferredOverview : employerProfile.overview,
        contact_email: isBlank(employerProfile.contact_email) ? (user.email ?? null) : employerProfile.contact_email,
      }
    : latestInternship
      ? {
          company_name: inferredCompanyName,
          website: null,
          contact_email: user.email ?? null,
          industry: inferredIndustry,
          founded_date: null,
          location: inferredLocation,
          location_city: inferredCityState.city,
          location_state: inferredCityState.state,
          location_zip: null,
          location_address_line1: null,
          location_lat: null,
          location_lng: null,
          overview: inferredOverview,
          avatar_url: null,
          header_image_url: null,
        }
      : ((employerProfile ?? null) as EmployerProfileRow | null)

  const publicProfileWithFallback: EmployerPublicProfileRow | null = {
    employer_id: user.id,
    company_name: publicProfile?.company_name ?? profileWithFallback?.company_name ?? inferredCompanyName,
    tagline: publicProfile?.tagline ?? null,
    about_us: publicProfile?.about_us ?? profileWithFallback?.overview ?? inferredOverview,
    website: publicProfile?.website ?? profileWithFallback?.website ?? null,
    industry: publicProfile?.industry ?? profileWithFallback?.industry ?? inferredIndustry,
    founded_date: publicProfile?.founded_date ?? profileWithFallback?.founded_date ?? null,
    location_city: publicProfile?.location_city ?? profileWithFallback?.location_city ?? inferredCityState.city,
    location_state: publicProfile?.location_state ?? profileWithFallback?.location_state ?? inferredCityState.state,
    avatar_url: publicProfile?.avatar_url ?? profileWithFallback?.avatar_url ?? null,
    header_image_url: publicProfile?.header_image_url ?? profileWithFallback?.header_image_url ?? null,
  }

  if (profileWithFallback) {
    const needsSync =
      !employerProfile ||
      profileWithFallback.company_name !== employerProfile.company_name ||
      profileWithFallback.location !== employerProfile.location ||
      profileWithFallback.location_city !== employerProfile.location_city ||
      profileWithFallback.location_state !== employerProfile.location_state ||
      profileWithFallback.location_zip !== employerProfile.location_zip ||
      profileWithFallback.location_address_line1 !== employerProfile.location_address_line1 ||
      profileWithFallback.location_lat !== employerProfile.location_lat ||
      profileWithFallback.location_lng !== employerProfile.location_lng ||
      profileWithFallback.industry !== employerProfile.industry ||
      profileWithFallback.founded_date !== employerProfile.founded_date ||
      profileWithFallback.overview !== employerProfile.overview ||
      profileWithFallback.contact_email !== employerProfile.contact_email

    if (needsSync) {
      await supabase.from('employer_profiles').upsert(
        {
          user_id: user.id,
          company_name: profileWithFallback.company_name,
          website: profileWithFallback.website,
          contact_email: profileWithFallback.contact_email,
          industry: profileWithFallback.industry,
          founded_date: profileWithFallback.founded_date,
          location: profileWithFallback.location,
          location_city: profileWithFallback.location_city,
          location_state: profileWithFallback.location_state,
          location_zip: profileWithFallback.location_zip,
          location_address_line1: profileWithFallback.location_address_line1,
          location_lat: profileWithFallback.location_lat,
          location_lng: profileWithFallback.location_lng,
          overview: profileWithFallback.overview,
          avatar_url: profileWithFallback.avatar_url,
          header_image_url: profileWithFallback.header_image_url,
        },
        { onConflict: 'user_id' }
      )
    }
  }

  const { planId } = await getEmployerVerificationStatus({ supabase, userId: user.id })
  const isEmailVerified = Boolean(user.email_confirmed_at)
  const metadata = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string }
  const fullNameTokens =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean)
      : []
  const employerFirstName = typeof metadata.first_name === 'string' ? metadata.first_name : fullNameTokens[0] ?? ''
  const employerLastName =
    typeof metadata.last_name === 'string' ? metadata.last_name : fullNameTokens.slice(1).join(' ')

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <EmployerAccount
          userId={user.id}
          userEmail={user.email ?? null}
          initialFirstName={employerFirstName}
          initialLastName={employerLastName}
          initialProfile={profileWithFallback}
          initialPublicProfile={publicProfileWithFallback}
          recentInternships={recentInternships}
          planId={planId}
          isEmailVerified={isEmailVerified}
        />
      </div>
    </main>
  )
}
