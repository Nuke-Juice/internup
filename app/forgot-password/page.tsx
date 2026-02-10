'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function sendReset() {
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError('Email is required.')
      return
    }

    setLoading(true)
    const supabase = supabaseBrowser()
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
    const appOrigin = configuredAppUrl || window.location.origin

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appOrigin}/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSuccess('Reset email sent. Check your inbox for the password reset link.')
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

        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-slate-600">Enter your email and we will send a reset link.</p>

        <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 shadow-md">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              placeholder="you@email.com"
            />
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}

          <button
            type="button"
            onClick={sendReset}
            disabled={loading}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Send reset email'}
          </button>
        </div>
      </div>
    </main>
  )
}
