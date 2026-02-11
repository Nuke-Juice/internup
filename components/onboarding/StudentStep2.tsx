'use client'

import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'

type Props = {
  fieldClassName: string
  secondMajorQuery: string
  selectedSecondMajor: CanonicalMajor | null
  majorCatalog: CanonicalMajor[]
  majorsLoading: boolean
  majorError: string | null
  hasSchoolSpecificCoursework: boolean
  courseworkInput: string
  coursework: string[]
  filteredCourseworkOptions: string[]
  desiredRoles: string
  onSecondMajorQueryChange: (value: string) => void
  onSecondMajorSelect: (major: CanonicalMajor) => void
  onMajorErrorClear: () => void
  onCourseworkInputChange: (value: string) => void
  onAddCoursework: (course: string) => void
  onRemoveCoursework: (course: string) => void
  onDesiredRolesChange: (value: string) => void
}

export default function StudentStep2({
  fieldClassName,
  secondMajorQuery,
  selectedSecondMajor,
  majorCatalog,
  majorsLoading,
  majorError,
  hasSchoolSpecificCoursework,
  courseworkInput,
  coursework,
  filteredCourseworkOptions,
  desiredRoles,
  onSecondMajorQueryChange,
  onSecondMajorSelect,
  onMajorErrorClear,
  onCourseworkInputChange,
  onAddCoursework,
  onRemoveCoursework,
  onDesiredRolesChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <MajorCombobox
          inputId="student-signup-second-major"
          label="Second major (optional)"
          query={secondMajorQuery}
          onQueryChange={onSecondMajorQueryChange}
          options={majorCatalog}
          selectedMajor={selectedSecondMajor}
          onSelect={(major) => {
            onSecondMajorSelect(major)
            onMajorErrorClear()
          }}
          loading={majorsLoading}
          error={majorError}
          placeholder="Add a second major"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Skills and coursework</label>
        <p className="mt-1 text-xs text-slate-500">
          {hasSchoolSpecificCoursework
            ? 'Suggestions are tuned to your selected university.'
            : 'Suggestions are broad until a listed university is selected.'}
        </p>
        <div className="mt-2 rounded-md border border-slate-300 p-3">
          <div className="flex gap-2">
            <input
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400"
              value={courseworkInput}
              onChange={(e) => onCourseworkInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const first = filteredCourseworkOptions[0]
                  if (first) onAddCoursework(first)
                }
              }}
              placeholder="Search coursework and press Enter to add"
            />
            <button
              type="button"
              onClick={() => {
                const first = filteredCourseworkOptions[0]
                if (first) onAddCoursework(first)
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Add
            </button>
          </div>
          <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200">
            {filteredCourseworkOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No results found.</p>
            ) : (
              filteredCourseworkOptions.map((course) => (
                <button
                  key={course}
                  type="button"
                  onClick={() => onAddCoursework(course)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {course}
                </button>
              ))
            )}
          </div>
          {coursework.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {coursework.map((course) => (
                <button
                  key={course}
                  type="button"
                  onClick={() => onRemoveCoursework(course)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {course} ×
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Desired industries or roles (optional)</label>
        <textarea
          rows={3}
          className={fieldClassName}
          value={desiredRoles}
          onChange={(e) => onDesiredRolesChange(e.target.value)}
          placeholder="Examples: Product, Marketing Analytics, Software Engineering"
        />
      </div>
    </div>
  )
}
