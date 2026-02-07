import { supabaseServer } from '@/lib/supabase/server'

type Internship = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  experience_level: string | null
  majors: string[] | string | null
}

function formatMajors(value: Internship['majors']) {
  if (!value) return null
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export default async function InternshipsPage() {
  const supabase = await supabaseServer()
  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, company_name, location, experience_level, majors')
    .order('created_at', { ascending: false })

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
              href="/login"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </a>
            <a
              href="/signup/student"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create account
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Internships</h1>
          <p className="mt-1 text-slate-600">
            Browse current listings. No account required.
          </p>
        </div>

        {!internships || internships.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No internships yet.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {internships.map((listing) => {
              const majors = formatMajors(listing.majors)
              return (
                <a
                  key={listing.id}
                  href={`/apply/${listing.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {listing.title || 'Internship'}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {listing.company_name || 'Company'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-slate-700">
                    <div>
                      <span className="text-slate-500">Location:</span>{' '}
                      {listing.location || 'TBD'}
                    </div>
                    <div>
                      <span className="text-slate-500">Experience:</span>{' '}
                      {listing.experience_level || 'TBD'}
                    </div>
                    {majors && (
                      <div>
                        <span className="text-slate-500">Majors:</span> {majors}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 text-sm font-medium text-blue-700">
                    View & apply
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
