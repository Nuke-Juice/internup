'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type OAuthProvider = 'google' | 'linkedin_oidc'

type Props = {
  roleHint?: 'student' | 'employer'
  nextPath?: string
  className?: string
}

function providerLabel(provider: OAuthProvider) {
  if (provider === 'google') return 'Google'
  return 'LinkedIn'
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  )
}

function LinkedInMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
      <circle cx="8" cy="8" r="1.5" fill="#fff" />
      <rect x="6.8" y="10" width="2.4" height="7" fill="#fff" />
      <path
        fill="#fff"
        d="M11 10h2.3v1c.5-.8 1.4-1.3 2.6-1.3 2.3 0 3.1 1.5 3.1 3.8V17h-2.4v-3.1c0-1.4-.4-2-1.4-2-1.1 0-1.8.7-1.8 2.1V17H11v-7z"
      />
    </svg>
  )
}

function normalizeNextPath(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  return trimmed
}

export default function OAuthButtons({ roleHint, nextPath, className }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function continueWith(provider: OAuthProvider) {
    setError(null)
    setLoadingProvider(provider)

    const supabase = supabaseBrowser()
    const defaultNextPath = roleHint ? `/signup/${roleHint}/details?role=${roleHint}` : '/account'
    const destinationPath = normalizeNextPath(nextPath) ?? defaultNextPath
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destinationPath)}`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoadingProvider(null)
      return
    }
  }

  return (
    <div className={className}>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => continueWith('google')}
          disabled={Boolean(loadingProvider)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleMark />
          {loadingProvider === 'google' ? 'Connecting…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={() => continueWith('linkedin_oidc')}
          disabled={Boolean(loadingProvider)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LinkedInMark />
          {loadingProvider === 'linkedin_oidc' ? 'Connecting…' : 'Continue with LinkedIn'}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">OAuth error: {error}</p> : null}
      <p className="mt-2 text-xs text-slate-500">
        OAuth creates or signs into your account with {providerLabel('google')} or {providerLabel('linkedin_oidc')}, then returns here.
      </p>
    </div>
  )
}
