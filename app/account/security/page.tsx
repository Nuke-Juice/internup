import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import SecuritySettings from '@/components/account/SecuritySettings'
import { supabaseServer } from '@/lib/supabase/server'

export default async function AccountSecurityPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=%2Faccount%2Fsecurity')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-3xl space-y-4">
        <div>
          <Link
            href="/account"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Account security</h1>
          <p className="mt-1 text-sm text-slate-600">Manage password and account deletion.</p>
        </div>

        <SecuritySettings email={user.email ?? ''} />
      </section>
    </main>
  )
}
