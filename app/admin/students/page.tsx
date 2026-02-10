import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { deleteUserAccountById } from '@/lib/auth/accountDeletion'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{ q?: string; success?: string; error?: string }>

type StudentRow = {
  user_id: string
  school: string | null
  major?: { name?: string | null } | null
  majors: string[] | string | null
  year: string | null
  experience_level: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
}

type StudentViewRow = StudentRow & {
  name: string
  email: string
  major_label: string
  availability_label: string
}

function canonicalMajorName(value: unknown) {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as { name?: unknown } | undefined
    return typeof first?.name === 'string' ? first.name : null
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { name?: unknown }
    return typeof maybe.name === 'string' ? maybe.name : null
  }
  return null
}

function formatMajor(value: string[] | string | null | undefined, canonicalName?: string | null) {
  if (typeof canonicalName === 'string' && canonicalName.trim()) return canonicalName
  if (Array.isArray(value)) return value[0] ?? 'Major not set'
  if (typeof value === 'string' && value.trim()) return value
  return 'Major not set'
}

function nameFromAuthMetadata(input: { firstName?: string; lastName?: string; email?: string; fallbackId: string }) {
  const first = input.firstName?.trim() ?? ''
  const last = input.lastName?.trim() ?? ''
  const joined = `${first} ${last}`.trim()
  if (joined) return joined
  const emailName = input.email?.split('@')[0]?.trim()
  if (emailName) return emailName
  return `Student ${input.fallbackId.slice(0, 8)}`
}

function formatAvailability(startMonth: string | null, hours: number | null) {
  const month = startMonth?.trim() || 'Month n/a'
  const hoursLabel = typeof hours === 'number' && hours > 0 ? `${hours}h/wk` : 'hours n/a'
  return `${month} · ${hoursLabel}`
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
  const query = admin
    .from('student_profiles')
    .select(
      'user_id, school, major:canonical_majors(name), majors, year, experience_level, availability_start_month, availability_hours_per_week'
    )
    .limit(200)
  const { data } = await query
  const students = (data ?? []) as StudentRow[]

  const authUsersEntries = await Promise.all(
    students.map(async (student) => {
      const { data: authData } = await admin.auth.admin.getUserById(student.user_id)
      return [student.user_id, authData.user] as const
    })
  )
  const authUserByStudentId = new Map(authUsersEntries)

  const rows = students.map((row) => {
    const authUser = authUserByStudentId.get(row.user_id)
    const metadata = (authUser?.user_metadata ?? {}) as { first_name?: string; last_name?: string }
    const major = formatMajor(row.majors, canonicalMajorName(row.major))
    const viewRow: StudentViewRow = {
      ...row,
      name: nameFromAuthMetadata({
        firstName: metadata.first_name,
        lastName: metadata.last_name,
        email: authUser?.email,
        fallbackId: row.user_id,
      }),
      email: authUser?.email ?? 'Email not set',
      major_label: major,
      availability_label: formatAvailability(row.availability_start_month, row.availability_hours_per_week),
    }
    return viewRow
  })

  const normalizedQuery = q.toLowerCase()
  const filteredRows = rows.filter((row) => {
    if (!normalizedQuery) return true
    const haystack = [
      row.name,
      row.email,
      row.major_label,
      row.school ?? '',
      row.year ?? '',
      row.experience_level ?? '',
      row.availability_label,
      row.user_id,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery)
  })

  async function deleteStudentAccountAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/students' })
    const adminWrite = supabaseAdmin()
    const studentId = String(formData.get('student_id') ?? '').trim()
    const qValue = String(formData.get('q') ?? '').trim()
    const queryPrefix = qValue ? `?q=${encodeURIComponent(qValue)}&` : '?'

    if (!studentId) {
      redirect(`/admin/students${queryPrefix}error=Missing+student+id`)
    }

    const result = await deleteUserAccountById(adminWrite, studentId)
    if (!result.ok) {
      redirect(`/admin/students${queryPrefix}error=${encodeURIComponent(result.error)}`)
    }

    redirect(`/admin/students${queryPrefix}success=Student+account+deleted`)
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin/internships"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Manage student profiles</h1>
            <p className="mt-1 text-sm text-slate-600">Review student profile metadata for admin support and moderation.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {resolvedSearchParams?.error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(resolvedSearchParams.error)}
            </div>
          ) : null}
          {resolvedSearchParams?.success ? (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {decodeURIComponent(resolvedSearchParams.success)}
            </div>
          ) : null}

          <form method="get" className="flex w-full max-w-lg items-end gap-2">
            <div className="w-full">
              <label className="text-xs font-medium text-slate-700">Search</label>
              <input
                name="q"
                defaultValue={q}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                placeholder="Search name, email, major, school, year, or experience"
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
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Major</th>
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Experience level</th>
                  <th className="px-3 py-2">Availability</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                      No student profiles found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.user_id}>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.user_id}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.major_label}</td>
                      <td className="px-3 py-2 text-slate-700">{row.school ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.year ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.experience_level ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.availability_label}</td>
                      <td className="px-3 py-2">
                        <form action={deleteStudentAccountAction}>
                          <input type="hidden" name="student_id" value={row.user_id} />
                          <input type="hidden" name="q" value={q} />
                          <button
                            type="submit"
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete account
                          </button>
                        </form>
                      </td>
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
