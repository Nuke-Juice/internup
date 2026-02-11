'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import PressRevealPasswordField from '@/components/forms/PressRevealPasswordField'
import { normalizeAuthError } from '@/lib/auth/normalizeAuthError'

function getPasswordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.'
  return null
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [revealingPasswords, setRevealingPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()

    async function initialize() {
      setInitializing(true)
      setError(null)
      const code = searchParams.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          const normalized = normalizeAuthError(exchangeError, 'reset_exchange')
          setError(`${normalized.publicMessage} Request a new reset link.`)
          setReady(false)
          setInitializing(false)
          return
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      setReady(Boolean(session))
      if (!session) {
        setError('No active reset session found. Request a new reset link.')
      }
      setInitializing(false)
    }

    void initialize()
  }, [searchParams])

  async function updatePassword() {
    setError(null)
    setSuccess(null)

    const passwordError = getPasswordError(password)
    if (passwordError) return setError(passwordError)
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    const supabase = supabaseBrowser()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      const normalized = normalizeAuthError(updateError, 'reset_update')
      setError(normalized.publicMessage)
      return
    }

    setSuccess('Password reset complete. You can now continue with your updated password.')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-md">
        <Link
          href="/login"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Reset password</h1>
        <p className="mt-2 text-slate-600">Set a new password for your account.</p>

        <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 shadow-md">
          {initializing ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Checking reset link...</p>
            </div>
          ) : !ready ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{error ?? 'No active reset session found. Request a new reset link.'}</p>
              <Link href="/forgot-password" className="text-sm font-medium text-blue-700 hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700">New password</label>
                <PressRevealPasswordField
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  revealed={revealingPasswords}
                  onRevealChange={setRevealingPasswords}
                />
              </div>
              <div className="mt-3">
                <label className="text-sm font-medium text-slate-700">Confirm new password</label>
                <PressRevealPasswordField
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  revealed={revealingPasswords}
                  onRevealChange={setRevealingPasswords}
                />
              </div>

              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
              {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

              <button
                type="button"
                onClick={updatePassword}
                disabled={loading}
                className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
