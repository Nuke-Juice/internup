import Link from 'next/link'

type Props = {
  listingId: string
  applicationId: string
}

export default function ExternalCompletionPanel({ listingId, applicationId }: Props) {
  const externalHref = `/apply/${encodeURIComponent(listingId)}/external?application=${encodeURIComponent(applicationId)}`
  return (
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-base font-semibold text-amber-900">One last step to complete your application</h2>
      <p className="mt-1 text-sm text-amber-800">
        This employer requires applications through their official system. This may take a few minutes.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Complete on employer site
        </a>
        <Link
          href="/applications"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Remind me later
        </Link>
      </div>
      <p className="mt-2 text-xs text-amber-800">We can remind you if you do not finish.</p>
    </div>
  )
}
