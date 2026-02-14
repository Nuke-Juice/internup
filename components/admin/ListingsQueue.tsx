import Link from 'next/link'
import ListingRowActions from './ListingRowActions'

type QueueTab = 'pending' | 'active' | 'flagged' | 'inactive'

type QueueRow = {
  id: string
  title: string | null
  companyName: string
  verificationTier: string
  locationLabel: string
  hasPay: boolean
  hasHours: boolean
  hasDeadline: boolean
  createdAt: string | null
  qualityScore: number
  flags: string[]
  isActive: boolean
}

type Props = {
  tab: QueueTab
  rows: QueueRow[]
  counts: Record<QueueTab, number>
  onApprove: (formData: FormData) => Promise<void>
  onReject: (formData: FormData) => Promise<void>
  onDeactivate: (formData: FormData) => Promise<void>
}

function badge(value: boolean, label: string) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-50 text-slate-600'
      }`}
    >
      {label}
    </span>
  )
}

export default function ListingsQueue(props: Props) {
  const tabs: Array<{ key: QueueTab; label: string }> = [
    { key: 'pending', label: 'Pending Review' },
    { key: 'active', label: 'Active' },
    { key: 'flagged', label: 'Flagged' },
    { key: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = props.tab === tab.key
          const href = `/admin/listings-queue?tab=${tab.key}`
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'
              }`}
            >
              {tab.label} ({props.counts[tab.key]})
            </Link>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Completeness</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Quality</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                  No listings in this queue.
                </td>
              </tr>
            ) : (
              props.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{row.companyName}</div>
                    <div className="text-xs text-slate-500">{row.title || 'Untitled listing'}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.verificationTier}</td>
                  <td className="px-3 py-3 text-slate-700">{row.locationLabel}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {badge(row.hasPay, 'Pay')}
                      {badge(row.hasHours, 'Hours')}
                      {badge(row.hasDeadline, 'Deadline')}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'n/a'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-semibold text-slate-800">{row.qualityScore}</div>
                    {row.flags.length > 0 ? <div className="mt-1 text-xs text-amber-700">{row.flags[0]}</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    <ListingRowActions
                      listingId={row.id}
                      isActive={row.isActive}
                      onApprove={props.onApprove}
                      onReject={props.onReject}
                      onDeactivate={props.onDeactivate}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
