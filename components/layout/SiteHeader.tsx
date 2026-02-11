'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { Bell, FileText, LayoutDashboard, LogIn, Mail, Menu, ShieldCheck, User, X } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { isAdminRole, type UserRole } from '@/lib/auth/roles'
import { useToast } from '@/components/feedback/ToastProvider'

type SiteHeaderProps = {
  isAuthenticated: boolean
  role?: UserRole
  email?: string | null
  avatarUrl?: string | null
  isEmailVerified?: boolean
  showFinishProfilePrompt?: boolean
  finishProfileHref?: string | null
}

type SearchSuggestion = {
  label: string
  value: string
  kind: 'employer' | 'internship'
}

function navClasses(isActive: boolean) {
  if (isActive) {
    return 'inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-700'
  }

  return 'inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50'
}

function primaryButtonClasses(isActive: boolean) {
  if (isActive) {
    return 'inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm'
  }

  return 'inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 hover:shadow'
}

function iconNavClasses(isActive: boolean) {
  if (isActive) {
    return 'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-800'
  }

  return 'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-700'
}

function textLinkClasses(isActive: boolean) {
  return `text-sm font-medium transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`
}

export default function SiteHeader({
  isAuthenticated,
  role,
  email,
  avatarUrl = null,
  isEmailVerified = true,
  showFinishProfilePrompt = false,
  finishProfileHref = null,
}: SiteHeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [resendingVerification, setResendingVerification] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [menuSearchQuery, setMenuSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false)
  const [onboardingPromptDismissed, setOnboardingPromptDismissed] = useState(false)
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(avatarUrl)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { showToast } = useToast()

  const homeActive = pathname === '/' || pathname.startsWith('/jobs')
  const notificationsActive = pathname.startsWith('/notifications')
  const inboxActive = pathname.startsWith('/inbox') || pathname.startsWith('/dashboard/employer/applicants')
  const profileActive = pathname.startsWith('/account')
  const profilePageActive = pathname.startsWith('/profile')
  const adminActive = pathname.startsWith('/admin')
  const applicationsActive = pathname.startsWith('/applications')
  const dashboardActive = pathname.startsWith('/dashboard/employer')
  const employersActive = pathname.startsWith('/signup/employer') || pathname.startsWith('/for-employers')
  const loginActive = pathname.startsWith('/login')
  const upgradeActive = pathname.startsWith('/upgrade')
  const isAdmin = isAdminRole(role)
  const showVerificationBanner = isAuthenticated && !isEmailVerified
  const inboxHref = role === 'employer' ? '/dashboard/employer/applicants' : '/inbox'

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  useEffect(() => {
    const query = (searchParams.get('q') ?? '').trim()
    setMenuSearchQuery(query)
  }, [searchParams])

  useEffect(() => {
    setHeaderAvatarUrl(avatarUrl)
  }, [avatarUrl])

  useEffect(() => {
    if (!isAuthenticated) {
      setHeaderAvatarUrl(null)
      return
    }

    const supabase = supabaseBrowser()
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const metadata = (session?.user?.user_metadata ?? {}) as { avatar_url?: string }
      if (typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim().length > 0) {
        setHeaderAvatarUrl(metadata.avatar_url)
      } else {
        setHeaderAvatarUrl(null)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [isAuthenticated])

  useEffect(() => {
    let cancelled = false
    const query = menuSearchQuery.trim()
    if (!query) {
      setSearchSuggestions([])
      return
    }

    const timer = window.setTimeout(async () => {
      const supabase = supabaseBrowser()
      const normalizedQuery = query.replace(/[%_]/g, '')
      const makeRows = (items: Array<{ value: string; kind: 'employer' | 'internship' }>) => {
        const dedup = new Map<string, SearchSuggestion>()
        for (const item of items) {
          const trimmed = item.value.trim()
          if (!trimmed) continue
          const key = `${item.kind}:${trimmed.toLowerCase()}`
          if (!dedup.has(key)) {
            dedup.set(key, { value: trimmed, label: trimmed, kind: item.kind })
          }
        }
        return Array.from(dedup.values()).slice(0, 8)
      }

      const [{ data: internshipRows }, { data: employerRows }] = await Promise.all([
        supabase
          .from('internships')
          .select('title')
          .eq('is_active', true)
          .ilike('title', `%${normalizedQuery}%`)
          .limit(5),
        supabase
          .from('internships')
          .select('company_name')
          .eq('is_active', true)
          .ilike('company_name', `%${normalizedQuery}%`)
          .limit(5),
      ])

      if (cancelled) return
      setSearchSuggestions(
        makeRows([
          ...(internshipRows ?? []).map((row) => ({ value: row.title ?? '', kind: 'internship' as const })),
          ...(employerRows ?? []).map((row) => ({ value: row.company_name ?? '', kind: 'employer' as const })),
        ])
      )
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [menuSearchQuery])

  useEffect(() => {
    if (!showFinishProfilePrompt) {
      setOnboardingPromptDismissed(false)
      return
    }
    const storageKey = `finish-profile-dismissed:${email ?? 'unknown'}`
    const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) === '1' : false
    setOnboardingPromptDismissed(dismissed)
  }, [email, showFinishProfilePrompt])

  function submitMenuSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchSuggestionsOpen(false)
    const normalizedQuery = menuSearchQuery.trim()
    const params = new URLSearchParams()

    if (normalizedQuery) params.set('q', normalizedQuery)

    const next = params.toString()
    router.push(next ? `/?${next}#internships` : '/#internships')
  }

  function dismissOnboardingPrompt() {
    const storageKey = `finish-profile-dismissed:${email ?? 'unknown'}`
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, '1')
    }
    setOnboardingPromptDismissed(true)
  }

  async function resendVerification(nextPath: string) {
    if (!email || resendCooldown > 0) return
    setResendingVerification(true)

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next: nextPath }),
      })
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string }
      if (!response.ok || !payload.ok) {
        showToast({
          kind: 'error',
          message: payload.error ?? 'Could not resend verification email.',
          key: `resend-verification-error:${payload.error ?? 'unknown'}`,
        })
      } else {
        showToast({
          kind: 'success',
          message: payload.message ?? 'Verification email sent.',
          key: 'resend-verification-success',
        })
        setResendCooldown(30)
      }
    } catch {
      showToast({ kind: 'error', message: 'Could not resend verification email.', key: 'resend-verification-network' })
    } finally {
      setResendingVerification(false)
    }
  }

  useEffect(() => {
    if (!showVerificationBanner) return
    const storageKey = `verify-warning-shown:${email ?? 'unknown'}`
    const seen = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null
    if (seen) return
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, '1')
    }
    showToast({
      kind: 'warning',
      message: 'Verify your email to apply/post.',
      key: storageKey,
      actionLabel: 'Resend email',
      onAction: async () => {
        await resendVerification(pathname || '/')
      },
    })
  }, [email, pathname, showToast, showVerificationBanner])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
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
              <Link href="/" className={`hidden md:inline ${textLinkClasses(homeActive)}`}>
                Home
              </Link>
              {!isAuthenticated ? (
                <Link href="/signup/employer" className={`hidden md:inline ${textLinkClasses(employersActive)}`}>
                  For Employers
                </Link>
              ) : isAdmin ? (
                <Link href="/admin" className={`hidden md:inline ${textLinkClasses(adminActive)}`}>
                  Admin Dashboard
                </Link>
              ) : role === 'student' ? (
                <Link href="/for-employers" className={`hidden md:inline ${textLinkClasses(employersActive)}`}>
                  For Employers
                </Link>
              ) : null}
            </div>

            <nav className="hidden items-center gap-2 md:flex">
              <form onSubmit={submitMenuSearch} className="relative hidden items-center gap-2 lg:flex">
                <div className="relative">
                  <input
                    value={menuSearchQuery}
                    onChange={(event) => {
                      setMenuSearchQuery(event.target.value)
                      setSearchSuggestionsOpen(true)
                    }}
                    onFocus={() => setSearchSuggestionsOpen(true)}
                    onBlur={() => setTimeout(() => setSearchSuggestionsOpen(false), 120)}
                    placeholder="Search"
                    aria-label="Search"
                    className="h-9 w-72 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {searchSuggestionsOpen && menuSearchQuery.trim().length > 0 ? (
                    <div className="absolute left-0 z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {searchSuggestions.length > 0 ? (
                        searchSuggestions.map((item, index) => (
                          <button
                            key={`${item.kind}:${item.value}:${index}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setMenuSearchQuery(item.value)
                              setSearchSuggestionsOpen(false)
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className="font-medium">{item.label}</span>
                            <span className="ml-2 text-xs text-slate-500">
                              {item.kind === 'employer' ? 'Employer' : 'Internship'}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">No results found.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </form>

              {isAuthenticated && role === 'employer' ? (
                <Link href="/dashboard/employer" className={navClasses(dashboardActive)}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
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
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  Upgrade
                </Link>
              ) : null}

              <div className="flex items-center gap-2">
                {isAuthenticated && role === 'student' ? (
                  <Link href="/applications" className={iconNavClasses(applicationsActive)} aria-label="Applications" title="Applications">
                    <FileText className="h-5 w-5" />
                  </Link>
                ) : null}
                <Link href={inboxHref} className={iconNavClasses(inboxActive)} aria-label="Inbox" title="Inbox">
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
              </div>

              {isAuthenticated ? (
                <div className="relative">
                  <Link
                    href="/profile"
                    className={iconNavClasses(profilePageActive || profileActive)}
                    aria-label="Profile"
                    title="Profile"
                  >
                    {headerAvatarUrl ? (
                      <img
                        src={headerAvatarUrl}
                        alt="Profile"
                        className="h-7 w-7 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </Link>
                  {showFinishProfilePrompt && !onboardingPromptDismissed ? (
                    <span className="absolute right-0 top-0 block h-2.5 w-2.5 rounded-full border border-amber-200 bg-amber-400" />
                  ) : null}
                </div>
              ) : null}

              {isAuthenticated && isAdmin ? (
                <span className="hidden items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 md:inline-flex">
                  Admin
                </span>
              ) : null}
            </nav>

            <div className="flex items-center gap-2 md:hidden">
              {isAuthenticated && role === 'student' ? (
                <Link href="/applications" className={iconNavClasses(applicationsActive)} aria-label="Applications" title="Applications">
                  <FileText className="h-5 w-5" />
                </Link>
              ) : null}
              <Link href={inboxHref} className={iconNavClasses(inboxActive)} aria-label="Inbox" title="Inbox">
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
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className={iconNavClasses(mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen ? (
            <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:hidden">
              <form onSubmit={submitMenuSearch} className="relative">
                <input
                  value={menuSearchQuery}
                  onChange={(event) => setMenuSearchQuery(event.target.value)}
                  placeholder="Search employers or internships"
                  aria-label="Search"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </form>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/" className={navClasses(homeActive)}>
                  Home
                </Link>
                {!isAuthenticated ? (
                  <Link href="/login" className={primaryButtonClasses(loginActive)}>
                    <LogIn className="h-4 w-4" />
                    Log in
                  </Link>
                ) : (
                  <Link href="/profile" className={navClasses(profilePageActive || profileActive)}>
                    Profile
                  </Link>
                )}
                {isAuthenticated && role === 'employer' ? (
                  <>
                    <Link href="/dashboard/employer" className={navClasses(dashboardActive)}>
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link href="/upgrade" className={navClasses(upgradeActive)}>
                      <ShieldCheck className="h-4 w-4 text-amber-500" />
                      Upgrade
                    </Link>
                  </>
                ) : null}
                {!isAuthenticated ? (
                  <Link href="/signup/employer" className={navClasses(employersActive)}>
                    For Employers
                  </Link>
                ) : isAdmin ? (
                  <Link href="/admin" className={navClasses(adminActive)}>
                    Admin Dashboard
                  </Link>
                ) : role === 'student' ? (
                  <Link href="/for-employers" className={navClasses(employersActive)}>
                    For Employers
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {showFinishProfilePrompt && !onboardingPromptDismissed && finishProfileHref ? (
            <div className="mt-2 flex items-center gap-2">
              <Link
                href={finishProfileHref}
                className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Finish your profile
              </Link>
              <button
                type="button"
                aria-label="Dismiss finish profile prompt"
                onClick={dismissOnboardingPrompt}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50"
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
      </header>

    </>
  )
}
