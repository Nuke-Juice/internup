import type { Metadata } from 'next'
import AppShellClient from '@/components/layout/AppShellClient'
import { isAppRole, isUserRole, type AppRole, type UserRole } from '@/lib/auth/roles'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { supabaseServer } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Internactive',
  description: 'Internships that fit your major and schedule.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=3' },
      { url: '/icon.png?v=3', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png?v=3', type: 'image/png' }],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: UserRole | undefined
  let email: string | null = null
  let avatarUrl: string | null = null
  let isEmailVerified = true
  let showFinishProfilePrompt = false
  let finishProfileHref: string | null = null
  if (user) {
    email = user.email ?? null
    const metadata = (user.user_metadata ?? {}) as { avatar_url?: string }
    avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null
    isEmailVerified = Boolean(user.email_confirmed_at)
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (isUserRole(userRow?.role)) {
      role = userRow.role
    }

    const authMetadata = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string }
    const hasNameFromSplitFields =
      typeof authMetadata.first_name === 'string' &&
      authMetadata.first_name.trim().length > 0 &&
      typeof authMetadata.last_name === 'string' &&
      authMetadata.last_name.trim().length > 0
    const fullNameTokens =
      typeof authMetadata.full_name === 'string'
        ? authMetadata.full_name
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean)
        : []
    const hasNameFromFullName = fullNameTokens.length >= 2
    const hasIdentityName = hasNameFromSplitFields || hasNameFromFullName

    if (isAppRole(role)) {
      finishProfileHref = role === 'student' ? '/signup/student/details' : '/signup/employer/details'
      let roleComplete = false

      if (role === 'student') {
        const { data: profile } = await supabase
          .from('student_profiles')
          .select('school, major_id, majors, availability_start_month, availability_hours_per_week')
          .eq('user_id', user.id)
          .maybeSingle()

        roleComplete = getMinimumProfileCompleteness(profile).ok
      } else {
        const { data: profile } = await supabase
          .from('employer_profiles')
          .select('company_name, location_address_line1')
          .eq('user_id', user.id)
          .maybeSingle<{ company_name: string | null; location_address_line1: string | null }>()

        roleComplete =
          typeof profile?.company_name === 'string' &&
          profile.company_name.trim().length > 0 &&
          typeof profile?.location_address_line1 === 'string' &&
          profile.location_address_line1.trim().length > 0
      }

      showFinishProfilePrompt = !hasIdentityName || !roleComplete
    }
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <AppShellClient
          isAuthenticated={Boolean(user)}
          role={role}
          email={email}
          avatarUrl={avatarUrl}
          isEmailVerified={isEmailVerified}
          showFinishProfilePrompt={showFinishProfilePrompt}
          finishProfileHref={finishProfileHref}
        >
          {children}
        </AppShellClient>
      </body>
    </html>
  )
}
