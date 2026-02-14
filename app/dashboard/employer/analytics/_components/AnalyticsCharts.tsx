'use client'

type Point = { label: string; value: number }
type RankedListing = { internshipId: string; title: string; value: number }

type Props = {
  viewsSeries: Point[]
  applicationsSeries: Point[]
  conversionSeries: Point[]
  topByViews: RankedListing[]
  topByApplications: RankedListing[]
}

function toLinePath(data: Point[], width: number, height: number) {
  if (data.length === 0) return ''
  const max = Math.max(...data.map((point) => point.value), 1)
  return data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width
      const y = height - (point.value / max) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function LineChart({ title, data, stroke }: { title: string; data: Point[]; stroke: string }) {
  const width = 560
  const height = 180
  const path = toLinePath(data, width, height)
  const max = Math.max(...data.map((point) => point.value), 1)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No data yet.</p>
      ) : (
        <div className="mt-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label={title}>
            <line x1="0" y1={height} x2={width} y2={height} stroke="#e2e8f0" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2={height} stroke="#e2e8f0" strokeWidth="1" />
            <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
            {data.map((point, index) => {
              const x = (index / Math.max(data.length - 1, 1)) * width
              const y = height - (point.value / max) * height
              return <circle key={`${point.label}:${index}`} cx={x} cy={y} r="3" fill={stroke} />
            })}
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>{data[0]?.label ?? ''}</span>
            <span>{data[data.length - 1]?.label ?? ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Bars({ title, rows }: { title: string; rows: RankedListing[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No data yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.internshipId}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-700">{row.title || 'Untitled listing'}</span>
                <span className="font-medium text-slate-900">{row.value}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${Math.max((row.value / max) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AnalyticsCharts({
  viewsSeries,
  applicationsSeries,
  conversionSeries,
  topByViews,
  topByApplications,
}: Props) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart title="Listing views over time" data={viewsSeries} stroke="#2563eb" />
        <LineChart title="Applications over time" data={applicationsSeries} stroke="#0f766e" />
      </div>
      <LineChart title="View to application conversion (%)" data={conversionSeries} stroke="#9333ea" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Top listings by views" rows={topByViews} />
        <Bars title="Top listings by applications" rows={topByApplications} />
      </div>
    </div>
  )
}
