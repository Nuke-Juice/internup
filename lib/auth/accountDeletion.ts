import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountDeletionResult =
  | { ok: true }
  | { ok: false; error: string }

type IdRow = { id: string }

export async function deleteUserAccountById(admin: SupabaseClient, userId: string): Promise<AccountDeletionResult> {
  if (!userId.trim()) {
    return { ok: false, error: 'Missing user id.' }
  }

  try {
    const { data: internshipRows, error: internshipLookupError } = await admin
      .from('internships')
      .select('id')
      .eq('employer_id', userId)

    if (internshipLookupError) {
      return { ok: false, error: internshipLookupError.message }
    }

    const internshipIds = ((internshipRows ?? []) as IdRow[])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    if (internshipIds.length > 0) {
      const [{ error: requiredSkillsError }, { error: preferredSkillsError }, { error: courseworkItemsError }, { error: courseworkCategoriesError }, { error: requiredCourseCategoriesError }, { error: applicationsByInternshipError }, { error: commuteCacheByInternshipError }] = await Promise.all([
        admin.from('internship_required_skill_items').delete().in('internship_id', internshipIds),
        admin.from('internship_preferred_skill_items').delete().in('internship_id', internshipIds),
        admin.from('internship_coursework_items').delete().in('internship_id', internshipIds),
        admin.from('internship_coursework_category_links').delete().in('internship_id', internshipIds),
        admin.from('internship_required_course_categories').delete().in('internship_id', internshipIds),
        admin.from('applications').delete().in('internship_id', internshipIds),
        admin.from('commute_time_cache').delete().in('internship_id', internshipIds),
      ])

      const linkedDeleteError =
        requiredSkillsError ||
        preferredSkillsError ||
        courseworkItemsError ||
        courseworkCategoriesError ||
        requiredCourseCategoriesError ||
        applicationsByInternshipError ||
        commuteCacheByInternshipError

      if (linkedDeleteError) {
        return { ok: false, error: linkedDeleteError.message }
      }

      const { error: internshipsDeleteError } = await admin
        .from('internships')
        .delete()
        .eq('employer_id', userId)

      if (internshipsDeleteError) {
        return { ok: false, error: internshipsDeleteError.message }
      }
    }

    const [{ error: applicationsByStudentError }, { error: studentSkillsError }, { error: studentCourseworkItemsError }, { error: studentCourseworkCategoriesError }, { error: studentCoursesError }, { error: commuteCacheByUserError }, { error: employerClaimTokensError }, { error: subscriptionsError }, { error: stripeCustomersError }, { error: employerProfileError }, { error: studentProfileError }, { error: userRowError }] = await Promise.all([
      admin.from('applications').delete().eq('student_id', userId),
      admin.from('student_skill_items').delete().eq('student_id', userId),
      admin.from('student_coursework_items').delete().eq('student_id', userId),
      admin.from('student_coursework_category_links').delete().eq('student_id', userId),
      admin.from('student_courses').delete().eq('student_profile_id', userId),
      admin.from('commute_time_cache').delete().eq('user_id', userId),
      admin.from('employer_claim_tokens').delete().eq('employer_id', userId),
      admin.from('subscriptions').delete().eq('user_id', userId),
      admin.from('stripe_customers').delete().eq('user_id', userId),
      admin.from('employer_profiles').delete().eq('user_id', userId),
      admin.from('student_profiles').delete().eq('user_id', userId),
      admin.from('users').delete().eq('id', userId),
    ])

    const profileDeleteError =
      applicationsByStudentError ||
      studentSkillsError ||
      studentCourseworkItemsError ||
      studentCourseworkCategoriesError ||
      studentCoursesError ||
      commuteCacheByUserError ||
      employerClaimTokensError ||
      subscriptionsError ||
      stripeCustomersError ||
      employerProfileError ||
      studentProfileError ||
      userRowError

    if (profileDeleteError) {
      return { ok: false, error: profileDeleteError.message }
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return { ok: false, error: authDeleteError.message }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown delete error'
    return { ok: false, error: message }
  }
}
