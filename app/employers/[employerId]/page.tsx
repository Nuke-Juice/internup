import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import { supabaseServer } from '@/lib/supabase/server'

type Params = Promise<{ employerId: string }>

type EmployerPublicProfileRow = {
  employer_id: string
  company_name: string | null
  tagline: string | null
  about_us: string | null
  website: string | null
  industry: string | null
  founded_date: string | null
  location_city: string | null
  location_state: string | null
  avatar_url: string | null
  header_image_url: string | null
}

type EmployerProfileFallbackRow = {
  user_id: string
  company_name: string | null
  website: string | null
  industry: string | null
  founded_date: string | null
  overview: string | null
  location_city: string | null
  location_state: string | null
  avatar_url: string | null
  header_image_url: string | null
}

type EmployerInternshipRow = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  term: string | null
  work_mode: string | null
  experience_level: string | null
  target_student_year: string | null
  description: string | null
  employer_verification_tier: string | null
  created_at: string | null
}

function strongestTier(rows: EmployerInternshipRow[]) {
  if (rows.some((row) => row.employer_verification_tier === 'pro')) return 'pro'
  if (rows.some((row) => row.employer_verification_tier === 'starter')) return 'starter'
  return 'free'
}

function formatDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFoundedDate(value: string | null) {
  if (!value) return null
  const yearMatch = value.match(/^(\d{4})/)
  if (yearMatch) return yearMatch[1]
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return String(parsed.getUTCFullYear())
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

function snippet(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
}

export default async function PublicEmployerProfilePage({ params }: { params: Params }) {
  const { employerId } = await params
  const supabase = await supabaseServer()

  const [{ data }, { data: publicProfile }, { data: privateProfile }] = await Promise.all([
    supabase
      .from('internships')
      .select('id, title, company_name, location, term, work_mode, experience_level, target_student_year, description, employer_verification_tier, created_at')
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('employer_public_profiles')
      .select('employer_id, company_name, tagline, about_us, website, industry, founded_date, location_city, location_state, avatar_url, header_image_url')
      .eq('employer_id', employerId)
      .maybeSingle<EmployerPublicProfileRow>(),
    supabase
      .from('employer_profiles')
      .select('user_id, company_name, website, industry, founded_date, overview, location_city, location_state, avatar_url, header_image_url')
      .eq('user_id', employerId)
      .maybeSingle<EmployerProfileFallbackRow>(),
  ])

  const internships = (data ?? []) as EmployerInternshipRow[]
  const companyName =
    publicProfile?.company_name?.trim() ||
    privateProfile?.company_name?.trim() ||
    internships[0]?.company_name?.trim() ||
    'Employer'
  const tagline = publicProfile?.tagline?.trim() || null
  const aboutUs = publicProfile?.about_us?.trim() || privateProfile?.overview?.trim() || null
  const website = publicProfile?.website?.trim() || privateProfile?.website?.trim() || null
  const industry = publicProfile?.industry?.trim() || privateProfile?.industry?.trim() || null
  const foundedDate = formatFoundedDate(publicProfile?.founded_date ?? privateProfile?.founded_date ?? null)
  const locationCity = publicProfile?.location_city?.trim() || privateProfile?.location_city?.trim() || null
  const locationState = publicProfile?.location_state?.trim() || privateProfile?.location_state?.trim() || null
  const headerImageUrl = publicProfile?.header_image_url ?? privateProfile?.header_image_url ?? null
  const avatarUrl = publicProfile?.avatar_url ?? privateProfile?.avatar_url ?? null

  if (internships.length === 0 && !publicProfile && !privateProfile) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/#internships"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Employer not found</h1>
            <p className="mt-2 text-sm text-slate-600">This employer profile is not available right now.</p>
            <Link
              href="/#internships"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Browse internships
            </Link>
          </section>
        </div>
      </main>
    )
  }

  const tier = strongestTier(internships)

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/#internships"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="relative h-36 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {headerImageUrl ? (
              <Image src={headerImageUrl} alt={`${companyName} header`} width={1200} height={288} className="h-full w-full object-cover" unoptimized />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={`${companyName} logo`} width={56} height={56} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">Logo</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">{companyName}</h1>
                <EmployerVerificationBadge tier={tier} />
              </div>
              {tagline ? (
                <p className="mt-1 text-sm text-slate-600">{tagline}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
            {industry ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{industry}</span>
            ) : null}
            {locationCity || locationState ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                {[locationCity, locationState].filter(Boolean).join(', ')}
              </span>
            ) : null}
            {foundedDate ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Founded {foundedDate}</span> : null}
          </div>
          {aboutUs ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{aboutUs}</p>
            </div>
          ) : null}
          {website ? (
            <div className="mt-4">
              <a href={website} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-blue-700 hover:underline">
                {website}
              </a>
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Active internships</h2>
            <span className="text-xs text-slate-500">{internships.length} posting(s)</span>
          </div>

          <div className="mt-4 grid gap-3">
            {internships.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No active internships published right now.
              </div>
            ) : internships.map((listing) => (
              <article key={listing.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{listing.title || 'Internship'}</h3>
                    <p className="mt-1 text-xs text-slate-600">{listing.location || 'Location TBD'}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">{formatDate(listing.created_at) ?? 'Date n/a'}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {listing.term ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{listing.term}</span>
                  ) : null}
                  {listing.work_mode ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{listing.work_mode}</span>
                  ) : null}
                  {formatTargetYear(listing.target_student_year ?? listing.experience_level) ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{formatTargetYear(listing.target_student_year ?? listing.experience_level)}</span>
                  ) : null}
                </div>
                {snippet(listing.description) ? (
                  <p className="mt-3 text-sm text-slate-700">{snippet(listing.description)}</p>
                ) : null}
                <div className="mt-3">
                  <Link
                    href={`/jobs/${listing.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    View internship
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
