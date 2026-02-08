import Link from 'next/link'
import { parseMajors, rankInternships } from '@/lib/matching'
import { fetchInternships, formatMajors, getInternshipType } from '@/lib/jobs/internships'
import { supabaseServer } from '@/lib/supabase/server'
import FiltersPanel from '@/app/jobs/_components/FiltersPanel'
import JobCard from '@/app/jobs/_components/JobCard'
import JobCardSkeleton from '@/app/jobs/_components/JobCardSkeleton'

const categoryTiles = [
  'Finance',
  'Accounting',
  'Data',
  'Marketing',
  'Operations',
  'Product',
  'Design',
  'Sales',
  'HR',
  'Engineering',
]

export type JobsQuery = {
  category?: string
  paid?: string
  type?: string
  remote?: string
  exp?: string
  hours?: string
}

type JobsViewProps = {
  searchParams?: Promise<JobsQuery> | JobsQuery
  showHero?: boolean
  basePath?: string
  anchorId?: string
}

function seasonFromMonth(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.startsWith('jun') || normalized.startsWith('jul') || normalized.startsWith('aug')) return 'summer'
  if (normalized.startsWith('sep') || normalized.startsWith('oct') || normalized.startsWith('nov')) return 'fall'
  if (normalized.startsWith('dec') || normalized.startsWith('jan') || normalized.startsWith('feb')) return 'winter'
  if (normalized.startsWith('mar') || normalized.startsWith('apr') || normalized.startsWith('may')) return 'spring'
  return ''
}

function buildBrowseHref(basePath: string, anchorId?: string) {
  const hash = anchorId ? `#${anchorId}` : ''
  return `${basePath}${hash}`
}

function getStudentProfileCompletion(profile: {
  university_id?: string | number | null
  school?: string | null
  majors?: string[] | string | null
  year?: string | null
  coursework?: string[] | string | null
  experience_level?: string | null
  availability_start_month?: string | null
  availability_hours_per_week?: number | string | null
} | null) {
  if (!profile) return { completed: 0, total: 7, percent: 0, isComplete: false }

  const majors = parseMajors(profile.majors ?? null)
  const coursework =
    Array.isArray(profile.coursework)
      ? profile.coursework.filter((course): course is string => typeof course === 'string' && course.trim().length > 0)
      : typeof profile.coursework === 'string'
        ? profile.coursework
            .split(',')
            .map((course) => course.trim())
            .filter(Boolean)
        : []

  const hasUniversity = Boolean(
    profile.university_id || (typeof profile.school === 'string' && profile.school.trim().length > 0)
  )
  const hasYear = typeof profile.year === 'string' && profile.year.trim().length > 0 && profile.year !== 'Not set'
  const hasExperience =
    profile.experience_level === 'none' ||
    profile.experience_level === 'projects' ||
    profile.experience_level === 'internship'
  const hasStartMonth =
    typeof profile.availability_start_month === 'string' && profile.availability_start_month.trim().length > 0
  const hasHours =
    typeof profile.availability_hours_per_week === 'number'
      ? profile.availability_hours_per_week > 0
      : typeof profile.availability_hours_per_week === 'string' && profile.availability_hours_per_week.trim().length > 0

  const checks = [hasUniversity, majors.length > 0, hasYear, hasExperience, hasStartMonth, hasHours, coursework.length > 0]
  const completed = checks.filter(Boolean).length
  const total = checks.length
  const percent = Math.round((completed / total) * 100)

  return { completed, total, percent, isComplete: completed === total }
}

