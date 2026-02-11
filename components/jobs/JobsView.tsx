import Link from 'next/link'
import { parseMajors, rankInternships } from '@/lib/matching'
import { getCommuteMinutesForListings, toGeoPoint } from '@/lib/commute'
import { fetchInternships, formatMajors } from '@/lib/jobs/internships'
import { parseStudentPreferenceSignals } from '@/lib/student/preferenceSignals'
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
  q?: string
  category?: string
  paymin?: string
  remote?: string
  exp?: string
  hmin?: string
  hmax?: string
  hmax_slider?: string
  loc?: string
  radius?: string
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

function parseCityState(value: string | null | undefined) {
  if (!value) return { city: null as string | null, state: null as string | null }
  const cleaned = value.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!cleaned) return { city: null as string | null, state: null as string | null }
  const [cityRaw, stateRaw] = cleaned.split(',').map((part) => part.trim())
  const state = stateRaw ? stateRaw.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() : null
  return {
    city: cityRaw || null,
    state: state && state.length === 2 ? state : null,
  }
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

function extractNumericPayRange(pay: string | null | undefined) {
  if (!pay) return null
  const matches = pay.match(/(\d+(?:\.\d+)?)/g)
  if (!matches || matches.length === 0) return null
  const values = matches.map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (values.length === 0) return null
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function getStudentProfileCompletion(profile: {
  university_id?: string | number | null
  school?: string | null
  major_id?: string | null
  major?: unknown
  majors?: string[] | string | null
  year?: string | null
  coursework?: string[] | string | null
  experience_level?: string | null
  availability_start_month?: string | null
  availability_hours_per_week?: number | string | null
} | null, hasIdentityName = false) {
  if (!profile) return { completed: 0, total: 8, percent: 0, isComplete: false }

  const majorName = canonicalMajorName(profile.major)
  const majors = majorName ? parseMajors([majorName]) : parseMajors(profile.majors ?? null)
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

  const checks = [
    hasIdentityName,
    hasUniversity,
    majors.length > 0,
    hasYear,
    hasExperience,
    hasStartMonth,
    hasHours,
    coursework.length > 0,
  ]
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
  const showBrowseHeroButton = basePath !== '/'
  const resolvedSearchParams = ((searchParams ? await Promise.resolve(searchParams) : {}) ?? {}) as JobsQuery
  const searchQuery = (resolvedSearchParams.q ?? '').trim()
  const normalizedSearchQuery = searchQuery.toLowerCase()
  const activeCategory = resolvedSearchParams.category ?? ''
  const payMin = resolvedSearchParams.paymin ?? ''
  const remoteOnly = resolvedSearchParams.remote === '1'
  const selectedExperience = resolvedSearchParams.exp ?? ''
  const hoursMin = resolvedSearchParams.hmin ?? ''
  const hoursMax = resolvedSearchParams.hmax?.trim() || resolvedSearchParams.hmax_slider?.trim() || ''
  const rawLocationQuery = (resolvedSearchParams.loc ?? '').trim()
  const radius = resolvedSearchParams.radius ?? ''
  const parsedRadius =
    radius === '10' || radius === '25' || radius === '50' || radius === '100' ? Number(radius) : 0
  const parsedPayMin = payMin ? Number(payMin) : null

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const internships = await fetchInternships()
  const newestInternships = internships.slice(0, 6)
  const launchVerifiedLocations = [
    'Salt Lake City, UT',
    'Provo, UT',
    'Orem, UT',
    'Lehi, UT',
    'Ogden, UT',
    'Sandy, UT',
    'Draper, UT',
    'Park City, UT',
  ]
  const verifiedLocations = Array.from(
    new Set(
      [
        ...launchVerifiedLocations,
        ...internships
          .map((listing) => {
            const city = listing.location_city?.trim()
            const state = listing.location_state?.trim()
            if (city && state) return `${city}, ${state}`
            return null
          })
          .filter((value): value is string => Boolean(value)),
      ]
    )
  ).sort((a, b) => a.localeCompare(b))
  const locationQuery = verifiedLocations.includes(rawLocationQuery) ? rawLocationQuery : ''

  let sortedInternships = internships
  let isBestMatch = false
  let profileMajors: string[] = []
  let profileYear: string | null = null
  let profileExperienceLevel: string | null = null
  let profileAvailability: number | null = null
  let profileCoursework: string[] = []
  let profileSkills: string[] = []
  let profileSkillIds: string[] = []
  let studentTransportMode: string | null = null
  let studentMaxCommuteMinutes: number | null = null
  let studentLocation: { city: string | null; state: string | null; zip: string | null; point: { lat: number; lng: number } | null } = {
    city: null,
    state: null,
    zip: null,
    point: null,
  }
  const matchReasonsById = new Map<string, string[]>()
  const commuteMinutesById = new Map<string, number>()
  let role: 'student' | 'employer' | undefined
  let showCompleteProfileBanner = false
  let profileCompletionPercent = 0

  if (user) {
    const userMetadata = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string }
    const hasIdentityName =
      (typeof userMetadata.first_name === 'string' &&
        userMetadata.first_name.trim().length > 0 &&
        typeof userMetadata.last_name === 'string' &&
        userMetadata.last_name.trim().length > 0) ||
      (typeof userMetadata.full_name === 'string' &&
        userMetadata.full_name
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean).length >= 2)
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
        'university_id, school, major_id, major:canonical_majors(id, slug, name), majors, year, coursework, experience_level, availability_start_month, availability_hours_per_week, interests, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode, location_lat, location_lng'
      )
      .eq('user_id', user.id)
      .maybeSingle()
    const [{ data: studentSkillRows }, { data: studentCourseworkRows }, { data: studentCourseworkCategoryRows }] = await Promise.all([
      supabase.from('student_skill_items').select('skill_id').eq('student_id', user.id),
      supabase.from('student_coursework_items').select('coursework_item_id').eq('student_id', user.id),
      supabase.from('student_coursework_category_links').select('category_id').eq('student_id', user.id),
    ])

    const profileMajorName = canonicalMajorName(profile?.major)
    profileMajors = profileMajorName ? parseMajors([profileMajorName]) : parseMajors(profile?.majors ?? null)
    profileYear = profile?.year ?? null
    profileExperienceLevel = profile?.experience_level ?? null
    profileAvailability = profile?.availability_hours_per_week ?? null
    profileCoursework = Array.isArray(profile?.coursework)
      ? profile.coursework.filter(
          (course): course is string => typeof course === 'string' && course.length > 0
        )
      : []
    const preferenceSignals = parseStudentPreferenceSignals(profile?.interests ?? null)
    profileSkills = preferenceSignals.skills
    studentTransportMode = typeof profile?.transport_mode === 'string' ? profile.transport_mode : 'driving'
    studentMaxCommuteMinutes = typeof profile?.max_commute_minutes === 'number' ? profile.max_commute_minutes : null
    studentLocation = {
      city: typeof profile?.preferred_city === 'string' ? profile.preferred_city : null,
      state: typeof profile?.preferred_state === 'string' ? profile.preferred_state : null,
      zip: typeof profile?.preferred_zip === 'string' ? profile.preferred_zip : null,
      point: toGeoPoint(
        typeof profile?.location_lat === 'number' ? profile.location_lat : null,
        typeof profile?.location_lng === 'number' ? profile.location_lng : null
      ),
    }
    profileSkillIds = (studentSkillRows ?? [])
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string')
    const profileCourseworkItemIds = (studentCourseworkRows ?? [])
      .map((row) => row.coursework_item_id)
      .filter((value): value is string => typeof value === 'string')
    const profileCourseworkCategoryIds = (studentCourseworkCategoryRows ?? [])
      .map((row) => row.category_id)
      .filter((value): value is string => typeof value === 'string')

    if (role === 'student') {
      const completion = getStudentProfileCompletion(profile ?? null, hasIdentityName)
      profileCompletionPercent = completion.percent
      showCompleteProfileBanner = !completion.isComplete
    }

    if (
      role === 'student' &&
      (profileMajors.length > 0 ||
        typeof profileAvailability === 'number' ||
        profileCoursework.length > 0 ||
        profileSkillIds.length > 0 ||
        Boolean(profileYear) ||
        Boolean(profileExperienceLevel))
    ) {
      isBestMatch = true
      const ranked = rankInternships(
        internships.map((listing) => ({
          id: listing.id,
          title: listing.title,
          description: listing.description,
          majors: listing.majors,
          target_graduation_years: listing.target_graduation_years,
          experience_level: listing.experience_level,
          category: listing.role_category ?? listing.category ?? null,
          hours_per_week: listing.hours_per_week,
          location: listing.location,
          work_mode: listing.work_mode,
          term: listing.term,
          required_skills: listing.required_skills,
          preferred_skills: listing.preferred_skills,
          recommended_coursework: listing.recommended_coursework,
          required_skill_ids: listing.required_skill_ids,
          preferred_skill_ids: listing.preferred_skill_ids,
          coursework_item_ids: listing.coursework_item_ids,
          coursework_category_ids: listing.coursework_category_ids,
          coursework_category_names: listing.coursework_category_names,
        })),
        {
          majors: profileMajors,
          year: profileYear,
          experience_level: profileExperienceLevel,
          skills: profileSkills,
          skill_ids: profileSkillIds,
          coursework_item_ids: profileCourseworkItemIds,
          coursework_category_ids: profileCourseworkCategoryIds,
          coursework: profileCoursework,
          availability_hours_per_week: profileAvailability,
          preferred_terms:
            preferenceSignals.preferredTerms.length > 0
              ? preferenceSignals.preferredTerms
              : profile?.availability_start_month
                ? [seasonFromMonth(profile.availability_start_month)]
                : [],
          preferred_locations: preferenceSignals.preferredLocations,
          preferred_work_modes: preferenceSignals.preferredWorkModes,
          remote_only: preferenceSignals.remoteOnly,
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
    const normalizedCompany = listing.company_name?.toLowerCase() ?? ''
    const normalizedDescription = listing.description?.toLowerCase() ?? ''
    const normalizedCategoryText = (listing.category ?? listing.role_category ?? '').toLowerCase()
    const isRemote = (listing.location ?? '').toLowerCase().includes('remote')
    const listingExperience = (listing.experience_level ?? '').toLowerCase()
    const parsedMinHours = hoursMin ? Number(hoursMin) : null
    const parsedMaxHours = hoursMax ? Number(hoursMax) : null
    const listingPayRange = extractNumericPayRange(listing.pay)
    const normalizedLocationQuery = locationQuery.toLowerCase()
    const listingCity = (listing.location_city ?? '').toLowerCase()
    const listingState = (listing.location_state ?? '').toLowerCase()
    const listingLocation = (listing.location ?? '').toLowerCase()

    if (normalizedSearchQuery) {
      const internshipMatches =
        normalizedTitle.includes(normalizedSearchQuery) ||
        normalizedDescription.includes(normalizedSearchQuery) ||
        normalizedCategoryText.includes(normalizedSearchQuery)
      const employerMatches = normalizedCompany.includes(normalizedSearchQuery)

      if (!internshipMatches && !employerMatches) return false
    }

    if (activeCategory) {
      const normalizedCategory = activeCategory.toLowerCase()
      const listingCategory = (listing.category ?? listing.role_category ?? '').toLowerCase()
      const hasCategoryMatch =
        listingCategory === normalizedCategory ||
        listingMajors.some((major) => major.includes(normalizedCategory)) ||
        normalizedTitle.includes(normalizedCategory)
      if (!hasCategoryMatch) return false
    }

    if (typeof parsedPayMin === 'number' && Number.isFinite(parsedPayMin) && parsedPayMin > 0) {
      if (!listingPayRange || listingPayRange.max < parsedPayMin) return false
    }

    if (remoteOnly && !isRemote) return false
    if (selectedExperience && listingExperience !== selectedExperience) return false
    const listingHoursMin = typeof listing.hours_min === 'number' ? listing.hours_min : listing.hours_per_week
    const listingHoursMax = typeof listing.hours_max === 'number' ? listing.hours_max : listing.hours_per_week
    if (typeof parsedMinHours === 'number' && Number.isFinite(parsedMinHours) && typeof listingHoursMax === 'number') {
      if (listingHoursMax < parsedMinHours) return false
    }
    if (typeof parsedMaxHours === 'number' && Number.isFinite(parsedMaxHours) && typeof listingHoursMin === 'number') {
      if (listingHoursMin > parsedMaxHours) return false
    }

    if (normalizedLocationQuery) {
      const [queryCityRaw, queryStateRaw] = normalizedLocationQuery.split(',').map((value) => value.trim())
      const queryCity = queryCityRaw ?? normalizedLocationQuery
      const queryState = (queryStateRaw ?? '').replace(/[^a-z]/g, '').slice(0, 2)
      const directMatch =
        listingLocation.includes(normalizedLocationQuery) ||
        listingCity.includes(normalizedLocationQuery) ||
        listingState === normalizedLocationQuery
      let radiusMatch = false

      if (parsedRadius > 0) {
        if (queryCity && listingCity && listingCity.includes(queryCity)) {
          radiusMatch = true
        }
        if (!radiusMatch && parsedRadius >= 25 && queryState && listingState === queryState) {
          radiusMatch = true
        }
      }

      if (!directMatch && !radiusMatch) return false
    }

    return true
  })

  if (user && role === 'student' && filteredInternships.length > 0) {
    const employerIds = Array.from(
      new Set(
        filteredInternships
          .map((listing) => listing.employer_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    )
    const { data: employerProfiles } =
      employerIds.length > 0
        ? await supabase
            .from('employer_profiles')
            .select('user_id, location')
            .in('user_id', employerIds)
        : { data: [] as Array<{ user_id: string; location: string | null }> }

    const employerLocationById = new Map(
      (employerProfiles ?? []).map((row) => {
        const parsed = parseCityState(row.location ?? null)
        return [
          row.user_id,
          {
            city: parsed.city,
            state: parsed.state,
            zip: null as string | null,
            point: null as { lat: number; lng: number } | null,
          },
        ]
      })
    )

    const commuteMap = await getCommuteMinutesForListings({
      supabase,
      userId: user.id,
      origin: studentLocation,
      transportMode: studentTransportMode,
      destinations: filteredInternships.map((listing) => {
        const employerLocation = listing.employer_id ? employerLocationById.get(listing.employer_id) : undefined
        return {
          internshipId: listing.id,
          workMode: listing.work_mode,
          city: listing.location_city ?? null,
          state: listing.location_state ?? null,
          zip: null,
          point: null,
          fallbackCity: employerLocation?.city ?? listing.location_city,
          fallbackState: employerLocation?.state ?? listing.location_state,
          fallbackZip: employerLocation?.zip ?? null,
          fallbackPoint: employerLocation?.point ?? null,
        }
      }),
    })

    for (const [internshipId, minutes] of commuteMap.entries()) {
      commuteMinutesById.set(internshipId, minutes)
    }
  }
  const listingsTitle = filteredInternships.length === 0 ? 'Browse internships' : 'Internships hiring now'
  const compactStudentHero = showHero && role === 'student'

  return (
    <>
      {showHero ? (
        <section className="border-b border-blue-100 bg-gradient-to-b from-blue-50 to-slate-50">
          <div className={`mx-auto max-w-6xl px-6 ${compactStudentHero ? 'py-6' : 'py-10'}`}>
            <div className="mx-auto max-w-3xl text-center">
              <h1 className={`font-semibold tracking-tight text-slate-900 ${compactStudentHero ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
                {user
                  ? role === 'student'
                    ? 'Internships made for you.'
                    : 'Find internships that fit your major and schedule.'
                  : 'Create profile to get specialized internships matched to you.'}
              </h1>
              <p className={`${compactStudentHero ? 'mt-2' : 'mt-3'} text-sm text-slate-600 sm:text-base`}>
                {user
                  ? 'Filter fast and start with roles you can actually apply to this term.'
                  : 'Browse first, then create your profile for better match ranking.'}
              </p>
              <div className={`${compactStudentHero ? 'mt-4' : 'mt-6'} flex flex-wrap items-center justify-center gap-2`}>
                {showBrowseHeroButton && (
                  <Link
                    href={`#${anchorId}`}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Browse internships
                  </Link>
                )}
                {!user && (
                  <Link
                    href="/signup/student"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Create profile
                  </Link>
                )}
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[290px_1fr]">
          <FiltersPanel
            categories={categoryTiles}
            verifiedLocations={verifiedLocations}
            state={{
              searchQuery,
              category: activeCategory,
              payMin,
              remoteOnly,
              experience: selectedExperience,
              hoursMin,
              hoursMax,
              locationQuery,
              radius,
            }}
            basePath={basePath}
            anchorId={anchorId}
          />

          <div className="space-y-4">
            {internships.length === 0 ? (
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
            ) : filteredInternships.length === 0 ? (
              <div className="space-y-6">
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-lg text-blue-700">
                      ✦
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">No matches for these filters</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Try clearing filters or adjusting your search to see matching opportunities.
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

                {newestInternships.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">Newest internships</h3>
                      <Link href={buildBrowseHref(basePath, anchorId)} className="text-sm font-medium text-blue-700 hover:underline">
                        Browse all internships
                      </Link>
                    </div>
                    <div className={`mt-4 grid gap-4 ${newestInternships.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                      {newestInternships.map((listing) => (
                        <JobCard
                          key={listing.id}
                          listing={{
                            ...listing,
                            majorsText: formatMajors(listing.majors),
                            commuteMinutes: commuteMinutesById.get(listing.id) ?? null,
                            maxCommuteMinutes: studentMaxCommuteMinutes,
                          }}
                          isAuthenticated={Boolean(user)}
                          userRole={role ?? null}
                          matchSignals={role === 'student' ? matchReasonsById.get(listing.id) ?? [] : []}
                        />
                      ))}
                    </div>
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
                      commuteMinutes: commuteMinutesById.get(listing.id) ?? null,
                      maxCommuteMinutes: studentMaxCommuteMinutes,
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
