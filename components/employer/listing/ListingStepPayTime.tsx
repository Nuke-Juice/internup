'use client'

type Props = {
  payType: string
  payMin: string
  payMax: string
  hoursMin: string
  hoursMax: string
  durationWeeks: string
  startDate: string
  applicationDeadline: string
  onChange: (patch: Partial<Record<string, string>>) => void
}

export default function ListingStepPayTime(props: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Pay type</label>
        <select
          name="pay_type"
          value={props.payType}
          onChange={(event) => props.onChange({ payType: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        >
          <option value="hourly">Hourly</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Pay min ($/hr)</label>
          <input
            name="pay_min"
            type="number"
            min={0}
            value={props.payMin}
            onChange={(event) => props.onChange({ payMin: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="20"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Pay max ($/hr)</label>
          <input
            name="pay_max"
            type="number"
            min={0}
            value={props.payMax}
            onChange={(event) => props.onChange({ payMax: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="28"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Hours/week min</label>
          <input
            name="hours_min"
            type="number"
            min={1}
            max={80}
            value={props.hoursMin}
            onChange={(event) => props.onChange({ hoursMin: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="15"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Hours/week max</label>
          <input
            name="hours_max"
            type="number"
            min={1}
            max={80}
            value={props.hoursMax}
            onChange={(event) => props.onChange({ hoursMax: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="25"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Duration (weeks)</label>
          <input
            name="duration_weeks"
            type="number"
            min={1}
            max={52}
            value={props.durationWeeks}
            onChange={(event) => props.onChange({ durationWeeks: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="12"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Start date (optional)</label>
          <input
            name="start_date"
            type="date"
            value={props.startDate}
            onChange={(event) => props.onChange({ startDate: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Application deadline (optional)</label>
        <input
          name="application_deadline"
          type="date"
          value={props.applicationDeadline}
          onChange={(event) => props.onChange({ applicationDeadline: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        />
      </div>
    </div>
  )
}
