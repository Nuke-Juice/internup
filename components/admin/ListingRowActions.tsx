import Link from 'next/link'

type Props = {
  listingId: string
  isActive: boolean
  onApprove: (formData: FormData) => Promise<void>
  onReject: (formData: FormData) => Promise<void>
  onDeactivate: (formData: FormData) => Promise<void>
}

export default function ListingRowActions(props: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={props.onApprove}>
        <input type="hidden" name="internship_id" value={props.listingId} />
        <button type="submit" className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          Approve
        </button>
      </form>
      <form action={props.onReject}>
        <input type="hidden" name="internship_id" value={props.listingId} />
        <button type="submit" className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
          Reject
        </button>
      </form>
      <Link
        href={`/admin/internships/${props.listingId}`}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
      >
        Edit
      </Link>
      {props.isActive ? (
        <form action={props.onDeactivate}>
          <input type="hidden" name="internship_id" value={props.listingId} />
          <button type="submit" className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">
            Deactivate
          </button>
        </form>
      ) : null}
      <Link
        href={`/jobs/${props.listingId}`}
        className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
      >
        View public
      </Link>
    </div>
  )
}
