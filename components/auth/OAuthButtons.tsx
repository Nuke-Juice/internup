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
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.48a5.54 5.54 0 0 1-2.4 3.64v3h3.88c2.27-2.1 3.53-5.18 3.53-8.67z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.94l-3.88-3A7.2 7.2 0 0 1 12 19.3a7.13 7.13 0 0 1-6.7-4.93H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.37A7.2 7.2 0 0 1 4.9 12c0-.82.15-1.62.4-2.37v-3.1H1.3A12 12 0 0 0 0 12c0 1.92.46 3.73 1.3 5.47l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.6 4.6 1.8l3.45-3.45A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.3 6.53l4 3.1A7.13 7.13 0 0 1 12 4.77z"
      />
    </svg>
  )
}

function LinkedInMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-5 w-5" focusable="false">
      <path
        fill="#0A66C2"
        d="M0 1.15C0 .52.52 0 1.15 0h13.7c.63 0 1.15.52 1.15 1.15v13.7c0 .63-.52 1.15-1.15 1.15H1.15A1.15 1.15 0 0 1 0 14.85V1.15z"
      />
      <path
        fill="#fff"
        d="M4.94 6.13H3.18v5.65h1.76V6.13zM4.06 5.36c.61 0 1.1-.5 1.1-1.1 0-.61-.49-1.1-1.1-1.1-.6 0-1.09.49-1.09 1.1 0 .6.49 1.1 1.1 1.1zM12.86 11.78h-1.75V8.93c0-.68-.01-1.56-.95-1.56-.95 0-1.1.74-1.1 1.5v2.91H7.31V6.13h1.68v.77h.02c.24-.44.81-.9 1.66-.9 1.78 0 2.1 1.17 2.1 2.69v3.09z"
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
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleMark />
          {loadingProvider === 'google' ? 'Connecting…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={() => continueWith('linkedin_oidc')}
          disabled={Boolean(loadingProvider)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
