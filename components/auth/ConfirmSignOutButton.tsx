'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

type Props = {
  className?: string
  confirmMessage?: string
  label?: string
  redirectTo?: string
}

export default function ConfirmSignOutButton({
  className = 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50',
  confirmMessage = 'Are you sure you want to sign out?',
  label = 'Sign out',
  redirectTo = '/',
}: Props) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    setSigningOut(false)
    setConfirmOpen(false)
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <>
      <button type="button" disabled={signingOut} onClick={() => setConfirmOpen(true)} className={className}>
        {signingOut ? 'Signing out...' : label}
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Sign out</h2>
            <p className="mt-2 text-sm text-slate-600">{confirmMessage}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={signingOut}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
