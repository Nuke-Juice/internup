import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import VerifyRequiredPanel from './_components/VerifyRequiredPanel'
import { supabaseServer } from '@/lib/supabase/server'
import { resendVerificationEmailAction } from '@/lib/auth/emailVerificationServer'
import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'
import { normalizeAuthError } from '@/lib/auth/normalizeAuthError'

type SearchParams = Promise<{
  next?: string
  action?: string
  email?: string
}>

function normalizeEmailHint(value: string | undefined) {
  const email = (value ?? '').trim().toLowerCase()
  if (!email) return null
  if (email.length > 254) return null
  if (!email.includes('@')) return null
  return email
}

export default async function VerifyRequiredPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolved = searchParams ? await searchParams : undefined
  const nextUrl = normalizeNextPathOrDefault(resolved?.next)
  const actionName = (resolved?.action ?? 'protected_action').trim() || 'protected_action'
  const hintedEmail = normalizeEmailHint(resolved?.email)

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (!hintedEmail) {
      redirect('/login')
    }

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-2xl space-y-4">
          <Link
            href="/login"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Verify your email to continue</h1>
            <p className="mt-2 text-sm text-slate-600">
              We sent a confirmation email to <strong>{hintedEmail}</strong>.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              If you entered the wrong address, create a new account with the correct email.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              If you used the correct email, open the verification link from your inbox and continue.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/signup/student"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Use different email
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Go to login
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (user.email_confirmed_at) {
    const { error: verifySyncError } = await supabase
      .from('users')
      .update({ verified: true })
      .eq('id', user.id)
      .eq('verified', false)
    if (verifySyncError) {
      console.warn('[auth] verified_sync_failed', {
        reasonCode: 'verified_sync_failed_verify_required',
        userId: user.id,
      })
    }
    redirect(nextUrl)
  }

  async function resendAction(
    _prevState: { ok: boolean; message: string },
    formData: FormData
  ): Promise<{ ok: boolean; message: string }> {
    'use server'

    const email = String(formData.get('email') ?? '')
    const next = normalizeNextPathOrDefault(String(formData.get('next') ?? '/'))
    const result = await resendVerificationEmailAction(email, next)
    if (!result.ok) {
      const normalized = normalizeAuthError({ message: result.error }, 'verify')
      return { ok: false, message: normalized.publicMessage }
    }
    return { ok: true, message: result.message }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-2xl space-y-4">
        <Link
          href={nextUrl}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <VerifyRequiredPanel
          email={user.email ?? ''}
          nextUrl={nextUrl}
          actionName={actionName}
          resendAction={resendAction}
        />
      </section>
    </main>
  )
}
