'use client'

import type { ApplyMode, WorkMode } from './types'

type Props = {
  title: string
  category: string
  workMode: WorkMode
  locationCity: string
  locationState: string
  applyMode: ApplyMode
  externalApplyUrl: string
  externalApplyType: string
  categories: string[]
  onChange: (patch: Partial<Record<string, string>>) => void
}

export default function ListingStepBasics(props: Props) {
  const titleLength = props.title.trim().length

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Title</label>
        <input
          name="title"
          value={props.title}
          onChange={(event) => props.onChange({ title: event.target.value })}
          required
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="e.g., Finance Intern"
        />
        <p className="mt-1 text-xs text-slate-500">Keep it under 60 characters for better scanability ({titleLength}/60).</p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Role category</label>
        <select
          name="category"
          value={props.category}
          onChange={(event) => props.onChange({ category: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          required
        >
          <option value="">Select category</option>
          {props.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Location type</label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {[
            { value: 'remote', label: 'Remote' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'on-site', label: 'In-person' },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <input
                type="radio"
                name="work_mode"
                value={option.value}
                checked={props.workMode === option.value}
                onChange={(event) => props.onChange({ workMode: event.target.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {props.workMode !== 'remote' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">City</label>
            <input
              name="location_city"
              value={props.locationCity}
              onChange={(event) => props.onChange({ locationCity: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              placeholder="Salt Lake City"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">State</label>
            <input
              name="location_state"
              value={props.locationState}
              onChange={(event) => props.onChange({ locationState: event.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              placeholder="UT"
              maxLength={2}
            />
          </div>
        </div>
      ) : null}

      <div>
        <label className="text-sm font-medium text-slate-700">Apply method</label>
        <select
          name="apply_mode"
          value={props.applyMode}
          onChange={(event) => props.onChange({ applyMode: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        >
          <option value="native">Native (apply on Internactive)</option>
          <option value="ats_link">ATS Link (apply on employer ATS)</option>
          <option value="hybrid">Hybrid (Quick Apply + ATS completion)</option>
        </select>
      </div>

      {props.applyMode === 'ats_link' || props.applyMode === 'hybrid' ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="text-sm font-medium text-slate-700">External apply URL</label>
            <input
              name="external_apply_url"
              type="url"
              value={props.externalApplyUrl}
              onChange={(event) => props.onChange({ externalApplyUrl: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              placeholder="https://jobs.company.com/..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">ATS type (optional)</label>
            <select
              name="external_apply_type"
              value={props.externalApplyType}
              onChange={(event) => props.onChange({ externalApplyType: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            >
              <option value="">Auto-detect</option>
              <option value="workday">Workday</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="icims">iCIMS</option>
              <option value="other">Other</option>
            </select>
          </div>
          <p className="text-xs text-slate-600">Students Quick Apply first, then complete official ATS step.</p>
        </div>
      ) : null}
    </div>
  )
}
