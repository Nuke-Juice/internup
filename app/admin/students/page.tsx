import Link from 'next/link'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{ q?: string }>

type StudentRow = {
  user_id: string
  school: string | null
  year: string | null
  experience_level: string | null
}

export default async function AdminStudentsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/students' })
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Admin students</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const q = (resolvedSearchParams?.q ?? '').trim()
  const admin = supabaseAdmin()
  let query = admin.from('student_profiles').select('user_id, school, year, experience_level').limit(200)
  if (q) {
    query = query.or(`school.ilike.%${q}%,year.ilike.%${q}%,experience_level.ilike.%${q}%`)
  }
  const { data } = await query
  const students = (data ?? []) as StudentRow[]

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Manage student profiles</h1>
            <p className="mt-1 text-sm text-slate-600">Review student profile metadata for admin support and moderation.</p>
          </div>
          <Link
            href="/admin/internships"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to internships
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form method="get" className="flex w-full max-w-lg items-end gap-2">
            <div className="w-full">
              <label className="text-xs font-medium text-slate-700">Search</label>
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                placeholder="Search school, year, or experience level"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Search
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Experience level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      No student profiles found.
                    </td>
                  </tr>
                ) : (
                  students.map((row) => (
                    <tr key={row.user_id}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.user_id}</td>
                      <td className="px-3 py-2 text-slate-700">{row.school ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.year ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.experience_level ?? 'n/a'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
