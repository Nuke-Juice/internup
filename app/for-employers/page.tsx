import Link from 'next/link'
import { redirect } from 'next/navigation'
import ConfirmSignOutButton from '@/components/auth/ConfirmSignOutButton'
import { isAdminRole, isUserRole } from '@/lib/auth/roles'
import { supabaseServer } from '@/lib/supabase/server'

export default async function ForEmployersPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    role = isUserRole(userRow?.role) ? userRow.role : null
  }

  if (role === 'employer') {
    redirect('/dashboard/employer')
  }
  if (role && isAdminRole(role)) {
    redirect('/admin')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Employer account tools</h1>
          <p className="mt-2 text-sm text-slate-600">
            Employer accounts let you publish internships, manage applicants, and access hiring workflows.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hiring pipeline</div>
              <div className="mt-1 text-sm text-slate-700">Post internships, review applicants, and track outcomes.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team visibility</div>
              <div className="mt-1 text-sm text-slate-700">Use dashboards and notifications to keep recruiting organized.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand profile</div>
              <div className="mt-1 text-sm text-slate-700">Show company details and profile branding to candidates.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upgrade options</div>
              <div className="mt-1 text-sm text-slate-700">Unlock additional employer features on paid plans.</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Log out to create an employer account</h2>
          <p className="mt-2 text-sm text-amber-800">
            You are currently signed in with a student account. To continue with employer signup, log out first.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {user ? (
              <ConfirmSignOutButton
                redirectTo="/signup/employer?intent=employer"
                confirmMessage="Sign out of this student account and continue to employer signup?"
                label="Log out and continue"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              />
            ) : (
              <Link
                href="/signup/employer?intent=employer"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create employer account
              </Link>
            )}
            <Link
              href="/"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to internships
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
