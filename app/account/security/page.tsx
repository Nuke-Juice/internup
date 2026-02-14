import { redirect } from 'next/navigation'
import SecuritySettings from '@/components/account/SecuritySettings'
import HistoryBackButton from '@/components/navigation/HistoryBackButton'
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
          <HistoryBackButton fallbackHref="/account" />
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Account security</h1>
          <p className="mt-1 text-sm text-slate-600">Manage password and account deletion.</p>
        </div>

        <SecuritySettings email={user.email ?? ''} />
      </section>
    </main>
  )
}
