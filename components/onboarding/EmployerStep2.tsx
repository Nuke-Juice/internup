'use client'

type Props = {
  fieldClassName: string
  companySize: string
  internshipTypes: string
  typicalDuration: string
  contactEmail: string
  foundedYear: string
  onCompanySizeChange: (value: string) => void
  onInternshipTypesChange: (value: string) => void
  onTypicalDurationChange: (value: string) => void
  onContactEmailChange: (value: string) => void
  onFoundedYearChange: (value: string) => void
}

export default function EmployerStep2({
  fieldClassName,
  companySize,
  internshipTypes,
  typicalDuration,
  contactEmail,
  foundedYear,
  onCompanySizeChange,
  onInternshipTypesChange,
  onTypicalDurationChange,
  onContactEmailChange,
  onFoundedYearChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-700">Company size</label>
        <select className={fieldClassName} value={companySize} onChange={(e) => onCompanySizeChange(e.target.value)}>
          <option value="">Select size</option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="201-1000">201-1000</option>
          <option value="1000+">1000+</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Typical internship duration</label>
        <input
          className={fieldClassName}
          value={typicalDuration}
          onChange={(e) => onTypicalDurationChange(e.target.value)}
          placeholder="e.g., 10-12 weeks"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Internship types</label>
        <input
          className={fieldClassName}
          value={internshipTypes}
          onChange={(e) => onInternshipTypesChange(e.target.value)}
          placeholder="e.g., Software, Product, Marketing"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Contact email</label>
        <input
          type="email"
          className={fieldClassName}
          value={contactEmail}
          onChange={(e) => onContactEmailChange(e.target.value)}
          placeholder="name@company.com"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Founded year (optional)</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          className={fieldClassName}
          value={foundedYear}
          onChange={(e) => onFoundedYearChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="2018"
        />
      </div>
    </div>
  )
}
