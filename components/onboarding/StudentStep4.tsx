'use client'

type Props = {
  fieldClassName: string
  hoursPerWeek: string
  preferredLocation: string
  preferredWorkMode: string
  onHoursPerWeekChange: (value: string) => void
  onPreferredLocationChange: (value: string) => void
  onPreferredWorkModeChange: (value: string) => void
}

export default function StudentStep4({
  fieldClassName,
  hoursPerWeek,
  preferredLocation,
  preferredWorkMode,
  onHoursPerWeekChange,
  onPreferredLocationChange,
  onPreferredWorkModeChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-700">Hours per week</label>
        <input
          type="number"
          min={1}
          className={fieldClassName}
          value={hoursPerWeek}
          onChange={(e) => onHoursPerWeekChange(e.target.value)}
          placeholder="15"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Preferred work mode</label>
        <select className={fieldClassName} value={preferredWorkMode} onChange={(e) => onPreferredWorkModeChange(e.target.value)}>
          <option value="">No preference</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="in_person">In-person</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Location preference (optional)</label>
        <input
          className={fieldClassName}
          value={preferredLocation}
          onChange={(e) => onPreferredLocationChange(e.target.value)}
          placeholder="Salt Lake City, UT"
        />
      </div>
    </div>
  )
}
