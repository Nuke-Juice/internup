import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'

const readinessStyles: Record<string, string> = {
  Match: 'border-blue-200 bg-blue-50 text-blue-700',
  Stretch: 'border-slate-200 bg-slate-50 text-slate-700',
  Exploratory: 'border-slate-200 bg-white text-slate-600',
}

async function logout() {
  'use server'

  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}

function formatReadiness(value: string | null) {
  if (!value) return 'Exploratory'
  const normalized = value.toLowerCase()
  if (normalized === 'match' || normalized === 'stretch' || normalized === 'exploratory') {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
  return 'Exploratory'
}

export default async function StudentDashboardPage() {
  await requireRole('student')
  const supabase = await supabaseServer()
  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, company_name, pay, hours_per_week, start_date, deadline, readiness')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <a href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              InternUP
            </a>
          </div>

          <nav className="flex items-center gap-2">
            <a
              href="/applications"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Applications
            </a>
            <a
              href="/upgrade"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Upgrade
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

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Curated internships</h1>
            <p className="mt-1 text-slate-600">
              Readiness labels are guidance â€” not judgment.
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/signup/student"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit profile
            </a>
            <a
              href="/upgrade"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upgrade to Verified
            </a>
          </div>
        </div>

        {!internships || internships.length === 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No internships available yet.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {internships.map((l) => {
              const readiness = formatReadiness(l.readiness ?? null)
              return (
                <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{l.title}</h3>
                      <p className="text-sm text-slate-600">{l.company_name || 'Company'}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${readinessStyles[readiness]}`}
                    >
                      {readiness}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700">
                    <div><span className="text-slate-500">Pay:</span> {l.pay || 'TBD'}</div>
                    <div><span className="text-slate-500">Hours/week:</span> {l.hours_per_week || 'TBD'}</div>
                    <div><span className="text-slate-500">Start:</span> {l.start_date || 'TBD'}</div>
                    <div><span className="text-slate-500">Deadline:</span> {l.deadline || 'TBD'}</div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    {l.id ? (
                      <a
                        className="text-sm font-medium text-blue-700 hover:underline"
                        href={`/apply/${l.id}`}
                      >
                        Apply
                      </a>
                    ) : null}
                    <a className="text-sm text-slate-600 hover:underline" href="/applications">
                      Track
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