export function JobsViewSkeleton({ showHero = false }: { showHero?: boolean }) {
  return (
    <>
      {showHero ? (
        <section className="border-b border-blue-100 bg-gradient-to-b from-blue-50 to-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto h-7 w-72 max-w-full animate-pulse rounded-md bg-blue-100" />
              <div className="mx-auto mt-3 h-4 w-96 max-w-full animate-pulse rounded-md bg-slate-200" />
              <div className="mx-auto mt-6 h-10 w-44 animate-pulse rounded-md bg-blue-200" />
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 space-y-2">
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
            </div>
          </aside>

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default async function JobsView({
  searchParams,
  showHero = false,
  basePath = '/jobs',
  anchorId = 'internships',
}: JobsViewProps) {
  const resolvedSearchParams = ((searchParams ? await Promise.resolve(searchParams) : {}) ?? {}) as JobsQuery
  const activeCategory = resolvedSearchParams.category ?? ''
  const paidOnly = resolvedSearchParams.paid === '1'
  const selectedType =
    resolvedSearchParams.type === 'internship' || resolvedSearchParams.type === 'part-time'
      ? resolvedSearchParams.type
      : ''
  const remoteOnly = resolvedSearchParams.remote === '1'
  const selectedExperience = resolvedSearchParams.exp ?? ''
  const maxHours = resolvedSearchParams.hours ?? ''

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const internships = await fetchInternships()
  const newestInternships = internships.slice(0, 6)

  let sortedInternships = internships
  let isBestMatch = false
  let profileMajors: string[] = []
  let profileAvailability: number | null = null
  let profileCoursework: string[] = []
  let profileSkillIds: string[] = []
  const matchReasonsById = new Map<string, string[]>()
  let role: 'student' | 'employer' | undefined
  let showCompleteProfileBanner = false
  let profileCompletionPercent = 0

  if (user) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (userRow?.role === 'student' || userRow?.role === 'employer') {
      role = userRow.role
    }

    const { data: profile } = await supabase
      .from('student_profiles')
      .select(
        'university_id, school, majors, year, coursework, experience_level, availability_start_month, availability_hours_per_week'
      )
      .eq('user_id', user.id)
      .maybeSingle()
    const { data: studentSkillRows } = await supabase
      .from('student_skill_items')
      .select('skill_id')
      .eq('student_id', user.id)

    profileMajors = parseMajors(profile?.majors ?? null)
    profileAvailability = profile?.availability_hours_per_week ?? null
    profileCoursework = Array.isArray(profile?.coursework)
      ? profile.coursework.filter(
          (course): course is string => typeof course === 'string' && course.length > 0
        )
      : []
    profileSkillIds = (studentSkillRows ?? [])
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string')

    if (role === 'student') {
      const completion = getStudentProfileCompletion(profile ?? null)
      profileCompletionPercent = completion.percent
      showCompleteProfileBanner = !completion.isComplete
    }

    if (
      role === 'student' &&
      (profileMajors.length > 0 || typeof profileAvailability === 'number' || profileCoursework.length > 0 || profileSkillIds.length > 0)
    ) {
      isBestMatch = true
      const ranked = rankInternships(
        internships.map((listing) => ({
          id: listing.id,
          title: listing.title,
          description: listing.description,
          majors: listing.majors,
          hours_per_week: listing.hours_per_week,
          location: listing.location,
          required_skill_ids: listing.required_skill_ids,
          preferred_skill_ids: listing.preferred_skill_ids,
        })),
        {
          majors: profileMajors,
          skill_ids: profileSkillIds,
          coursework: profileCoursework,
          availability_hours_per_week: profileAvailability,
          preferred_terms: profile?.availability_start_month ? [seasonFromMonth(profile.availability_start_month)] : [],
        }
      )

      for (const item of ranked) {
        matchReasonsById.set(item.internship.id, item.match.reasons.slice(0, 2))
      }

      const scoreById = new Map(ranked.map((item) => [item.internship.id, item.match.score]))
      sortedInternships = internships
        .filter((listing) => scoreById.has(listing.id))
        .map((listing) => ({ ...listing, matchScore: scoreById.get(listing.id) ?? 0 }))
        .sort((a, b) => {
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })
    }
  }

  const filteredInternships = sortedInternships.filter((listing) => {
    const listingMajors = parseMajors(listing.majors)
    const normalizedTitle = listing.title?.toLowerCase() ?? ''
    const isRemote = (listing.location ?? '').toLowerCase().includes('remote')
    const listingType = getInternshipType(listing.hours_per_week)
    const listingExperience = (listing.experience_level ?? '').toLowerCase()
    const isPaid = Boolean(listing.pay && listing.pay.trim() && listing.pay.toLowerCase() !== 'tbd')
    const parsedMaxHours = maxHours ? Number(maxHours) : null

    if (activeCategory) {
      const normalizedCategory = activeCategory.toLowerCase()
      const hasCategoryMatch =
        listingMajors.some((major) => major.includes(normalizedCategory)) ||
        normalizedTitle.includes(normalizedCategory)
      if (!hasCategoryMatch) return false
    }

    if (paidOnly && !isPaid) return false
    if (selectedType && listingType !== selectedType) return false
    if (remoteOnly && !isRemote) return false
    if (selectedExperience && listingExperience !== selectedExperience) return false
    if (typeof parsedMaxHours === 'number' && typeof listing.hours_per_week === 'number') {
      if (listing.hours_per_week > parsedMaxHours) return false
    }

    return true
  })
  const listingsTitle = filteredInternships.length === 0 ? 'Browse internships' : 'Internships hiring now'

  return (
    <>
      {showHero ? (
        <section className="border-b border-blue-100 bg-gradient-to-b from-blue-50 to-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Find internships that fit your major and schedule.
              </h1>
              <p className="mt-3 text-sm text-slate-600 sm:text-base">
                Filter fast and start with roles you can actually apply to this term.
              </p>
              <div className="mt-6">
                <Link
                  href={`#${anchorId}`}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Browse internships
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section id={anchorId} className="mx-auto max-w-6xl scroll-mt-24 px-6 py-8">
        {showCompleteProfileBanner && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Profile {profileCompletionPercent}% complete. Finish your profile to improve internship matches.
              </p>
              <Link
                href="/account?complete=1"
                className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                Complete profile
              </Link>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{listingsTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Quick filters up front, deeper refinements on demand.
            </p>
          </div>
          <div className="text-right text-xs font-medium text-slate-500">
            <div>Sort: {isBestMatch ? 'Best match' : 'Newest'}</div>
            <div className="mt-1">{filteredInternships.length} results</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <FiltersPanel
            categories={categoryTiles}
            state={{
              category: activeCategory,
              paidOnly,
              jobType: selectedType,
              remoteOnly,
              experience: selectedExperience,
              maxHours,
            }}
            basePath={basePath}
            anchorId={anchorId}
          />

          <div className="space-y-4">
            {filteredInternships.length === 0 ? (
              <div className="space-y-6">
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-lg text-blue-700">
                      ✦
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">No matches for these filters</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Try clearing filters or browsing all internships to see the newest opportunities.
                    </p>
                    <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                      <Link
                        href={buildBrowseHref(basePath, anchorId)}
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Clear filters
                      </Link>
                      <Link
                        href={buildBrowseHref(basePath, anchorId)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Browse all internships
                      </Link>
                    </div>
                  </div>
                </div>

                {newestInternships.length > 0 ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">Newest internships</h3>
                      <Link href={buildBrowseHref(basePath, anchorId)} className="text-sm font-medium text-blue-700 hover:underline">
                        Browse all internships
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {newestInternships.map((listing) => (
                        <JobCard
                          key={listing.id}
                          listing={{
                            ...listing,
                            majorsText: formatMajors(listing.majors),
                            jobType: getInternshipType(listing.hours_per_week),
                          }}
                          isAuthenticated={Boolean(user)}
                          userRole={role ?? null}
                          matchSignals={role === 'student' ? matchReasonsById.get(listing.id) ?? [] : []}
                        />
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">No internships yet</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {user
                        ? 'Check back soon for new opportunities.'
                        : 'Check back soon or create an account to get updates.'}
                    </p>
                    {!user && (
                      <div className="mt-4">
                        <Link
                          href="/signup/student"
                          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Create account
                        </Link>
                      </div>
                    )}
                  </section>
                )}
              </div>
            ) : (
              filteredInternships.map((listing) => {
                const matchSignals = user
                  ? role === 'student'
                    ? matchReasonsById.get(listing.id) ?? []
                    : []
                  : []

                return (
                  <JobCard
                    key={listing.id}
                    listing={{
                      ...listing,
                      majorsText: formatMajors(listing.majors),
                      jobType: getInternshipType(listing.hours_per_week),
                    }}
                    isAuthenticated={Boolean(user)}
                    userRole={role ?? null}
                    matchSignals={matchSignals}
                  />
                )
              })
            )}
          </div>
        </div>
      </section>
    </>
  )
}
