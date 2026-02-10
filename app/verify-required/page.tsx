import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import VerifyRequiredPanel from './_components/VerifyRequiredPanel'
import { supabaseServer } from '@/lib/supabase/server'
import { resendVerificationEmailAction } from '@/lib/auth/emailVerificationServer'

type SearchParams = Promise<{
  next?: string
  action?: string
}>

function normalizeNext(value: string | undefined) {
  const next = (value ?? '/').trim()
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  return next
}

export default async function VerifyRequiredPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolved = searchParams ? await searchParams : undefined
  const nextUrl = normalizeNext(resolved?.next)
  const actionName = (resolved?.action ?? 'protected_action').trim() || 'protected_action'

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.email_confirmed_at) {
    redirect(nextUrl)
  }

  async function resendAction(
    _prevState: { ok: boolean; message: string },
    formData: FormData
  ): Promise<{ ok: boolean; message: string }> {
    'use server'

    const email = String(formData.get('email') ?? '')
    const next = normalizeNext(String(formData.get('next') ?? '/'))
    const result = await resendVerificationEmailAction(email, next)
    if (!result.ok) {
      return { ok: false, message: result.error }
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
