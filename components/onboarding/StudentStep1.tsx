'use client'

import { ChevronDown } from 'lucide-react'
import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'

type Props = {
  fieldClassName: string
  firstName: string
  lastName: string
  school: string
  schoolQuery: string
  schoolOpen: boolean
  year: string
  yearOpen: boolean
  selectedMajor: CanonicalMajor | null
  majorQuery: string
  majorCatalog: CanonicalMajor[]
  majorsLoading: boolean
  majorError: string | null
  schoolOptions: string[]
  yearOptions: string[]
  filteredSchoolOptions: string[]
  showSchoolDropdown: boolean
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onSchoolQueryChange: (value: string) => void
  onSchoolSelect: (value: string) => void
  onSchoolOpenChange: (open: boolean) => void
  onYearSelect: (value: string) => void
  onYearOpenChange: (open: boolean) => void
  onMajorQueryChange: (value: string) => void
  onMajorSelect: (major: CanonicalMajor) => void
  onMajorErrorClear: () => void
}

export default function StudentStep1({
  fieldClassName,
  firstName,
  lastName,
  school,
  schoolQuery,
  schoolOpen,
  year,
  yearOpen,
  selectedMajor,
  majorQuery,
  majorCatalog,
  majorsLoading,
  majorError,
  filteredSchoolOptions,
  showSchoolDropdown,
  yearOptions,
  onFirstNameChange,
  onLastNameChange,
  onSchoolQueryChange,
  onSchoolSelect,
  onSchoolOpenChange,
  onYearSelect,
  onYearOpenChange,
  onMajorQueryChange,
  onMajorSelect,
  onMajorErrorClear,
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

      <div>
        <label className="text-sm font-medium text-slate-700">School</label>
        <div className="relative">
          <input
            className={fieldClassName}
            value={schoolQuery}
            onFocus={() => onSchoolOpenChange(true)}
            onBlur={() => {
              setTimeout(() => onSchoolOpenChange(false), 120)
            }}
            onChange={(event) => {
              onSchoolQueryChange(event.target.value)
              onSchoolOpenChange(true)
            }}
            placeholder="Type to search school"
          />
          {showSchoolDropdown ? (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {filteredSchoolOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-600">No results found.</div>
              ) : (
                filteredSchoolOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={() => {
                      onSchoolSelect(option)
                      onSchoolOpenChange(false)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {!school && schoolQuery.trim().length > 0 ? (
          <p className="mt-1 text-xs text-amber-700">Choose a school from the dropdown list.</p>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Graduation year</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => onYearOpenChange(!yearOpen)}
            onBlur={() => setTimeout(() => onYearOpenChange(false), 120)}
            className={`${fieldClassName} flex items-center justify-between text-left`}
          >
            <span className={year ? 'text-slate-900' : 'text-slate-400'}>{year || 'Select your year'}</span>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
          {yearOpen ? (
            <div className="absolute z-20 mt-1 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {yearOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={() => {
                    onYearSelect(option)
                    onYearOpenChange(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sm:col-span-2">
        <MajorCombobox
          inputId="student-signup-major"
          label="Major (primary)"
          query={majorQuery}
          onQueryChange={onMajorQueryChange}
          options={majorCatalog}
          selectedMajor={selectedMajor}
          onSelect={(major) => {
            onMajorSelect(major)
            onMajorErrorClear()
          }}
          loading={majorsLoading}
          error={majorError}
          placeholder="Start typing your major"
        />
        {!selectedMajor && majorQuery.trim().length > 0 ? (
          <p className="mt-1 text-xs text-amber-700">Select a verified major from the dropdown.</p>
        ) : null}
      </div>
    </div>
  )
}
