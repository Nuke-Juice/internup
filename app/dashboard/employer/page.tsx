import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'

function normalizeList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ')
}

function formatMajors(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return value ? String(value) : ''
}

async function logout() {
  'use server'

  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function EmployerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>
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
    const companyName = String(formData.get('company_name') ?? '').trim()
    const location = String(formData.get('location') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const experienceLevel = String(formData.get('experience_level') ?? '').trim()
    const majorsRaw = String(formData.get('majors') ?? '').trim()

    if (!title || !location || !description || !experienceLevel) {
      redirect('/dashboard/employer?error=Missing+required+fields')
    }

    const supabaseAction = await supabaseServer()
    const { error } = await supabaseAction.from('internships').insert({
      employer_id: currentUser.id,
      title,
      location,
      description,
      experience_level: experienceLevel,
      majors: majorsRaw ? normalizeList(majorsRaw) : null,
    })

    if (error) {
      redirect(`/dashboard/employer?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/dashboard/employer?success=1')
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <a href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              InternUP
            </a>
          </div>

          <nav className="flex items-center gap-2">
            <a
              href="/internships"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View public listings
            </a>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Employer dashboard</h1>
            <p className="mt-1 text-slate-600">
              Create internships and track what you have posted.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
          <p className="mt-1 text-sm text-slate-600">
            Share the basics so students can quickly see fit.
          </p>

          {resolvedSearchParams?.error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(resolvedSearchParams.error)}
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
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input
                name="location"
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                placeholder="e.g., Salt Lake City, UT"
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
