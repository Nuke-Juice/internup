import Link from 'next/link'
import { redirect } from 'next/navigation'
import ConfirmSignOutButton from '@/components/auth/ConfirmSignOutButton'
import { isAdminRole, isUserRole } from '@/lib/auth/roles'
import { supabaseServer } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in to view your account profile.</p>
            <div className="mt-5">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Log in
              </Link>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = isUserRole(userRow?.role) ? userRow.role : null

  if (!role || !isAdminRole(role)) {
    redirect('/account')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Admin profile</h1>
              <p className="mt-1 text-sm text-slate-600">Manage your account and admin access.</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Admin
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
              <div className="mt-1 text-sm font-medium text-slate-800">{user.email ?? 'No email on file'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">User ID</div>
              <div className="mt-1 break-all text-sm font-medium text-slate-800">{user.id}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Go to dashboard
            </Link>
            <Link
              href="/admin/internships"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Go to internships
            </Link>
            <Link
              href="/admin/employers"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Go to employers
            </Link>
            <ConfirmSignOutButton
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              confirmMessage="Are you sure you want to sign out of the admin account?"
            />
          </div>
        </section>
      </div>
    </main>
  )
}
