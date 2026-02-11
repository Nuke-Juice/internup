'use client'

import { US_STATE_OPTIONS } from '@/lib/locations/usLocationCatalog'

type Props = {
  fieldClassName: string
  address: string
  locationCity: string
  locationStateInput: string
  description: string
  logoFile: File | null
  existingLogoUrl: string
  onAddressChange: (value: string) => void
  onLocationCityChange: (value: string) => void
  onLocationStateInputChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onLogoChange: (file: File | null) => void
}

export default function EmployerStep3({
  fieldClassName,
  address,
  locationCity,
  locationStateInput,
  description,
  logoFile,
  existingLogoUrl,
  onAddressChange,
  onLocationCityChange,
  onLocationStateInputChange,
  onDescriptionChange,
  onLogoChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Address</label>
        <input className={fieldClassName} value={address} onChange={(e) => onAddressChange(e.target.value)} placeholder="123 Main St" />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">City</label>
        <input
          className={fieldClassName}
          value={locationCity}
          onChange={(e) => onLocationCityChange(e.target.value)}
          placeholder="e.g., Salt Lake City"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">State</label>
        <input
          className={fieldClassName}
          value={locationStateInput}
          onChange={(e) => onLocationStateInputChange(e.target.value)}
          placeholder="UT or Utah"
          list="employer-step-state-options"
        />
        <datalist id="employer-step-state-options">
          {US_STATE_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </datalist>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Company description</label>
        <textarea
          rows={4}
          className={fieldClassName}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe your team, mission, and internship environment."
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Logo upload (optional)</label>
        <input type="file" accept="image/*" className={fieldClassName} onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)} />
        <p className="mt-1 text-xs text-slate-500">
          {logoFile ? `${logoFile.name} selected.` : existingLogoUrl ? 'Current company logo on file.' : 'No logo uploaded yet.'}
        </p>
      </div>
    </div>
  )
}
