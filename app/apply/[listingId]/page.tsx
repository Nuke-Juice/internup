import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabaseServer } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/requireRole'
import { trackAnalyticsEvent } from '@/lib/analytics'
import {
  APPLY_ERROR,
  isDuplicateApplicationConstraintError,
  type ApplyErrorCode,
} from '@/lib/applyErrors'
import { buildAccountRecoveryHref } from '@/lib/applyRecovery'
import { guardApplicationSubmit } from '@/lib/auth/verifiedActionGate'
import {
  getMinimumProfileCompleteness,
  getMinimumProfileFieldLabel,
  normalizeMissingProfileFields,
} from '@/lib/profileCompleteness'
import { buildApplicationMatchSnapshot } from '@/lib/applicationMatchSnapshot'
import { sendEmployerApplicationAlert } from '@/lib/email/employerAlerts'
import { normalizeApplyMode, normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import QuickApplyPanel from './QuickApplyPanel'
import ExternalCompletionPanel from './ExternalCompletionPanel'

function formatMajors(value: string[] | string | null) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

function formatTargetYear(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'any') return 'Any year'
  if (normalized === 'freshman') return 'Freshman'
  if (normalized === 'sophomore') return 'Sophomore'
  if (normalized === 'junior') return 'Junior'
  if (normalized === 'senior') return 'Senior'
  return value
}

