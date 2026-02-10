'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { APPLY_ERROR, isDuplicateApplicationConstraintError, type ApplyErrorCode } from '@/lib/applyErrors'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { buildApplicationMatchSnapshot } from '@/lib/applicationMatchSnapshot'
import { sendEmployerApplicationAlert } from '@/lib/email/employerAlerts'
import { guardApplicationSubmit, EMAIL_VERIFICATION_ERROR } from '@/lib/auth/verifiedActionGate'

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

  const verificationGate = guardApplicationSubmit(user, listingId)
  if (!verificationGate.ok) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: EMAIL_VERIFICATION_ERROR, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.EMAIL_NOT_VERIFIED }
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

  const [{ data: listing }, { data: userRow }, { data: profile }, { data: studentCourseworkCategoryRows }] = await Promise.all([
    supabase
      .from('internships')
      .select(
        'id, title, majors, target_graduation_years, experience_level, hours_per_week, location, description, work_mode, term, role_category, required_skills, preferred_skills, recommended_coursework, internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('student_profiles')
      .select('school, major_id, majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('student_coursework_category_links').select('category_id').eq('student_id', user.id),
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
    internship: {
      ...listing,
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
    profile: {
      ...(profile ?? {}),
      coursework_category_ids: (studentCourseworkCategoryRows ?? [])
        .map((item) => item.category_id)
        .filter((value): value is string => typeof value === 'string'),
    },
  })

  const { data: insertedApplication, error: insertError } = await supabase
    .from('applications')
    .insert({
      internship_id: listingId,
      student_id: user.id,
      resume_url: resumePath,
      status: 'submitted',
      match_score: snapshot.match_score,
      match_reasons: snapshot.match_reasons,
      match_gaps: snapshot.match_gaps,
      matching_version: snapshot.matching_version,
    })
    .select('id')
    .single()

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

  if (insertedApplication?.id) {
    try {
      await sendEmployerApplicationAlert({ applicationId: insertedApplication.id })
    } catch {
      // no-op; email should not block application submission
    }
  }

  return { ok: true }
}
