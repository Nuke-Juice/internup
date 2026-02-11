'use client'

type Props = {
  fieldClassName: string
  firstName: string
  lastName: string
  companyName: string
  industry: string
  website: string
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onCompanyNameChange: (value: string) => void
  onIndustryChange: (value: string) => void
  onWebsiteChange: (value: string) => void
}

export default function EmployerStep1({
  fieldClassName,
  firstName,
  lastName,
  companyName,
  industry,
  website,
  onFirstNameChange,
  onLastNameChange,
  onCompanyNameChange,
  onIndustryChange,
  onWebsiteChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-700">First name</label>
        <input className={fieldClassName} value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="Jane" />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Last name</label>
        <input className={fieldClassName} value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder="Doe" />
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Company name</label>
        <input
          className={fieldClassName}
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
          placeholder="e.g., Canyon Capital"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Industry</label>
        <input className={fieldClassName} value={industry} onChange={(e) => onIndustryChange(e.target.value)} placeholder="e.g., Finance" />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Website</label>
        <input
          className={fieldClassName}
          value={website}
          onChange={(e) => onWebsiteChange(e.target.value)}
          placeholder="https://example.com"
        />
      </div>
    </div>
  )
}
