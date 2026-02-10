'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import OAuthButtons from '@/components/auth/OAuthButtons'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

function getPasswordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.'
  return null
}

export default function EmployerSignupPage() {
  const friendlyCaptchaError = 'Please verify you\'re human and try again.'
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const roleStep2Path = '/signup/employer/details'
  const verifyRequiredPath = `/verify-required?next=${encodeURIComponent(roleStep2Path)}&action=signup_profile_completion`

  const queryError = useMemo(() => {
    const value = searchParams.get('error')
    return value ? decodeURIComponent(value) : null
  }, [searchParams])

  async function createAccount() {
    setError(null)
    setSuccess(null)

    if (!email.trim() || !password) {
      return setError('Email, password, and confirm password are required.')
    }

    const passwordError = getPasswordError(password)
    if (passwordError) return setError(passwordError)
    if (password !== confirmPassword) {
      return setError('Passwords do not match. Re-enter both fields and try again.')
    }
    if (!turnstileToken) return setError(friendlyCaptchaError)

    setLoading(true)

    try {
      const captchaResponse = await fetch('/api/turnstile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: turnstileToken,
          action: 'employer_signup',
        }),
      })

      if (!captchaResponse.ok) {
        setLoading(false)
        setTurnstileToken('')
        setTurnstileKey((value) => value + 1)
        return setError(friendlyCaptchaError)
      }
    } catch {
      setLoading(false)
      setTurnstileToken('')
      setTurnstileKey((value) => value + 1)
      return setError(friendlyCaptchaError)
    }

    const supabase = supabaseBrowser()
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
    const appOrigin = configuredAppUrl || window.location.origin

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${appOrigin}/auth/callback?next=${encodeURIComponent(roleStep2Path)}`,
        data: {
          role_hint: 'employer',
        },
      },
    })

    if (signUpError) {
      setLoading(false)
      const message = signUpError.message.toLowerCase()
      if (message.includes('rate limit') || message.includes('email rate limit exceeded')) {
        return setError(
          'Email rate limit reached. Please wait a moment before trying again, or use an existing account.'
        )
      }
      return setError(signUpError.message)
    }

    const userId = data.user?.id
    if (!userId) {
      setLoading(false)
      return setError('Signup succeeded but no user was returned.')
    }

    setLoading(false)
    setSuccess('Verification email sent. Verify your email before continuing to profile details.')
    window.location.href = verifyRequiredPath
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              Employer signup
            </h1>
            <p className="mt-2 text-slate-600">Step 1 of 2: create your account, then verify your email.</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Account</h2>
          <OAuthButtons roleHint="employer" className="mt-4" />
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Or continue with email and password.</p>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                className={FIELD}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                className={FIELD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <input
                type="password"
                className={FIELD}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>

          {queryError ? <p className="mt-4 text-sm text-amber-700">{queryError}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

          <TurnstileWidget
            key={turnstileKey}
            action="employer_signup"
            className="mt-4"
            onTokenChange={setTurnstileToken}
          />

          <button
            type="button"
            onClick={createAccount}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account and verify email'}
          </button>

          <p className="mt-4 text-xs text-slate-500">Step 2 unlocks after email verification.</p>
        </div>
      </div>
    </main>
  )
}
