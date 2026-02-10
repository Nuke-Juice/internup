'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type OAuthProvider = 'google' | 'linkedin_oidc'

type Props = {
  roleHint?: 'student' | 'employer'
  className?: string
}

function providerLabel(provider: OAuthProvider) {
  if (provider === 'google') return 'Google'
  return 'LinkedIn'
}

export default function OAuthButtons({ roleHint, className }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function continueWith(provider: OAuthProvider) {
    setError(null)
    setLoadingProvider(provider)

    const supabase = supabaseBrowser()
    const nextPath = roleHint ? `/account?role=${roleHint}` : '/account'
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`

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
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingProvider === 'google' ? 'Connecting…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onClick={() => continueWith('linkedin_oidc')}
          disabled={Boolean(loadingProvider)}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
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
