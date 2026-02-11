import Link from 'next/link'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import ApplyButton from './ApplyButton'

type Listing = {
  id: string
  title: string | null
  company_name: string | null
  employer_id?: string | null
  employer_verification_tier?: string | null
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
  commuteMinutes?: number | null
  maxCommuteMinutes?: number | null
}

type Props = {
  listing: Listing
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  showWhyMatch?: boolean
  whyMatchReasons?: string[]
}

function badgeClass(primary = false) {
  if (primary) {
    return 'inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700'
  }
  return 'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700'
}

export default function JobCard({
  listing,
  isAuthenticated,
  userRole = null,
  showWhyMatch = false,
  whyMatchReasons = [],
}: Props) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900">{listing.title || 'Internship'}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {listing.employer_id ? (
              <Link
                href={`/employers/${encodeURIComponent(listing.employer_id)}`}
                className="text-sm font-medium text-blue-700 hover:underline"
                title="View employer profile"
              >
                {listing.company_name || 'Company'}
              </Link>
            ) : (
              <p className="text-sm font-medium text-slate-700">{listing.company_name || 'Company'}</p>
            )}
            <EmployerVerificationBadge tier={listing.employer_verification_tier ?? 'free'} />
          </div>
        </div>
        {listing.pay ? <span className={badgeClass(true)}>{listing.pay}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={badgeClass()}>{listing.location || 'Location TBD'}</span>
        {listing.work_mode ? <span className={badgeClass()}>{listing.work_mode}</span> : null}
        {listing.term ? <span className={badgeClass()}>{listing.term}</span> : null}
        {listing.experience_level ? <span className={badgeClass()}>{listing.experience_level}</span> : null}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {(typeof listing.hours_min === 'number' || typeof listing.hours_max === 'number') && (
          <p>
            <span className="font-medium text-slate-700">Hours:</span> {listing.hours_min ?? '—'}-{listing.hours_max ?? '—'} / week
          </p>
        )}
        {listing.application_deadline ? (
          <p>
            <span className="font-medium text-slate-700">Apply by:</span> {listing.application_deadline}
          </p>
        ) : null}
        {listing.role_category ? (
          <p className="sm:col-span-2">
            <span className="font-medium text-slate-700">Role category:</span> {listing.role_category}
          </p>
        ) : null}
      </div>

      {listing.majorsText ? (
        <p className="mt-3 line-clamp-1 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Majors:</span> {listing.majorsText}
        </p>
      ) : null}
      {typeof listing.commuteMinutes === 'number' ? (
        <p className={`mt-2 text-xs ${typeof listing.maxCommuteMinutes === 'number' && listing.commuteMinutes > listing.maxCommuteMinutes ? 'text-amber-700' : 'text-slate-600'}`}>
          <span className="font-medium text-slate-700">Commute:</span> ~{listing.commuteMinutes} min
          {typeof listing.maxCommuteMinutes === 'number' ? ` (${listing.maxCommuteMinutes} min target)` : ''}
        </p>
      ) : null}

      {isAuthenticated && showWhyMatch && whyMatchReasons.length > 0 ? (
        <details className="mt-3 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          <summary className="cursor-pointer list-none font-medium">Why this matches</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-left text-[11px] text-emerald-900">
            {whyMatchReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <Link
          href={`/jobs/${listing.id}`}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          View details
        </Link>
        <ApplyButton
          listingId={listing.id}
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        />
      </div>
    </article>
  )
}
