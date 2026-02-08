import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import ApplyButton from './_components/ApplyButton'
import { calculateMatchScore, parseMajors } from '@/lib/jobs/matching'

type Internship = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  experience_level: string | null
  majors: string[] | string | null
  hours_per_week: number | null
  created_at: string | null
}

const categoryTiles = [
  'Finance',
  'Accounting',
  'Data',
  'Marketing',
  'Operations',
  'Product',
  'Design',
  'Sales',
  'HR',
  'Engineering',
]

function formatMajors(value: Internship['majors']) {
  if (!value) return null
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export default async function JobsPage() {
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, company_name, location, experience_level, majors, hours_per_week, created_at')
    .order('created_at', { ascending: false })

  let sortedInternships = internships ?? []
  let isBestMatch = false

  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('majors, availability_hours_per_week')
      .eq('user_id', user.id)
      .maybeSingle()

    const profileMajors = parseMajors(profile?.majors ?? null)
    const profileAvailability = profile?.availability_hours_per_week ?? null

    if (profileMajors.length > 0 || typeof profileAvailability === 'number') {
      isBestMatch = true
      sortedInternships = [...sortedInternships]
        .map((listing) => ({
          ...listing,
          matchScore: calculateMatchScore(
            {
              majors: listing.majors,
              hoursPerWeek: listing.hours_per_week,
              createdAt: listing.created_at,
            },
            {
              majors: profileMajors,
              availabilityHoursPerWeek: profileAvailability,
            }
          ),
        }))
        .sort((a, b) => {
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              InternUP
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              href="/signup/student"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
          <p className="mt-1 text-slate-600">
            Browse and view details without logging in.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            Sort: {isBestMatch ? 'Best match' : 'Newest'}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Categories</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoryTiles.map((tile) => (
              <span
                key={tile}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
              >
                {tile}
              </span>
            ))}
          </div>
        </div>

        {!sortedInternships || sortedInternships.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No internships yet.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {sortedInternships.map((listing) => {
              const majors = formatMajors(listing.majors)
              return (
                <div
                  key={listing.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
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
                    {typeof listing.hours_per_week === 'number' && (
                      <div>
                        <span className="text-slate-500">Hours/week:</span>{' '}
                        {listing.hours_per_week}
                      </div>
                    )}
                    {majors && (
                      <div>
                        <span className="text-slate-500">Majors:</span> {majors}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <Link href={`/jobs/${listing.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                      View details
                    </Link>
                    <ApplyButton listingId={listing.id} isAuthenticated={Boolean(user)} />
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
