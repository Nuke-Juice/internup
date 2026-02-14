'use client'

import type { ListingStep2FieldKey } from './types'

type Props = {
  payType: string
  payMin: string
  payMax: string
  hoursMin: string
  hoursMax: string
  durationWeeks: string
  startDate: string
  applicationDeadline: string
  fieldErrors?: Partial<Record<ListingStep2FieldKey, string>>
  onChange: (patch: Partial<Record<string, string>>) => void
}

function LabelWithError(props: { text: string; hasError: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
      {props.text}
      {props.hasError ? <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null}
    </span>
  )
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
          <label><LabelWithError text="Pay min ($/hr)" hasError={Boolean(props.fieldErrors?.pay_min || props.fieldErrors?.pay_max)} /></label>
          <input
            name="pay_min"
            type="number"
            min={0}
            value={props.payMin}
            onChange={(event) => props.onChange({ payMin: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.pay_min || props.fieldErrors?.pay_max ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="20"
          />
        </div>
        <div>
          <label><LabelWithError text="Pay max ($/hr)" hasError={Boolean(props.fieldErrors?.pay_max || props.fieldErrors?.pay_min)} /></label>
          <input
            name="pay_max"
            type="number"
            min={0}
            value={props.payMax}
            onChange={(event) => props.onChange({ payMax: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.pay_max || props.fieldErrors?.pay_min ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="28"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label><LabelWithError text="Hours/week min" hasError={Boolean(props.fieldErrors?.hours_min || props.fieldErrors?.hours_max)} /></label>
          <input
            name="hours_min"
            type="number"
            min={1}
            max={80}
            value={props.hoursMin}
            onChange={(event) => props.onChange({ hoursMin: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.hours_min || props.fieldErrors?.hours_max ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="15"
          />
        </div>
        <div>
          <label><LabelWithError text="Hours/week max" hasError={Boolean(props.fieldErrors?.hours_max || props.fieldErrors?.hours_min)} /></label>
          <input
            name="hours_max"
            type="number"
            min={1}
            max={80}
            value={props.hoursMax}
            onChange={(event) => props.onChange({ hoursMax: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.hours_max || props.fieldErrors?.hours_min ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="25"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label><LabelWithError text="Duration (weeks)" hasError={Boolean(props.fieldErrors?.duration_weeks || props.fieldErrors?.start_date)} /></label>
          <input
            name="duration_weeks"
            type="number"
            min={1}
            max={52}
            value={props.durationWeeks}
            onChange={(event) => props.onChange({ durationWeeks: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.duration_weeks || props.fieldErrors?.start_date ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="12"
          />
        </div>
        <div>
          <label><LabelWithError text="Application deadline" hasError={Boolean(props.fieldErrors?.application_deadline)} /></label>
          <input
            name="application_deadline"
            type="date"
            value={props.applicationDeadline}
            onChange={(event) => props.onChange({ applicationDeadline: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.application_deadline ? 'border-red-300' : 'border-slate-300'
            }`}
          />
        </div>
      </div>

      <div>
        <label><LabelWithError text="Start date" hasError={Boolean(props.fieldErrors?.start_date || props.fieldErrors?.duration_weeks)} /></label>
          <input
            name="start_date"
            type="date"
            value={props.startDate}
            onChange={(event) => props.onChange({ startDate: event.target.value })}
            className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
              props.fieldErrors?.start_date || props.fieldErrors?.duration_weeks ? 'border-red-300' : 'border-slate-300'
            }`}
          />
          <p className="mt-1 text-xs text-slate-500">This can be a placeholder date.</p>
      </div>
    </div>
  )
}
