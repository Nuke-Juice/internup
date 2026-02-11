import Link from 'next/link'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'

export default async function AdminDashboardPage() {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin' })

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Navigate moderation, employer operations, and internship management.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="mb-2 text-sm font-medium text-slate-800">Quick actions</div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/internships"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage internships
            </Link>
            <Link
              href="/admin/internships/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
            >
              New internship
            </Link>
            <Link
              href="/admin/employers"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage employers
            </Link>
            <Link
              href="/admin/students"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage student profiles
            </Link>
            <Link
              href="/admin/matching/preview"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Student view preview
            </Link>
            <Link
              href="/admin/matching/report"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Matching report
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
