'use client'

import GlobalErrorToasts from '@/components/feedback/GlobalErrorToasts'
import RouteFeedbackToasts from '@/components/feedback/RouteFeedbackToasts'
import { ToastProvider } from '@/components/feedback/ToastProvider'
import SiteHeader from '@/components/layout/SiteHeader'
import type { UserRole } from '@/lib/auth/roles'

type Props = {
  children: React.ReactNode
  isAuthenticated: boolean
  role?: UserRole
  email?: string | null
  avatarUrl?: string | null
  isEmailVerified?: boolean
  showFinishProfilePrompt?: boolean
  finishProfileHref?: string | null
}

export default function AppShellClient({
  children,
  isAuthenticated,
  role,
  email,
  avatarUrl,
  isEmailVerified,
  showFinishProfilePrompt = false,
  finishProfileHref = null,
}: Props) {
  return (
    <ToastProvider>
      <GlobalErrorToasts />
      <RouteFeedbackToasts />
      <SiteHeader
        isAuthenticated={isAuthenticated}
        role={role}
        email={email}
        avatarUrl={avatarUrl}
        isEmailVerified={isEmailVerified}
        showFinishProfilePrompt={showFinishProfilePrompt}
        finishProfileHref={finishProfileHref}
      />
      {children}
    </ToastProvider>
  )
}
