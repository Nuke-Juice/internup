import Link from 'next/link'
import ApplyButton from './ApplyButton'

type Listing = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  role_category?: string | null
  work_mode?: string | null
  term?: string | null
  hours_min?: number | null
  hours_max?: number | null
  application_deadline?: string | null
  experience_level: string | null
  hours_per_week: number | null
  majorsText: string | null
  pay: string | null
  jobType: 'internship' | 'part-time'
}

type Props = {
  listing: Listing
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  matchSignals: string[]
}

function badgeClass(primary = false) {
  if (primary) {
    return 'rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700'
  }
  return 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700'
}

export default function JobCard({ listing, isAuthenticated, userRole = null, matchSignals }: Props) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{listing.title || 'Internship'}</h2>
          <p className="mt-1 text-sm text-slate-600">{listing.company_name || 'Company'}</p>
        </div>
        {listing.pay ? <span className={badgeClass(true)}>{listing.pay}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={badgeClass()}>{listing.location || 'Location TBD'}</span>
        {listing.work_mode ? <span className={badgeClass()}>{listing.work_mode}</span> : null}
        {listing.term ? <span className={badgeClass()}>{listing.term}</span> : null}
        <span className={badgeClass()}>{listing.jobType === 'part-time' ? 'Part-time' : 'Internship'}</span>
        {listing.experience_level ? <span className={badgeClass()}>{listing.experience_level}</span> : null}
      </div>

      {(typeof listing.hours_min === 'number' || typeof listing.hours_max === 'number') && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="text-slate-500">Hours:</span> {listing.hours_min ?? '—'}-{listing.hours_max ?? '—'} / week
        </p>
      )}
      {listing.application_deadline ? (
        <p className="mt-1 text-xs text-slate-600">
          <span className="text-slate-500">Apply by:</span> {listing.application_deadline}
        </p>
      ) : null}
      {listing.role_category ? (
        <p className="mt-1 text-xs text-slate-600">
          <span className="text-slate-500">Role category:</span> {listing.role_category}
        </p>
      ) : null}

      {listing.majorsText ? (
        <p className="mt-3 line-clamp-1 text-sm text-slate-600">
          <span className="text-slate-500">Majors:</span> {listing.majorsText}
        </p>
      ) : null}

      {isAuthenticated && matchSignals.length > 0 ? (
        <p className="mt-3 line-clamp-1 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Why this matches:</span> {matchSignals.join(' • ')}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/jobs/${listing.id}`}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          View details
        </Link>
        <ApplyButton
          listingId={listing.id}
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        />
      </div>
    </article>
  )
}
