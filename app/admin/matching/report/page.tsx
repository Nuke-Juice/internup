import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { canAccessAdminMatching } from '@/lib/auth/adminMatchingAccess'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { buildMatchingReportModel } from '@/lib/admin/matchingReport'
import { redirect } from 'next/navigation'

async function loadCatalogStats() {
  if (!hasSupabaseAdminCredentials()) {
    return {
      skillsCount: 0,
      courseworkItemsCount: 0,
      courseworkCategoriesCount: 0,
      majorsCount: 0,
      sampleSkills: [] as string[],
      sampleCourseworkCategories: [] as string[],
      sampleMajors: [] as string[],
    }
  }

  const admin = supabaseAdmin()
  const [skillsResult, courseworkItemsResult, courseworkCategoriesResult, majorsResult] = await Promise.all([
    admin.from('skills').select('label', { count: 'exact' }).order('label', { ascending: true }).limit(8),
    admin.from('coursework_items').select('name', { count: 'exact' }).order('name', { ascending: true }).limit(8),
    admin.from('coursework_categories').select('name', { count: 'exact' }).order('name', { ascending: true }).limit(8),
    admin.from('canonical_majors').select('name', { count: 'exact' }).order('name', { ascending: true }).limit(8),
  ])

  const skillRows = (skillsResult.data ?? []) as Array<{ label: string | null }>
  const courseworkCategoryRows = (courseworkCategoriesResult.data ?? []) as Array<{ name: string | null }>
  const majorRows = (majorsResult.data ?? []) as Array<{ name: string | null }>

  return {
    skillsCount: skillsResult.count ?? 0,
    courseworkItemsCount: courseworkItemsResult.count ?? 0,
    courseworkCategoriesCount: courseworkCategoriesResult.count ?? 0,
    majorsCount: majorsResult.count ?? 0,
    sampleSkills: skillRows.map((row) => row.label).filter((value): value is string => typeof value === 'string'),
    sampleCourseworkCategories: courseworkCategoryRows
      .map((row) => row.name)
      .filter((value): value is string => typeof value === 'string'),
    sampleMajors: majorRows.map((row) => row.name).filter((value): value is string => typeof value === 'string'),
  }
}

