import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { canAccessAdminMatching } from '@/lib/auth/adminMatchingAccess'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import {
  evaluateSinglePreviewMatch,
  loadAdminInternshipPreviewItems,
  loadAdminStudentPreviewOptions,
  rankInternshipsForStudentPreview,
  type MatchingPreviewFilters,
} from '@/lib/admin/matchingPreview'

type SearchParams = Promise<{
  student?: string
  student_q?: string
  category?: string
  remote?: string
  term?: string
  internship?: string
}>

function normalizeRemoteFilter(value: string | undefined): MatchingPreviewFilters['remote'] {
  return value === 'remote_only' ? 'remote_only' : 'all'
}

export default async function AdminMatchingPreviewPage({ searchParams }: { searchParams?: SearchParams }) {
  const { role } = await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/matching/preview' })
  if (!canAccessAdminMatching(role)) {
    redirect('/unauthorized')
  }

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Admin matching preview</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const resolved = searchParams ? await searchParams : undefined
  const studentId = (resolved?.student ?? '').trim()
  const studentQuery = (resolved?.student_q ?? '').trim()
  const selectedInternshipId = (resolved?.internship ?? '').trim()
  const filters: MatchingPreviewFilters = {
    category: (resolved?.category ?? '').trim(),
    remote: normalizeRemoteFilter(resolved?.remote),
    term: (resolved?.term ?? '').trim(),
  }

  const admin = supabaseAdmin()
  const students = await loadAdminStudentPreviewOptions(admin, studentQuery)
  let selectedStudent = students.find((row) => row.userId === studentId) ?? null

  if (!selectedStudent && studentId) {
    const fallbackStudents = await loadAdminStudentPreviewOptions(admin, '')
    selectedStudent = fallbackStudents.find((row) => row.userId === studentId) ?? null
  }

  const internships = await loadAdminInternshipPreviewItems(admin, filters)
  const ranked = selectedStudent ? rankInternshipsForStudentPreview(internships, selectedStudent.profile) : []

  const selectedInternship =
    ranked.find((item) => item.internship.id === selectedInternshipId)?.internship ?? ranked[0]?.internship ?? null
  const selectedMatch = selectedStudent && selectedInternship
    ? evaluateSinglePreviewMatch(selectedInternship, selectedStudent.profile)
    : null

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Student View / Match Preview</h1>
          <p className="mt-1 text-sm text-slate-600">Admin-only ranking simulation using student profile signals and production matching logic.</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <form method="get" className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-700">Search student (email/name)</label>
              <input
                name="student_q"
                defaultValue={studentQuery}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                placeholder="jane@school.edu"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-700">Select student</label>
              <select name="student" defaultValue={studentId} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
                <option value="">Choose a student</option>
                {students.map((row) => (
                  <option key={row.userId} value={row.userId}>
                    {row.name} · {row.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Category</label>
              <input name="category" defaultValue={filters.category} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="finance" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Term</label>
              <input name="term" defaultValue={filters.term} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="summer" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">Remote filter</label>
              <select name="remote" defaultValue={filters.remote} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
                <option value="all">All</option>
                <option value="remote_only">Remote-only</option>
              </select>
            </div>

            <div className="md:col-span-6 flex items-center gap-2">
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Preview</button>
              {selectedInternshipId ? <input type="hidden" name="internship" value={selectedInternshipId} /> : null}
            </div>
          </form>
        </section>

        {selectedStudent ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-900">Selected student</div>
            <div className="mt-1">{selectedStudent.name} · {selectedStudent.email}</div>
            <div className="mt-1">Major: {selectedStudent.majorLabel} · Year: {selectedStudent.year ?? 'n/a'} · Experience: {selectedStudent.experienceLevel ?? 'n/a'}</div>
            <div className="mt-1">Canonical skills: {selectedStudent.canonicalSkillLabels.slice(0, 8).join(', ') || 'none'}</div>
            <div className="mt-1">Coursework categories: {selectedStudent.courseworkCategoryNames.slice(0, 8).join(', ') || 'none'}</div>
            <div className="mt-1">Missing dimensions: {selectedStudent.coverage.missingDimensions.join(', ') || 'none'}</div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Select a student to render ranked internship results and match breakdowns.
          </section>
        )}

        {selectedStudent ? (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Ranked internship list ({ranked.length})</h2>
              {ranked.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No eligible internships for this student under current filters.</div>
              ) : (
                ranked.map((item) => {
                  const href = `/admin/matching/preview?student=${encodeURIComponent(selectedStudent.userId)}&student_q=${encodeURIComponent(studentQuery)}&category=${encodeURIComponent(filters.category ?? '')}&term=${encodeURIComponent(filters.term ?? '')}&remote=${encodeURIComponent(filters.remote ?? 'all')}&internship=${encodeURIComponent(item.internship.id)}`
                  const score = Math.round(item.match.normalizedScore * 100)
                  return (
                    <article key={item.internship.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-900">{item.internship.title ?? 'Untitled internship'}</div>
                          <div className="text-sm text-slate-600">{item.internship.companyName ?? 'Unknown employer'}</div>
                        </div>
                        <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{score}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">
                        {(item.internship.category ?? item.internship.roleCategory ?? 'Uncategorized')} · {item.internship.workMode ?? 'mode n/a'} · {item.internship.term ?? 'term n/a'}
                      </div>
                      <div className="mt-2 text-xs text-emerald-800">{item.match.reasons.slice(0, 2).join(' • ') || 'No positive reasons recorded'}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <Link href={href} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Open breakdown</Link>
                        <Link href={`/jobs/${item.internship.id}`} className="text-xs font-medium text-blue-700 hover:underline">Open public detail</Link>
                      </div>
                    </article>
                  )
                })
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Internship detail breakdown</h2>
              {!selectedMatch || !selectedInternship ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Select an internship from the ranked list.</div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-base font-semibold text-slate-900">{selectedInternship.title ?? 'Untitled internship'}</div>
                  <div className="text-sm text-slate-600">{selectedInternship.companyName ?? 'Unknown employer'}</div>
                  <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    Score: {selectedMatch.score}/{selectedMatch.maxScore} ({Math.round(selectedMatch.normalizedScore * 100)}%)
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left uppercase tracking-wide text-slate-600">
                          <th className="px-1 py-1">Signal</th>
                          <th className="px-1 py-1">Weight</th>
                          <th className="px-1 py-1">Raw</th>
                          <th className="px-1 py-1">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedMatch.breakdown?.perSignalContributions ?? []).map((row) => (
                          <tr key={row.signalKey} className="border-t border-slate-200">
                            <td className="px-1 py-1 font-mono">{row.signalKey}</td>
                            <td className="px-1 py-1">{row.weight}</td>
                            <td className="px-1 py-1">{row.rawMatchValue}</td>
                            <td className="px-1 py-1">{row.pointsAwarded}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(selectedMatch.breakdown?.reasons ?? []).map((reason) => (
                      <div key={reason.reasonKey + reason.humanText} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs text-emerald-900">
                        <div className="font-mono text-[11px] text-emerald-700">{reason.reasonKey}</div>
                        <div>{reason.humanText}</div>
                      </div>
                    ))}
                  </div>

                  {selectedMatch.gaps.length > 0 ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Gaps: {selectedMatch.gaps.join(' • ')}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