function getApplyErrorDisplay(searchParams?: { code?: string; missing?: string; error?: string }) {
  const code = searchParams?.code as ApplyErrorCode | undefined

  if (code === APPLY_ERROR.ROLE_NOT_STUDENT) {
    return { message: 'This account is not a student account. Use a student account to apply.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.RESUME_REQUIRED) {
    return { message: 'Please upload a PDF resume or add one to your profile before applying.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.INVALID_RESUME_FILE) {
    return { message: 'Resume must be a PDF.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.DUPLICATE_APPLICATION) {
    return { message: 'You already applied to this internship.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.AUTH_REQUIRED) {
    return { message: 'Please sign in to apply.', missing: [] as string[] }
  }
  if (code === APPLY_ERROR.EMAIL_NOT_VERIFIED) {
    return { message: 'Verify your email before submitting applications.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.LISTING_NOT_FOUND) {
    return { message: 'Listing not found.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.APPLICATION_INSERT_FAILED) {
    return { message: 'Could not submit your application right now. Please try again.', missing: [] as string[] }
  }

  if (code === APPLY_ERROR.PROFILE_INCOMPLETE) {
    const missing = normalizeMissingProfileFields(searchParams?.missing)
    return {
      message: 'Profile is incomplete. Add the missing fields below before applying:',
      missing: missing.map((field) => getMinimumProfileFieldLabel(field)),
    }
  }

  if (searchParams?.error) {
    return { message: decodeURIComponent(searchParams.error), missing: [] as string[] }
  }

  return null
}

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>
  searchParams?: { error?: string; code?: string; missing?: string; recovery?: string; stage?: string; application?: string }
}) {
  const { listingId } = await params
  await requireRole('student', { requestedPath: `/apply/${listingId}` })
  const supabase = await supabaseServer()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const authMetadata = (authUser?.user_metadata ?? {}) as {
    resume_path?: string
    resume_file_name?: string
  }
  const savedResumePath =
    typeof authMetadata.resume_path === 'string' && authMetadata.resume_path.trim()
      ? authMetadata.resume_path.trim()
      : ''
  const savedResumeFileName =
    typeof authMetadata.resume_file_name === 'string' && authMetadata.resume_file_name.trim()
      ? authMetadata.resume_file_name.trim()
      : null

  const { data: listing } = await supabase
    .from('internships')
    .select(
      'id, title, company_name, location, experience_level, target_student_year, majors, target_graduation_years, description, work_mode, term, role_category, required_skills, preferred_skills, recommended_coursework, hours_per_week, apply_mode, external_apply_url, external_apply_type, internship_coursework_category_links(category_id, category:coursework_categories(name))'
    )
    .eq('id', listingId)
    .eq('is_active', true)
    .single()

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
            <h1 className="text-xl font-semibold text-slate-900">Listing not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This internship no longer exists or the link is incorrect.
            </p>
          </div>
        </div>
      </main>
    )
  }
  const applyMode = normalizeApplyMode(String(listing.apply_mode ?? 'native'))
  const requiresExternalCompletion = applyMode === 'ats_link' || applyMode === 'hybrid'
  const requestedCompletionApplicationId =
    searchParams?.stage === 'complete' && typeof searchParams.application === 'string' && searchParams.application.length > 0
      ? searchParams.application
      : ''
  const { data: completionApplication } =
    requestedCompletionApplicationId && authUser?.id
      ? await supabase
          .from('applications')
          .select('id')
          .eq('id', requestedCompletionApplicationId)
          .eq('student_id', authUser.id)
          .eq('internship_id', listing.id)
          .maybeSingle()
      : { data: null as { id: string } | null }
  const showCompletionStage = Boolean(requiresExternalCompletion && completionApplication?.id)

  async function submitApplication(formData: FormData) {
    'use server'

    const supabaseAction = await supabaseServer()
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser()

    if (!currentUser) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: null,
        properties: { listing_id: listingId, code: APPLY_ERROR.AUTH_REQUIRED, missing: [] },
      })
      redirect(`/apply/${listingId}?code=${APPLY_ERROR.AUTH_REQUIRED}`)
    }

    const verificationGate = guardApplicationSubmit(currentUser, listingId)
    if (!verificationGate.ok) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: verificationGate.code, missing: [] },
      })
      redirect(verificationGate.redirectTo)
    }

    const { data: currentUserRow } = await supabaseAction.from('users').select('role').eq('id', currentUser.id).maybeSingle()
    if (!currentUserRow || currentUserRow.role !== 'student') {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.ROLE_NOT_STUDENT, missing: [] },
      })
      redirect(`/apply/${listingId}?code=${APPLY_ERROR.ROLE_NOT_STUDENT}`)
    }

    const { data: listingForSubmit } = await supabaseAction
      .from('internships')
      .select(
        'id, title, company_name, location, experience_level, target_student_year, majors, target_graduation_years, description, work_mode, term, role_category, required_skills, preferred_skills, recommended_coursework, hours_per_week, apply_mode, external_apply_url, external_apply_type, internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle()

    if (!listingForSubmit) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.LISTING_NOT_FOUND, missing: [] },
      })
      redirect(`/apply/${listingId}?code=${APPLY_ERROR.LISTING_NOT_FOUND}`)
    }

    const listingIdForSubmit = listingForSubmit.id
    const applyModeForSubmit = normalizeApplyMode(String(listingForSubmit.apply_mode ?? 'native'))
    const requiresExternalCompletionForSubmit = applyModeForSubmit === 'ats_link' || applyModeForSubmit === 'hybrid'
    const externalApplyUrlForSubmit = normalizeExternalApplyUrl(String(listingForSubmit.external_apply_url ?? ''))
    if (requiresExternalCompletionForSubmit && !externalApplyUrlForSubmit) {
      redirect(`/apply/${listingId}?error=This+listing+requires+an+official+application+link+that+is+currently+missing`)
    }

    const file = formData.get('resume') as File | null
    const hasUploadedFile = Boolean(file && file.size > 0 && file.name)

    const [{ data: profile }, { data: studentCourseworkCategoryRows }] = await Promise.all([
      supabaseAction
        .from('student_profiles')
        .select('school, major_id, majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week')
        .eq('user_id', currentUser.id)
        .maybeSingle(),
      supabaseAction.from('student_coursework_category_links').select('category_id').eq('student_id', currentUser.id),
    ])

    const completeness = getMinimumProfileCompleteness(profile)
    if (!completeness.ok) {
      await trackAnalyticsEvent({
        eventName: 'apply_recovery_started',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing },
      })
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing },
      })
      redirect(
        buildAccountRecoveryHref({
          returnTo: `/apply/${listingId}`,
          code: APPLY_ERROR.PROFILE_INCOMPLETE,
        })
      )
    }

    const { data: existing } = await supabaseAction
      .from('applications')
      .select('id')
      .eq('student_id', currentUser.id)
      .eq('internship_id', listingIdForSubmit)
      .maybeSingle()

    if (existing?.id) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.DUPLICATE_APPLICATION, missing: [] },
      })
      redirect(`/apply/${listingId}?code=${APPLY_ERROR.DUPLICATE_APPLICATION}`)
    }

    let path = ''
    if (hasUploadedFile && file) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        await trackAnalyticsEvent({
          eventName: 'apply_blocked',
          userId: currentUser.id,
          properties: { listing_id: listingId, code: APPLY_ERROR.INVALID_RESUME_FILE, missing: [] },
        })
        redirect(`/apply/${listingId}?code=${APPLY_ERROR.INVALID_RESUME_FILE}`)
      }

      const resumeId = crypto.randomUUID()
      path = `resumes/${currentUser.id}/${listingIdForSubmit}/${resumeId}.pdf`
      const { error: uploadError } = await supabaseAction.storage
        .from('resumes')
        .upload(path, file, { contentType: 'application/pdf', upsert: false })

      if (uploadError) {
        await trackAnalyticsEvent({
          eventName: 'apply_blocked',
          userId: currentUser.id,
          properties: { listing_id: listingId, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, missing: [] },
        })
        redirect(`/apply/${listingId}?code=${APPLY_ERROR.APPLICATION_INSERT_FAILED}`)
      }
    } else {
      const profileResumePath =
        typeof currentUser.user_metadata?.resume_path === 'string'
          ? currentUser.user_metadata.resume_path.trim()
          : ''

      if (!profileResumePath) {
        await trackAnalyticsEvent({
          eventName: 'apply_recovery_started',
          userId: currentUser.id,
          properties: { listing_id: listingId, code: APPLY_ERROR.RESUME_REQUIRED, missing: [] },
        })
        await trackAnalyticsEvent({
          eventName: 'apply_blocked',
          userId: currentUser.id,
          properties: { listing_id: listingId, code: APPLY_ERROR.RESUME_REQUIRED, missing: [] },
        })
        redirect(
          buildAccountRecoveryHref({
            returnTo: `/apply/${listingId}`,
            code: APPLY_ERROR.RESUME_REQUIRED,
          })
        )
      }
      path = profileResumePath
    }

    const quickApplyNoteInput = String(formData.get('quick_apply_note') ?? '').trim()
    const quickApplyNote = quickApplyNoteInput.length > 280 ? quickApplyNoteInput.slice(0, 280) : quickApplyNoteInput

    const snapshot = buildApplicationMatchSnapshot({
      internship: {
        ...listingForSubmit,
        coursework_category_ids: (listingForSubmit.internship_coursework_category_links ?? [])
          .map((item) => item.category_id)
          .filter((value): value is string => typeof value === 'string'),
        coursework_category_names: (listingForSubmit.internship_coursework_category_links ?? [])
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

    const { data: insertedApplication, error: insertError } = await supabaseAction
      .from('applications')
      .insert({
        internship_id: listingIdForSubmit,
        student_id: currentUser.id,
        resume_url: path,
        status: 'submitted',
        external_apply_required: requiresExternalCompletionForSubmit,
        quick_apply_note: quickApplyNote || null,
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
          userId: currentUser.id,
          properties: { listing_id: listingId, code: APPLY_ERROR.DUPLICATE_APPLICATION, missing: [] },
        })
        redirect(`/apply/${listingId}?code=${APPLY_ERROR.DUPLICATE_APPLICATION}`)
      }
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: currentUser.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, missing: [] },
      })
      redirect(`/apply/${listingId}?code=${APPLY_ERROR.APPLICATION_INSERT_FAILED}`)
    }

    await trackAnalyticsEvent({
      eventName: 'submit_apply_success',
      userId: currentUser.id,
      properties: { listing_id: listingIdForSubmit, source: 'applyPage', apply_mode: applyModeForSubmit },
    })
    await trackAnalyticsEvent({
      eventName: 'quick_apply_submitted',
      userId: currentUser.id,
      properties: { listing_id: listingIdForSubmit, application_id: insertedApplication?.id ?? null, apply_mode: applyModeForSubmit },
    })

    if (insertedApplication?.id) {
      try {
        await sendEmployerApplicationAlert({ applicationId: insertedApplication.id })
      } catch {
        // no-op; email should not block application submission
      }
    }

    if (requiresExternalCompletionForSubmit && insertedApplication?.id) {
      redirect(`/apply/${listingId}?stage=complete&application=${encodeURIComponent(insertedApplication.id)}`)
    }
    redirect('/applications')
  }

  async function markExternalApplyCompleted(formData: FormData) {
    'use server'

    const applicationId = String(formData.get('application_id') ?? '').trim()
    if (!applicationId) {
      redirect(`/apply/${listingId}?error=Missing+application+context`)
    }
    const supabaseAction = await supabaseServer()
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser()

    if (!currentUser) redirect(`/signup/student?next=${encodeURIComponent(`/apply/${listingId}`)}`)

    const { error } = await supabaseAction
      .from('applications')
      .update({ external_apply_completed_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('student_id', currentUser.id)
      .eq('internship_id', listingId)

    if (error) {
      redirect(`/apply/${listingId}?error=${encodeURIComponent(error.message)}`)
    }

    await trackAnalyticsEvent({
      eventName: 'external_apply_completed',
      userId: currentUser.id,
      properties: { listing_id: listingId, application_id: applicationId },
    })
    redirect('/applications?external_complete=1')
  }

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

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Apply</h1>
        <p className="mt-2 text-slate-600">
          {requiresExternalCompletion
            ? 'Quick Apply takes about 10 seconds. You will then complete the official employer application in their ATS.'
            : 'Submit your resume for this internship. If you already uploaded one on your profile, you can apply without uploading again.'}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {searchParams?.recovery === '1' && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Profile updated. Continue and submit your application.
            </div>
          )}

          <div className="space-y-1">
            <div className="text-lg font-semibold text-slate-900">{listing.title}</div>
            <div className="text-sm text-slate-600">
              {listing.company_name || 'Company'} · {listing.location || 'TBD'}
            </div>
            <div className="text-xs text-slate-500">
              Year in school: {formatTargetYear((listing as { target_student_year?: string | null }).target_student_year ?? listing.experience_level) || 'TBD'}
            </div>
            {listing.majors && (
              <div className="text-xs text-slate-500">
                Majors: {formatMajors(listing.majors)}
              </div>
            )}
          </div>

          {listing.description && (
            <p className="mt-4 text-sm text-slate-600">{listing.description}</p>
          )}

          {(() => {
            const displayError = getApplyErrorDisplay(searchParams)
            if (!displayError) return null

            return (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{displayError.message}</p>
                {displayError.missing.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
                    {displayError.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })()}

          {showCompletionStage && requiresExternalCompletion ? (
            <>
              <ExternalCompletionPanel
                listingId={listing.id}
                applicationId={completionApplication?.id ?? ''}
              />
              <form action={markExternalApplyCompleted} className="mt-3">
                <input type="hidden" name="application_id" value={completionApplication?.id ?? ''} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  I finished on employer site
                </button>
              </form>
            </>
          ) : (
            <QuickApplyPanel
              listingId={listing.id}
              action={submitApplication}
              hasSavedResume={Boolean(savedResumePath)}
              savedResumeFileName={savedResumeFileName}
              showNoteField={requiresExternalCompletion}
              submitLabel={requiresExternalCompletion ? 'Submit quick apply' : 'Submit application'}
            />
          )}
        </div>
      </div>
    </main>
  )
}