export default async function AdminMatchingReportPage() {
  const { role } = await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/matching/report' })
  if (!canAccessAdminMatching(role)) {
    redirect('/unauthorized')
  }

  const model = buildMatchingReportModel()
  const catalogStats = await loadCatalogStats()

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Matching Algorithm Report</h1>
          <p className="mt-1 text-sm text-slate-600">
            Version {model.summary.matchingVersion} · generated {new Date(model.generatedAtIso).toLocaleString()}
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Scoring Model</h2>
          <p className="mt-1 text-sm text-slate-600">
            maxScore={model.summary.maxScore} ({model.summary.normalizationFormula})
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-1">Signal</th>
                  <th className="px-2 py-1">Weight</th>
                  <th className="px-2 py-1">Description</th>
                </tr>
              </thead>
              <tbody>
                {model.summary.signalKeys.map((signalKey) => (
                  <tr key={signalKey} className="border-t border-slate-200">
                    <td className="px-2 py-1 font-mono text-xs text-slate-800">{signalKey}</td>
                    <td className="px-2 py-1 text-slate-800">{model.summary.weights[signalKey]}</td>
                    <td className="px-2 py-1 text-slate-700">{model.summary.signalDefinitions[signalKey].description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Canonical Lists and Enums</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Catalog counts</div>
              <div className="mt-1">Skills: {catalogStats.skillsCount}</div>
              <div>Coursework items: {catalogStats.courseworkItemsCount}</div>
              <div>Coursework categories: {catalogStats.courseworkCategoriesCount}</div>
              <div>Majors: {catalogStats.majorsCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Built-in enums</div>
              <div className="mt-1">Internship experience: {model.canonicalEnums.experienceLevelsInternship.join(', ')}</div>
              <div>Student experience: {model.canonicalEnums.experienceLevelsStudent.join(', ')}</div>
              <div>Work modes: {model.canonicalEnums.workModes.join(', ')}</div>
              <div>Term seasons: {model.canonicalEnums.termSeasons.join(', ')}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Sample skills</div>
              <div className="mt-1">{catalogStats.sampleSkills.join(', ') || 'n/a'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Sample coursework categories</div>
              <div className="mt-1">{catalogStats.sampleCourseworkCategories.join(', ') || 'n/a'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Sample majors</div>
              <div className="mt-1">{catalogStats.sampleMajors.join(', ') || 'n/a'}</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Data Inputs and DB Sources</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-1">Field</th>
                  <th className="px-2 py-1">Used for</th>
                  <th className="px-2 py-1">DB source</th>
                  <th className="px-2 py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {model.dataSources.map((row) => (
                  <tr key={row.field} className="border-t border-slate-200">
                    <td className="px-2 py-1 font-medium text-slate-900">{row.field}</td>
                    <td className="px-2 py-1 text-slate-700">{row.usedFor}</td>
                    <td className="px-2 py-1 font-mono text-xs text-slate-700">
                      {row.sourceTable}.{row.sourceColumn}
                    </td>
                    <td className="px-2 py-1 text-slate-700">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Example Breakdown</h2>
          <p className="mt-1 text-sm text-slate-600">
            Student: {model.sample.studentLabel} · Internship: {model.sample.internshipLabel}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Score {model.sample.match.score}/{model.sample.match.maxScore} ({Math.round(model.sample.match.normalizedScore * 100)}%)
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-1">Signal</th>
                  <th className="px-2 py-1">Weight</th>
                  <th className="px-2 py-1">Raw</th>
                  <th className="px-2 py-1">Points</th>
                </tr>
              </thead>
              <tbody>
                {(model.sample.match.breakdown?.perSignalContributions ?? []).map((row) => (
                  <tr key={row.signalKey} className="border-t border-slate-200">
                    <td className="px-2 py-1 font-mono text-xs text-slate-800">{row.signalKey}</td>
                    <td className="px-2 py-1 text-slate-700">{row.weight}</td>
                    <td className="px-2 py-1 text-slate-700">{row.rawMatchValue}</td>
                    <td className="px-2 py-1 text-slate-700">{row.pointsAwarded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-2">
            {(model.sample.match.breakdown?.reasons ?? []).map((reason) => (
              <div key={reason.reasonKey + reason.humanText} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <div className="font-mono text-xs text-emerald-700">{reason.reasonKey}</div>
                <div>{reason.humanText}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Major to Internship Matrix</h2>
          <p className="mt-1 text-sm text-slate-600">
            Suggested mapping used for employer-facing explainability and signal guidance.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-2 py-1">Major</th>
                  <th className="px-2 py-1">Suggested coursework categories</th>
                  <th className="px-2 py-1">Typical internship types</th>
                </tr>
              </thead>
              <tbody>
                {model.majorInternshipMatrix.map((row) => (
                  <tr key={row.major} className="border-t border-slate-200 align-top">
                    <td className="px-2 py-2 font-medium text-slate-900">{row.major}</td>
                    <td className="px-2 py-2 text-slate-700">
                      <div className="flex flex-wrap gap-1.5">
                        {row.suggestedCourseworkCategories.map((item) => (
                          <span key={item} className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs">
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      <div className="flex flex-wrap gap-1.5">
                        {row.internshipTypes.map((item) => (
                          <span key={item} className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900">
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Quality Over Quantity Differentiation</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {model.qualityOverQuantity.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">Employer-facing message</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {model.qualityOverQuantity.messaging.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">Risks and mitigations</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {model.qualityOverQuantity.risksAndMitigations.map((item) => (
              <li key={item.risk}>
                <span className="font-medium">Risk:</span> {item.risk} <span className="font-medium">Mitigation:</span> {item.mitigation}
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}
