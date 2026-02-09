'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Bell, FileText, LayoutDashboard, LogIn, Mail, Star, User, Users } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'

type UserRole = 'student' | 'employer'

type SiteHeaderProps = {
  isAuthenticated: boolean
  role?: UserRole
}

function navClasses(isActive: boolean) {
  if (isActive) {
    return 'rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700'
  }

  return 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
}

function primaryButtonClasses(isActive: boolean) {
  if (isActive) {
    return 'inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm'
  }

  return 'inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 hover:shadow'
}

function iconNavClasses(isActive: boolean) {
  if (isActive) {
    return 'inline-flex items-center justify-center p-1 text-slate-800'
  }

  return 'inline-flex items-center justify-center p-1 text-slate-600 transition-colors hover:text-slate-700'
}

function textLinkClasses(isActive: boolean) {
  return `text-sm font-medium transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`
}

export default function SiteHeader({ isAuthenticated, role }: SiteHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showEmployerModal, setShowEmployerModal] = useState(false)
  const [pendingEmployerPath, setPendingEmployerPath] = useState('/dashboard/employer')
  const [signingOut, setSigningOut] = useState(false)

  const homeActive = pathname === '/' || pathname.startsWith('/jobs')
  const notificationsActive = pathname.startsWith('/notifications')
  const inboxActive = pathname.startsWith('/inbox')
  const profileActive = pathname.startsWith('/account')
  const applicationsActive = pathname.startsWith('/applications')
  const dashboardActive = pathname.startsWith('/dashboard/employer')
  const applicantsActive = pathname.startsWith('/dashboard/employer/applicants')
  const employersActive = pathname.startsWith('/signup/employer')
  const loginActive = pathname.startsWith('/login')
  const upgradeActive = pathname.startsWith('/upgrade')

  function handleEmployerTarget(path: string) {
    if (isAuthenticated && role === 'student') {
      setPendingEmployerPath(path)
      setShowEmployerModal(true)
      return
    }
    router.push(path)
  }

  async function signOutToContinue() {
    setSigningOut(true)
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    setSigningOut(false)
    setShowEmployerModal(false)
    router.push(`${pendingEmployerPath}?intent=employer`)
    router.refresh()
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-5">
            <Link href="/" className="inline-flex items-center leading-none">
              <Image
                src="/brand-logo-header.png"
                alt="Internactive"
                width={360}
                height={128}
                className="relative top-[2px] block h-14 w-auto"
                priority
              />
            </Link>
            <Link href="/" className={textLinkClasses(homeActive)}>
              Home
            </Link>
            {!isAuthenticated ? (
              <Link href="/signup/employer" className={textLinkClasses(employersActive)}>
                For Employers
              </Link>
            ) : role === 'student' ? (
              <button type="button" onClick={() => handleEmployerTarget('/dashboard/employer')} className={textLinkClasses(false)}>
                For Employers
              </button>
            ) : role === 'employer' ? (
              <Link href="/dashboard/employer" className={textLinkClasses(dashboardActive || applicantsActive || upgradeActive)}>
                For Employers
              </Link>
            ) : null}
          </div>

          <nav className="flex items-center gap-2">
            {isAuthenticated && role === 'student' ? (
              <Link href="/applications" className={iconNavClasses(applicationsActive)} aria-label="Applications" title="Applications">
                <FileText className="h-5 w-5" />
              </Link>
            ) : null}

            <Link href="/inbox" className={iconNavClasses(inboxActive)} aria-label="Inbox" title="Inbox">
              <Mail className="h-5 w-5" />
            </Link>
            <Link
              href="/notifications"
              className={iconNavClasses(notificationsActive)}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>

            {isAuthenticated && role === 'employer' ? (
              <>
                <Link href="/dashboard/employer" className={navClasses(dashboardActive)}>
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </span>
                </Link>
                <Link href="/dashboard/employer/applicants" className={navClasses(applicantsActive)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Applicants
                  </span>
                </Link>
              </>
            ) : null}

            {isAuthenticated ? (
              <Link href="/account" className={iconNavClasses(profileActive)} aria-label="Profile" title="Profile">
                <User className="h-5 w-5" />
              </Link>
            ) : null}

            {!isAuthenticated ? (
              <Link href="/login" className={primaryButtonClasses(loginActive)}>
                <LogIn className="h-4 w-4" />
                Log in
              </Link>
            ) : null}

            {isAuthenticated && role === 'employer' ? (
              <Link href="/upgrade" className={navClasses(upgradeActive)}>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4" />
                  Upgrade
                </span>
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      {showEmployerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">You&rsquo;re signed in as a student</h2>
            <p className="mt-2 text-sm text-slate-600">Continue as employer?</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={signOutToContinue}
                disabled={signingOut}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {signingOut ? 'Signing out...' : 'Sign out to continue'}
              </button>
              <button
                type="button"
                disabled
                title="Direct role switching is not supported yet."
                className="cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
              >
                Continue (Coming soon)
              </button>
              <button
                type="button"
                onClick={() => setShowEmployerModal(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
