'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useToast } from '@/components/feedback/ToastProvider'
import { normalizeAuthError } from '@/lib/auth/normalizeAuthError'

type ResendState = {
  ok: boolean
  message: string
}

type Props = {
  email: string
  nextUrl: string
  actionName: string
  resendAction: (prevState: ResendState, formData: FormData) => Promise<ResendState>
}

const INITIAL_STATE: ResendState = { ok: false, message: '' }

export default function VerifyRequiredPanel({ email, nextUrl, actionName, resendAction }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(resendAction, INITIAL_STATE)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    showToast({
      kind: 'warning',
      message: 'Verification required before continuing.',
      key: `verify-required:${actionName}:${nextUrl}`,
    })
  }, [actionName, nextUrl, showToast])

  useEffect(() => {
    if (state.ok) {
      setCooldownSeconds(30)
    }
  }, [state.ok])

  useEffect(() => {
    if (!state.message) return
    showToast({
      kind: state.ok ? 'success' : 'error',
      message: state.message,
      key: `verify-resend:${state.ok ? 'ok' : 'err'}:${state.message}`,
    })
  }, [showToast, state.message, state.ok])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setTimeout(() => setCooldownSeconds((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldownSeconds])

  async function checkVerificationStatus(options?: { manual?: boolean }) {
    const manual = options?.manual === true
    if (manual) {
      setRefreshing(true)
      setRefreshError(null)
    } else {
      setChecking(true)
    }

    const supabase = supabaseBrowser()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      if (manual) {
        setRefreshError('No active session found. Sign in again, then verify your email link.')
        showToast({
          kind: 'warning',
          message: 'Session expired. Please sign in again.',
          key: 'verify-session-missing',
        })
      }
      setRefreshing(false)
      setChecking(false)
      return
    }

    const { error } = await supabase.auth.refreshSession()
    if (error) {
      const normalized = normalizeAuthError(error, 'verify')
      if (!manual) {
        setChecking(false)
        return
      }
      setRefreshing(false)
      if (error.message.toLowerCase().includes('refresh token not found')) {
        await supabase.auth.signOut()
        setRefreshError('Session expired. Please sign in again, then click your verification link.')
        showToast({
          kind: 'warning',
          message: 'Session expired. Please sign in again.',
          key: 'verify-refresh-token-missing',
        })
        return
      }
      setRefreshError(normalized.publicMessage)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email_confirmed_at) {
      if (manual) {
        setRefreshError('Email is still unverified. Open your verification email and click the link first.')
        showToast({
          kind: 'warning',
          message: 'Email is still unverified.',
          key: 'verify-still-unverified',
        })
      }
      setRefreshing(false)
      setChecking(false)
      return
    }

    await supabase
      .from('users')
      .update({ verified: true })
      .eq('id', user.id)
      .eq('verified', false)

    setRefreshing(false)
    setChecking(false)
    router.push(`${nextUrl}${nextUrl.includes('?') ? '&' : '?'}verified=1`)
    router.refresh()
  }

  async function signOutNow() {
    setSigningOut(true)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signOut()
    setSigningOut(false)

    if (error) {
      const normalized = normalizeAuthError(error, 'verify')
      setRefreshError(normalized.publicMessage)
      showToast({
        kind: 'error',
        message: normalized.publicMessage,
        key: `verify-signout-error:${normalized.reasonCode}`,
      })
      return
    }

    router.replace('/login')
    router.refresh()
  }

  useEffect(() => {
    const interval = setInterval(() => {
      void checkVerificationStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Verify your email to continue</h1>
      <p className="mt-2 text-sm text-slate-600">
        We sent a confirmation email to <strong>{email}</strong>. This protects employers and students from spam.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Locked action: <span className="font-medium text-slate-900">{actionName.replace(/_/g, ' ')}</span>.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        This page will unlock automatically after you click the verification link.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        If you do not see it in your inbox, check your junk or spam folder.
      </p>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Applying to internships</li>
        <li>Publishing internships as an employer</li>
        <li>Employer inbox access may be gated in future updates</li>
      </ul>

      <form action={formAction} className="mt-5 flex flex-wrap gap-2">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={nextUrl} />
        <button
          type="submit"
          disabled={pending || cooldownSeconds > 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Sending...' : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend verification email'}
        </button>
        <button
          type="button"
          onClick={() => void checkVerificationStatus({ manual: true })}
          disabled={refreshing}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {refreshing ? 'Refreshing...' : 'I verified, refresh'}
        </button>
        <button
          type="button"
          onClick={() => void signOutNow()}
          disabled={signingOut}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-500" aria-live="polite">
        Checking verification status
        <span className="inline-flex w-4 items-end justify-start">
          <span className="animate-pulse [animation-delay:0ms]">.</span>
          <span className="animate-pulse [animation-delay:150ms]">.</span>
          <span className="animate-pulse [animation-delay:300ms]">.</span>
        </span>
      </p>

      {state.message ? (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            state.ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </div>
      ) : null}
      {refreshError ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{refreshError}</div>
      ) : null}
    </div>
  )
}
