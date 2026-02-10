'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type Props = {
  email: string
}

function getPasswordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.'
  return null
}

export default function SecuritySettings({ email }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function updatePassword() {
    setPasswordError(null)
    setPasswordSuccess(null)

    const passwordErrorMessage = getPasswordError(password)
    if (passwordErrorMessage) return setPasswordError(passwordErrorMessage)
    if (password !== confirmPassword) {
      return setPasswordError('Passwords do not match.')
    }

    setUpdatingPassword(true)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.updateUser({ password })
    setUpdatingPassword(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setPassword('')
    setConfirmPassword('')
    setPasswordSuccess('Password updated.')
  }

  async function deleteAccount() {
    setDeleteError(null)

    const confirmed = window.confirm('Delete your account permanently? This cannot be undone.')
    if (!confirmed) return

    setDeletingAccount(true)

    const response = await fetch('/api/auth/delete-account', { method: 'POST' })
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!response.ok || !payload?.ok) {
      setDeletingAccount(false)
      setDeleteError(payload?.error ?? 'Could not delete account.')
      return
    }

    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = '/?account_deleted=1'
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Password</h2>
        <p className="mt-1 text-sm text-slate-600">Signed in as {email}</p>

        <div className="mt-4 grid gap-4 sm:max-w-md">
          <div>
            <label className="text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
            />
          </div>

          {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
          {passwordSuccess ? <p className="text-sm text-emerald-700">{passwordSuccess}</p> : null}

          <button
            type="button"
            onClick={updatePassword}
            disabled={updatingPassword}
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {updatingPassword ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-600">Delete your account and associated profile data.</p>

        {deleteError ? <p className="mt-3 text-sm text-red-600">{deleteError}</p> : null}

        <button
          type="button"
          onClick={deleteAccount}
          disabled={deletingAccount}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          {deletingAccount ? 'Deleting account...' : 'Delete account'}
        </button>
      </section>
    </div>
  )
}
