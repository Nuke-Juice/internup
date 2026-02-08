import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import {
  INTERNSHIP_VALIDATION_ERROR,
  type InternshipValidationErrorCode,
  validateInternshipInput,
} from '@/lib/internshipValidation'
import { supabaseServer } from '@/lib/supabase/server'

function normalizeList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ')
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatMajors(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return value ? String(value) : ''
}

function getCreateInternshipError(searchParams?: { code?: string; error?: string }) {
  const code = searchParams?.code as InternshipValidationErrorCode | undefined

  if (code === INTERNSHIP_VALIDATION_ERROR.WORK_MODE_REQUIRED) {
    return { message: 'Work mode is required.', field: 'work_mode' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.TERM_REQUIRED) {
    return { message: 'Term is required.', field: 'term' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.INVALID_HOURS_RANGE) {
    return { message: 'Hours range is invalid. Use values between 1 and 80 with min <= max.', field: 'hours' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.LOCATION_REQUIRED) {
    return { message: 'City and state are required for hybrid/on-site roles.', field: 'location' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.REQUIRED_SKILLS_MISSING) {
    return { message: 'Add at least one required skill.', field: 'required_skills' as const }
  }
  if (code === INTERNSHIP_VALIDATION_ERROR.DEADLINE_INVALID) {
    return { message: 'Application deadline must be today or later.', field: 'application_deadline' as const }
  }
  if (searchParams?.error) {
    return { message: decodeURIComponent(searchParams.error), field: null }
  }
  return null
}

export default async function EmployerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string; code?: string }>
}) {
  const { user } = await requireRole('employer')
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()

  const { data: employerProfile } = await supabase
    .from('employer_profiles')
    .select('company_name')
    .eq('user_id', user.id)
    .single()

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, location, experience_level, majors, created_at')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false })

  async function createInternship(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer')
    const title = String(formData.get('title') ?? '').trim()
    const locationCity = String(formData.get('location_city') ?? '').trim()
    const locationState = String(formData.get('location_state') ?? '').trim().toUpperCase()
    const workMode = String(formData.get('work_mode') ?? '').trim().toLowerCase()
    const term = String(formData.get('term') ?? '').trim()
    const hoursMin = Number(String(formData.get('hours_min') ?? '').trim())
    const hoursMax = Number(String(formData.get('hours_max') ?? '').trim())
    const requiredSkillsRaw = String(formData.get('required_skills') ?? '').trim()
    const requiredSkillIdsRaw = String(formData.get('required_skill_ids') ?? '').trim()
    const applicationDeadline = String(formData.get('application_deadline') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const experienceLevel = String(formData.get('experience_level') ?? '').trim()
    const majorsRaw = String(formData.get('majors') ?? '').trim()

    if (!title || !description || !experienceLevel) {
      redirect('/dashboard/employer?error=Missing+required+fields')
    }

    const validation = validateInternshipInput({
      work_mode: workMode,
      term,
      hours_min: Number.isFinite(hoursMin) ? hoursMin : null,
      hours_max: Number.isFinite(hoursMax) ? hoursMax : null,
      location_city: locationCity || null,
      location_state: locationState || null,
      required_skills: requiredSkillsRaw,
      required_skill_ids: requiredSkillIdsRaw,
      application_deadline: applicationDeadline || null,
    })

    if (!validation.ok) {
      redirect(`/dashboard/employer?code=${validation.code}`)
    }

    const normalizedLocation =
      workMode === 'remote'
        ? 'Remote'
        : `${locationCity.trim()}, ${locationState.trim()} (${workMode})`

    const supabaseAction = await supabaseServer()
    const { error } = await supabaseAction.from('internships').insert({
      employer_id: currentUser.id,
      title,
      location: normalizedLocation,
      location_city: locationCity || null,
      location_state: locationState || null,
      description,
      experience_level: experienceLevel,
      work_mode: workMode,
      term,
      hours_min: hoursMin,
      hours_max: hoursMax,
      hours_per_week: hoursMax,
      required_skills: parseCommaList(requiredSkillsRaw),
      application_deadline: applicationDeadline || null,
      majors: majorsRaw ? normalizeList(majorsRaw) : null,
    })

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/dashboard/employer?success=1')
  }

  const createInternshipError = getCreateInternshipError(resolvedSearchParams)

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Employer dashboard</h1>
            <p className="mt-1 text-slate-600">
              Create internships and track what you have posted.
            </p>
          </div>
          <Link
            href="/dashboard/employer/applicants"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View applicant inbox
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
          <p className="mt-1 text-sm text-slate-600">
            Share the basics so students can quickly see fit.
          </p>

          {createInternshipError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {createInternshipError.message}
            </div>
          )}
          {resolvedSearchParams?.success && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Internship created.
            </div>
          )}

          <form action={createInternship} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                name="title"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Finance Intern"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Company name</label>
              <input
                name="company_name"
                defaultValue={employerProfile?.company_name ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Canyon Capital"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Experience level</label>
              <select
                name="experience_level"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select level
                </option>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Work mode</label>
              <select
                name="work_mode"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                defaultValue=""
              >
                <option value="" disabled>
                  Select mode
                </option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-site</option>
              </select>
              {createInternshipError?.field === 'work_mode' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Term</label>
              <input
                name="term"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Summer 2026"
              />
              {createInternshipError?.field === 'term' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">City</label>
              <input
                name="location_city"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Salt Lake City"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">State</label>
              <input
                name="location_state"
                maxLength={2}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., UT"
              />
              {createInternshipError?.field === 'location' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Hours min/week</label>
              <input
                name="hours_min"
                required
                type="number"
                min={1}
                max={80}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="10"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Hours max/week</label>
              <input
                name="hours_max"
                required
                type="number"
                min={1}
                max={80}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="20"
              />
              {createInternshipError?.field === 'hours' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Majors</label>
              <input
                name="majors"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="Finance, Accounting, Economics"
              />
              <p className="mt-1 text-xs text-slate-500">Comma-separated list is fine for MVP.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Required skills</label>
              <input
                name="required_skills"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Excel, financial modeling"
              />
              {createInternshipError?.field === 'required_skills' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Application deadline (optional)</label>
              <input
                name="application_deadline"
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
              />
              {createInternshipError?.field === 'application_deadline' && (
                <p className="mt-1 text-xs text-red-600">{createInternshipError.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                name="description"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                rows={5}
                placeholder="Describe responsibilities and what a great candidate looks like."
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create internship
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Your internships</h2>
            <span className="text-xs text-slate-500">{internships?.length ?? 0} total</span>
          </div>

          {!internships || internships.length === 0 ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              You have not created any internships yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {internships.map((internship) => (
                <div key={internship.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{internship.title}</div>
                      <div className="text-xs text-slate-500">
                        {internship.location}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {internship.experience_level ? `Level: ${internship.experience_level}` : 'Level: n/a'}
                    </div>
                  </div>
                  {internship.majors && (
                    <div className="mt-2 text-xs text-slate-500">
                      Majors: {formatMajors(internship.majors)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
