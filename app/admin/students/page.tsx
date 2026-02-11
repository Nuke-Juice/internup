import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { deleteUserAccountById } from '@/lib/auth/accountDeletion'
import { parseStudentPreferenceSignals } from '@/lib/student/preferenceSignals'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{ q?: string; success?: string; error?: string }>

type StudentRow = {
  user_id: string
  school: string | null
  major?: { name?: string | null } | null
  majors: string[] | string | null
  year: string | null
  experience_level: string | null
  interests: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
}

type StudentViewRow = StudentRow & {
  name: string
  email: string
  major_label: string
  availability_label: string
  canonical_skill_labels: string[]
  coursework_category_names: string[]
  missing_match_dimensions: string[]
  coverage_label: string
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

function parseMajors(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
  }
  return []
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
      'user_id, school, major:canonical_majors(name), majors, year, experience_level, interests, availability_start_month, availability_hours_per_week'
    )
    .limit(200)
  const { data } = await query
  const students = (data ?? []) as StudentRow[]

  const [skillRowsResult, courseworkCategoryRowsResult] = await Promise.all([
    students.length > 0
      ? admin
          .from('student_skill_items')
          .select('student_id, skill:skills(label)')
          .in('student_id', students.map((row) => row.user_id))
      : Promise.resolve({
          data: [] as Array<{ student_id: string | null; skill: { label?: string | null } | Array<{ label?: string | null }> | null }>,
        }),
    students.length > 0
      ? admin
          .from('student_coursework_category_links')
          .select('student_id, category:coursework_categories(name)')
          .in('student_id', students.map((row) => row.user_id))
      : Promise.resolve({
          data: [] as Array<{ student_id: string | null; category: { name?: string | null } | Array<{ name?: string | null }> | null }>,
        }),
  ])

  const canonicalSkillsByStudentId = new Map<string, string[]>()
  for (const row of (skillRowsResult.data ?? []) as Array<{ student_id: string | null; skill: { label?: string | null } | Array<{ label?: string | null }> | null }>) {
    if (!row.student_id) continue
    const labels = Array.isArray(row.skill)
      ? row.skill
          .map((entry) => (typeof entry?.label === 'string' ? entry.label.trim() : ''))
          .filter(Boolean)
      : typeof row.skill?.label === 'string'
        ? [row.skill.label.trim()]
        : []
    if (labels.length === 0) continue
    const next = canonicalSkillsByStudentId.get(row.student_id) ?? []
    next.push(...labels)
    canonicalSkillsByStudentId.set(row.student_id, next)
  }

  const courseworkCategoriesByStudentId = new Map<string, string[]>()
  for (const row of (courseworkCategoryRowsResult.data ?? []) as Array<{ student_id: string | null; category: { name?: string | null } | Array<{ name?: string | null }> | null }>) {
    if (!row.student_id) continue
    const labels = Array.isArray(row.category)
      ? row.category
          .map((entry) => (typeof entry?.name === 'string' ? entry.name.trim() : ''))
          .filter(Boolean)
      : typeof row.category?.name === 'string'
        ? [row.category.name.trim()]
        : []
    if (labels.length === 0) continue
    const next = courseworkCategoriesByStudentId.get(row.student_id) ?? []
    next.push(...labels)
    courseworkCategoriesByStudentId.set(row.student_id, next)
  }

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
    const canonicalSkillLabels = Array.from(new Set(canonicalSkillsByStudentId.get(row.user_id) ?? []))
    const courseworkCategoryNames = Array.from(new Set(courseworkCategoriesByStudentId.get(row.user_id) ?? []))
    const preferences = parseStudentPreferenceSignals(row.interests)
    const majorTokens = parseMajors(row.majors)
    const hasHours = typeof row.availability_hours_per_week === 'number' && row.availability_hours_per_week > 0
    const hasTerm = preferences.preferredTerms.length > 0 || Boolean(row.availability_start_month?.trim())
    const hasLocationOrMode = preferences.preferredLocations.length > 0 || preferences.preferredWorkModes.length > 0
    const checks = [
      ['majors', majorTokens.length > 0 || major !== 'Major not set'],
      ['skills', canonicalSkillLabels.length > 0],
      ['coursework categories', courseworkCategoryNames.length > 0],
      ['term', hasTerm],
      ['hours', hasHours],
      ['location/work mode', hasLocationOrMode],
      ['grad year', Boolean(row.year?.trim())],
      ['experience', Boolean(row.experience_level?.trim())],
    ] as const
    const missingDimensions = checks.filter(([, ok]) => !ok).map(([label]) => label)
    const coverageLabel = `${checks.filter(([, ok]) => ok).length}/${checks.length}`
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
      canonical_skill_labels: canonicalSkillLabels,
      coursework_category_names: courseworkCategoryNames,
      missing_match_dimensions: missingDimensions,
      coverage_label: coverageLabel,
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
      row.canonical_skill_labels.join(' '),
      row.coursework_category_names.join(' '),
      row.missing_match_dimensions.join(' '),
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
                  <th className="px-3 py-2">Canonical selections</th>
                  <th className="px-3 py-2">Match coverage</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
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
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <div>Skills: {row.canonical_skill_labels.slice(0, 3).join(', ') || 'none'}</div>
                        <div>Coursework categories: {row.coursework_category_names.slice(0, 2).join(', ') || 'none'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <div
                          className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${
                            row.missing_match_dimensions.length === 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-amber-300 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.coverage_label}
                        </div>
                        <div className="mt-1 text-slate-600">
                          Missing: {row.missing_match_dimensions.join(', ') || 'none'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/matching/preview?student=${encodeURIComponent(row.user_id)}`}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Preview matches
                          </Link>
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
                        </div>
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
