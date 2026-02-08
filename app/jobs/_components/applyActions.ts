'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { APPLY_ERROR, isDuplicateApplicationConstraintError, type ApplyErrorCode } from '@/lib/applyErrors'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { buildApplicationMatchSnapshot } from '@/lib/applicationMatchSnapshot'

type ApplyFromMicroOnboardingInput = {
  listingId: string
}

type ApplyFromMicroOnboardingResult =
  | { ok: true }
  | {
      ok: false
      code: ApplyErrorCode
      missing?: string[]
    }

export async function applyFromMicroOnboardingAction({
  listingId,
}: ApplyFromMicroOnboardingInput): Promise<ApplyFromMicroOnboardingResult> {
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: null,
      properties: { listing_id: listingId, code: APPLY_ERROR.AUTH_REQUIRED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.AUTH_REQUIRED }
  }

  const resumePath =
    typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path.trim() : ''

  if (!resumePath) {
    await trackAnalyticsEvent({
      eventName: 'apply_recovery_started',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.RESUME_REQUIRED, missing: [] },
    })
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.RESUME_REQUIRED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.RESUME_REQUIRED }
  }

  const [{ data: listing }, { data: userRow }, { data: profile }] = await Promise.all([
    supabase
      .from('internships')
      .select(
        'id, title, majors, hours_per_week, location, description, work_mode, term, role_category, required_skills, preferred_skills'
      )
      .eq('id', listingId)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('student_profiles')
      .select('school, majors, coursework, availability_start_month, availability_hours_per_week')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!listing?.id) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.LISTING_NOT_FOUND, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.LISTING_NOT_FOUND }
  }

  if (!userRow || userRow.role !== 'student') {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.ROLE_NOT_STUDENT, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.ROLE_NOT_STUDENT }
  }

  const completeness = getMinimumProfileCompleteness(profile)
  if (!completeness.ok) {
    await trackAnalyticsEvent({
      eventName: 'apply_recovery_started',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing },
    })
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing },
    })
    return { ok: false, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing }
  }

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('student_id', user.id)
    .eq('internship_id', listingId)
    .maybeSingle()

  if (existing?.id) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.DUPLICATE_APPLICATION, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.DUPLICATE_APPLICATION }
  }

  const snapshot = buildApplicationMatchSnapshot({
    internship: listing,
    profile,
  })

  const { error: insertError } = await supabase.from('applications').insert({
    internship_id: listingId,
    student_id: user.id,
    resume_url: resumePath,
    status: 'submitted',
    match_score: snapshot.match_score,
    match_reasons: snapshot.match_reasons,
    match_gaps: snapshot.match_gaps,
    matching_version: snapshot.matching_version,
  })

  if (insertError) {
    if (isDuplicateApplicationConstraintError(insertError)) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: user.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.DUPLICATE_APPLICATION, missing: [] },
      })
      return { ok: false, code: APPLY_ERROR.DUPLICATE_APPLICATION }
    }

    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.APPLICATION_INSERT_FAILED }
  }

  await trackAnalyticsEvent({
    eventName: 'submit_apply_success',
    userId: user.id,
    properties: { listing_id: listingId, source: 'applyFromMicroOnboardingAction' },
  })
  return { ok: true }
}
