import Link from 'next/link'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { supabaseServer } from '@/lib/supabase/server'
import { DEFAULT_MATCHING_WEIGHTS, evaluateInternshipMatch, parseMajors } from '@/lib/matching'
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
  const maxScore =
    DEFAULT_MATCHING_WEIGHTS.skillsRequired +
    DEFAULT_MATCHING_WEIGHTS.skillsPreferred +
    DEFAULT_MATCHING_WEIGHTS.majorCategoryAlignment +
    DEFAULT_MATCHING_WEIGHTS.availability +
    DEFAULT_MATCHING_WEIGHTS.locationModePreference

  if (maxScore <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)))
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

  const { data: listing } = await supabase
    .from('internships')
    .select(
      'id, title, company_name, location, experience_level, majors, description, hours_per_week, role_category, work_mode, term, required_skills, preferred_skills, internship_required_skill_items(skill_id), internship_preferred_skill_items(skill_id)'
    )
    .eq('id', id)
    .maybeSingle()

  let matchBreakdown: { scorePercent: number; reasons: string[]; gaps: string[] } | null = null
  if (user && userRole === 'student' && listing) {
    const [{ data: profile }, { data: studentSkillRows }] = await Promise.all([
      supabase
        .from('student_profiles')
        .select('majors, coursework, availability_start_month, availability_hours_per_week')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('student_skill_items').select('skill_id').eq('student_id', user.id),
    ])

    const canonicalSkillIds = (studentSkillRows ?? [])
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string')
    const coursework = Array.isArray(profile?.coursework)
      ? profile.coursework.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []

    const match = evaluateInternshipMatch(
      {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        majors: listing.majors,
        hours_per_week: listing.hours_per_week,
        location: listing.location,
        category: listing.role_category ?? null,
        work_mode: listing.work_mode ?? null,
        term: listing.term ?? null,
        required_skills: listing.required_skills ?? null,
        preferred_skills: listing.preferred_skills ?? null,
        required_skill_ids: (listing.internship_required_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((value): value is string => typeof value === 'string'),
        preferred_skill_ids: (listing.internship_preferred_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((value): value is string => typeof value === 'string'),
      },
      {
        majors: parseMajors(profile?.majors ?? null),
        coursework,
        skill_ids: canonicalSkillIds,
        availability_hours_per_week: profile?.availability_hours_per_week ?? null,
        preferred_terms: profile?.availability_start_month ? [seasonFromMonth(profile.availability_start_month)] : [],
      }
    )

    matchBreakdown = {
      scorePercent: scoreToPercent(match.score),
      reasons: match.reasons,
      gaps: match.gaps,
    }
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/jobs" className="text-sm font-medium text-blue-700 hover:underline">
            Back to jobs
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
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/jobs" className="text-sm font-medium text-blue-700 hover:underline">
          Back to jobs
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">{listing.title || 'Internship'}</h1>
            <div className="text-sm text-slate-600">
              {listing.company_name || 'Company'} · {listing.location || 'TBD'}
            </div>
            <div className="text-xs text-slate-500">
              Experience: {listing.experience_level || 'TBD'}
            </div>
            {typeof listing.hours_per_week === 'number' && (
              <div className="text-xs text-slate-500">Hours/week: {listing.hours_per_week}</div>
            )}
            {listing.majors && (
              <div className="text-xs text-slate-500">Majors: {formatMajors(listing.majors)}</div>
            )}
          </div>

          {listing.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{listing.description}</p>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Why this match?</h2>
            {!user ? (
              <p className="mt-2 text-sm text-slate-600">Sign in to see match breakdown.</p>
            ) : userRole !== 'student' ? (
              <p className="mt-2 text-sm text-slate-600">Match breakdown is available for student accounts.</p>
            ) : !matchBreakdown ? (
              <p className="mt-2 text-sm text-slate-600">Match breakdown unavailable.</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Score</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{matchBreakdown.scorePercent}/100</div>
                </div>

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
                          <li key={gap} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
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
            )}
          </div>

          <div className="mt-6">
            <ApplyButton
              listingId={listing.id}
              isAuthenticated={Boolean(user)}
              userRole={userRole}
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
