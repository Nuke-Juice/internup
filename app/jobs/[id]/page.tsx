import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getCommuteMinutesForListings, toGeoPoint } from '@/lib/commute'
import { supabaseServer } from '@/lib/supabase/server'
import { DEFAULT_MATCHING_WEIGHTS, evaluateInternshipMatch, parseMajors } from '@/lib/matching'
import { parseStudentPreferenceSignals } from '@/lib/student/preferenceSignals'
import ApplyButton from '../_components/ApplyButton'

function formatMajors(value: string[] | string | null) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

function seasonFromMonth(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.startsWith('jun') || normalized.startsWith('jul') || normalized.startsWith('aug')) return 'summer'
  if (normalized.startsWith('sep') || normalized.startsWith('oct') || normalized.startsWith('nov')) return 'fall'
  if (normalized.startsWith('dec') || normalized.startsWith('jan') || normalized.startsWith('feb')) return 'winter'
  if (normalized.startsWith('mar') || normalized.startsWith('apr') || normalized.startsWith('may')) return 'spring'
  return ''
}

function scoreToPercent(score: number) {
  const maxScore = Object.values(DEFAULT_MATCHING_WEIGHTS).reduce((sum, value) => sum + value, 0)

  if (maxScore <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)))
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function gapCta(gap: string) {
  const normalized = gap.toLowerCase()
  if (normalized.includes('missing required skills')) {
    return { href: '/account#skills', label: 'Add skills' }
  }
  if (normalized.includes('hours exceed availability') || normalized.includes('availability')) {
    return { href: '/account#availability', label: 'Update availability' }
  }
  if (
    normalized.includes('location mismatch') ||
    normalized.includes('work mode mismatch') ||
    normalized.includes('requires in-person')
  ) {
    return { href: '/account#preferences', label: 'Update preferences' }
  }
  return null
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

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let userRole: 'student' | 'employer' | null = null

  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (userRow?.role === 'student' || userRow?.role === 'employer') {
      userRole = userRow.role
    }
  }

  const listingSelectRich =
    'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, experience_level, majors, target_graduation_years, description, hours_per_week, role_category, work_mode, term, required_skills, preferred_skills, recommended_coursework, application_deadline, internship_required_skill_items(skill_id), internship_preferred_skill_items(skill_id), internship_coursework_items(coursework_item_id), internship_coursework_category_links(category_id, category:coursework_categories(name))'
  const listingSelectBase =
    'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, experience_level, majors, target_graduation_years, description, hours_per_week, role_category, work_mode, term, required_skills, preferred_skills, recommended_coursework, application_deadline'

  const { data: richListing, error: richListingError } = await supabase
    .from('internships')
    .select(listingSelectRich)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  let listing = richListing as
    | (typeof richListing & {
        internship_required_skill_items?: Array<{ skill_id: string | null }> | null
        internship_preferred_skill_items?: Array<{ skill_id: string | null }> | null
        internship_coursework_items?: Array<{ coursework_item_id: string | null }> | null
        internship_coursework_category_links?: Array<{ category_id: string | null; category?: { name?: string | null } | null }> | null
      })
    | null

  if (richListingError) {
    console.error('[jobs] detail rich query failed; retrying with base fields', richListingError.message)
    const { data: baseListing, error: baseListingError } = await supabase
      .from('internships')
      .select(listingSelectBase)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (baseListingError) {
      console.error('[jobs] detail base query failed', baseListingError.message)
    }

    listing = baseListing
      ? {
          ...baseListing,
          internship_required_skill_items: [],
          internship_preferred_skill_items: [],
          internship_coursework_items: [],
          internship_coursework_category_links: [],
        }
      : null
  }

  let matchBreakdown: { scorePercent: number; reasons: string[]; gaps: string[] } | null = null
  let commuteMinutes: number | null = null
  let maxCommuteMinutes: number | null = null
  if (user && userRole === 'student' && listing) {
    const [{ data: profile }, { data: studentSkillRows }, { data: studentCourseworkRows }, { data: studentCourseworkCategoryRows }] = await Promise.all([
      supabase
        .from('student_profiles')
        .select(
          'major_id, major:canonical_majors(id, slug, name), majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode, location_lat, location_lng'
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('student_skill_items').select('skill_id').eq('student_id', user.id),
      supabase.from('student_coursework_items').select('coursework_item_id').eq('student_id', user.id),
      supabase.from('student_coursework_category_links').select('category_id').eq('student_id', user.id),
    ])

    const canonicalSkillIds = (studentSkillRows ?? [])
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string')
    const canonicalCourseworkItemIds = (studentCourseworkRows ?? [])
      .map((row) => row.coursework_item_id)
      .filter((value): value is string => typeof value === 'string')
    const canonicalCourseworkCategoryIds = (studentCourseworkCategoryRows ?? [])
      .map((row) => row.category_id)
      .filter((value): value is string => typeof value === 'string')
    const coursework = Array.isArray(profile?.coursework)
      ? profile.coursework.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
    const preferenceSignals = parseStudentPreferenceSignals(profile?.interests ?? null)

    const match = evaluateInternshipMatch(
      {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        majors: listing.majors,
        target_graduation_years: listing.target_graduation_years ?? null,
        experience_level: listing.experience_level ?? null,
        hours_per_week: listing.hours_per_week,
        location: listing.location,
        category: listing.role_category ?? null,
        work_mode: listing.work_mode ?? null,
        term: listing.term ?? null,
        required_skills: listing.required_skills ?? null,
        preferred_skills: listing.preferred_skills ?? null,
        recommended_coursework: listing.recommended_coursework ?? null,
        required_skill_ids: (listing.internship_required_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((value): value is string => typeof value === 'string'),
        preferred_skill_ids: (listing.internship_preferred_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((value): value is string => typeof value === 'string'),
        coursework_item_ids: (listing.internship_coursework_items ?? [])
          .map((item) => item.coursework_item_id)
          .filter((value): value is string => typeof value === 'string'),
        coursework_category_ids: (listing.internship_coursework_category_links ?? [])
          .map((item) => item.category_id)
          .filter((value): value is string => typeof value === 'string'),
        coursework_category_names: (listing.internship_coursework_category_links ?? [])
          .map((item) => {
            const category = item.category as { name?: string | null } | null
            return typeof category?.name === 'string' ? category.name : ''
          })
          .filter((value): value is string => value.length > 0),
      },
      {
        majors: (() => {
          const majorName = canonicalMajorName(profile?.major)
          return majorName ? parseMajors([majorName]) : parseMajors(profile?.majors ?? null)
        })(),
        year: profile?.year ?? null,
        experience_level: profile?.experience_level ?? null,
        skills: preferenceSignals.skills,
        coursework,
        skill_ids: canonicalSkillIds,
        coursework_item_ids: canonicalCourseworkItemIds,
        coursework_category_ids: canonicalCourseworkCategoryIds,
        availability_hours_per_week: profile?.availability_hours_per_week ?? null,
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

    matchBreakdown = {
      scorePercent: scoreToPercent(match.score),
      reasons: match.reasons,
      gaps: match.gaps,
    }

    maxCommuteMinutes = typeof profile?.max_commute_minutes === 'number' ? profile.max_commute_minutes : null
    const origin = {
      city: typeof profile?.preferred_city === 'string' ? profile.preferred_city : null,
      state: typeof profile?.preferred_state === 'string' ? profile.preferred_state : null,
      zip: typeof profile?.preferred_zip === 'string' ? profile.preferred_zip : null,
      point: toGeoPoint(
        typeof profile?.location_lat === 'number' ? profile.location_lat : null,
        typeof profile?.location_lng === 'number' ? profile.location_lng : null
      ),
    }

    let fallbackEmployerLocation: {
      city: string | null
      state: string | null
      zip: string | null
      point: { lat: number; lng: number } | null
    } | null = null

    if (listing.employer_id) {
      const { data: employerProfile } = await supabase
        .from('employer_profiles')
        .select('location')
        .eq('user_id', listing.employer_id)
        .maybeSingle()
      if (employerProfile) {
        const parsed = parseCityState(employerProfile.location ?? null)
        fallbackEmployerLocation = {
          city: parsed.city,
          state: parsed.state,
          zip: null,
          point: null,
        }
      }
    }

    const commuteMap = await getCommuteMinutesForListings({
      supabase,
      userId: user.id,
      origin,
      transportMode: typeof profile?.transport_mode === 'string' ? profile.transport_mode : 'driving',
      destinations: [
        {
          internshipId: listing.id,
          workMode: listing.work_mode,
          city: listing.location_city ?? null,
          state: listing.location_state ?? null,
          zip: null,
          point: null,
          fallbackCity: fallbackEmployerLocation?.city ?? listing.location_city,
          fallbackState: fallbackEmployerLocation?.state ?? listing.location_state,
          fallbackZip: fallbackEmployerLocation?.zip ?? null,
          fallbackPoint: fallbackEmployerLocation?.point ?? null,
        },
      ],
    })

    commuteMinutes = commuteMap.get(listing.id) ?? null
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h1 className="text-xl font-semibold text-slate-900">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This listing no longer exists or the link is incorrect.
            </p>
          </div>
        </div>
      </main>
    )
  }

  await trackAnalyticsEvent({
    eventName: 'view_job_detail',
    userId: user?.id ?? null,
    properties: { listing_id: listing.id },
  })

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold text-slate-900">{listing.title || 'Internship'}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {listing.employer_id ? (
                      <Link
                        href={`/employers/${encodeURIComponent(listing.employer_id)}`}
                        className="font-medium text-slate-800 hover:text-blue-700 hover:underline"
                      >
                        {listing.company_name || 'Company'}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-800">{listing.company_name || 'Company'}</span>
                    )}
                    <EmployerVerificationBadge tier={listing.employer_verification_tier ?? 'free'} />
                    <span className="text-slate-400">•</span>
                    <span>{listing.location || 'TBD'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {listing.work_mode ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {listing.work_mode}
                    </span>
                  ) : null}
                  {listing.term ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {listing.term}
                    </span>
                  ) : null}
                  {listing.experience_level ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {listing.experience_level}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {typeof listing.hours_per_week === 'number' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours/week</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{listing.hours_per_week}</div>
                  </div>
                ) : null}
                {typeof commuteMinutes === 'number' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated commute</div>
                    <div
                      className={`mt-1 text-base font-semibold ${
                        typeof maxCommuteMinutes === 'number' && commuteMinutes > maxCommuteMinutes
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      ~{commuteMinutes} min
                      {typeof maxCommuteMinutes === 'number' ? ` (${maxCommuteMinutes} min target)` : ''}
                    </div>
                  </div>
                ) : null}
                {listing.majors ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended majors</div>
                    <div className="mt-1 text-sm text-slate-800">{formatMajors(listing.majors)}</div>
                  </div>
                ) : null}
                {Array.isArray(listing.recommended_coursework) && listing.recommended_coursework.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended coursework</div>
                    <div className="mt-1 text-sm text-slate-800">{listing.recommended_coursework.join(', ')}</div>
                  </div>
                ) : null}
              </div>
            </section>

            {listing.description ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Role overview</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{listing.description}</p>
              </section>
            ) : null}

            {Array.isArray(listing.required_skills) && listing.required_skills.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Required skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.required_skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(listing.preferred_skills) && listing.preferred_skills.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preferred skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.preferred_skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Why this match</h2>
              {!user ? (
                <p className="mt-2 text-sm text-slate-600">Sign in to see your personalized match breakdown.</p>
              ) : userRole !== 'student' ? (
                <p className="mt-2 text-sm text-slate-600">Match breakdown is available for student accounts.</p>
              ) : !matchBreakdown ? (
                <p className="mt-2 text-sm text-slate-600">Match breakdown unavailable.</p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Match score</div>
                    <div className="mt-1 text-3xl font-semibold text-slate-900">{matchBreakdown.scorePercent}</div>
                    <div className="text-xs text-slate-500">out of 100</div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Reasons</div>
                      {matchBreakdown.reasons.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {matchBreakdown.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No positive reasons yet.</p>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Gaps</div>
                      {matchBreakdown.gaps.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {matchBreakdown.gaps.map((gap) => {
                            const cta = gapCta(gap)
                            return (
                              <li key={gap} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                                <div className="text-slate-700">{gap}</div>
                                {cta ? (
                                  <Link href={cta.href} className="mt-1 inline-flex text-xs font-medium text-blue-700 hover:underline">
                                    {cta.label}
                                  </Link>
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No major gaps detected.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-blue-950">Ready to apply?</h2>
              <p className="mt-1 text-sm text-blue-900">
                {listing.application_deadline
                  ? `Deadline: ${formatDate(listing.application_deadline) ?? listing.application_deadline}`
                  : 'Applications are currently open.'}
              </p>

              <div className="mt-4 grid gap-2 rounded-lg border border-blue-100 bg-white/80 p-3 text-xs text-blue-950">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Company</span>
                  {listing.employer_id ? (
                    <Link href={`/employers/${encodeURIComponent(listing.employer_id)}`} className="font-medium text-blue-800 hover:underline">
                      {listing.company_name || 'Company'}
                    </Link>
                  ) : (
                    <span className="font-medium">{listing.company_name || 'Company'}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-blue-700">Location</span>
                  <span className="text-right font-medium">{listing.location || 'TBD'}</span>
                </div>
                {listing.term ? (
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Term</span>
                    <span className="font-medium">{listing.term}</span>
                  </div>
                ) : null}
                {listing.work_mode ? (
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700">Work mode</span>
                    <span className="font-medium">{listing.work_mode}</span>
                  </div>
                ) : null}
              </div>

              <ApplyButton
                listingId={listing.id}
                isAuthenticated={Boolean(user)}
                userRole={userRole}
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
