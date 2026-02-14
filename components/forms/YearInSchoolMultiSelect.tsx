'use client'

import { useMemo, useState } from 'react'
import { TARGET_STUDENT_YEAR_LABELS, TARGET_STUDENT_YEAR_OPTIONS, type TargetStudentYear } from '@/lib/internships/years'

type Props = {
  fieldName?: string
  legacyFieldName?: string
  defaultValues?: string[]
}

function normalizeYear(value: string): TargetStudentYear | null {
  const normalized = value.trim().toLowerCase()
  return TARGET_STUDENT_YEAR_OPTIONS.includes(normalized as TargetStudentYear) ? (normalized as TargetStudentYear) : null
}

export default function YearInSchoolMultiSelect({
  fieldName = 'target_student_years',
  legacyFieldName = 'target_student_year',
  defaultValues = [],
}: Props) {
  const initialSelected = useMemo(() => {
    const next = new Set<TargetStudentYear>()
    for (const value of defaultValues) {
      const normalized = normalizeYear(value)
      if (normalized) next.add(normalized)
    }
    if (next.size === 0) {
      for (const option of TARGET_STUDENT_YEAR_OPTIONS) next.add(option)
    }
    return Array.from(next)
  }, [defaultValues])
  const [selected, setSelected] = useState<TargetStudentYear[]>(initialSelected)

  const isAllSelected = selected.length === TARGET_STUDENT_YEAR_OPTIONS.length

  function toggleYear(year: TargetStudentYear) {
    setSelected((prev) => {
      const set = new Set(prev)
      if (set.has(year)) {
        set.delete(year)
      } else {
        set.add(year)
      }
      if (set.size === 0) {
        for (const option of TARGET_STUDENT_YEAR_OPTIONS) set.add(option)
      }
      return TARGET_STUDENT_YEAR_OPTIONS.filter((option) => set.has(option))
    })
  }

  function toggleAllYears() {
    setSelected([...TARGET_STUDENT_YEAR_OPTIONS])
  }

  const effectiveSelected = selected.length === 0 ? [...TARGET_STUDENT_YEAR_OPTIONS] : selected
  const legacyYearValue = effectiveSelected.length === TARGET_STUDENT_YEAR_OPTIONS.length ? 'any' : effectiveSelected[0]

  return (
    <div>
      <label className="text-sm font-medium text-slate-700">Year in school</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleAllYears}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            isAllSelected
              ? 'border-blue-300 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          All years
        </button>
        {TARGET_STUDENT_YEAR_OPTIONS.map((option) => {
          const selectedOption = effectiveSelected.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleYear(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                selectedOption
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {TARGET_STUDENT_YEAR_LABELS[option]}
            </button>
          )
        })}
      </div>
      <input type="hidden" name={fieldName} value={JSON.stringify(effectiveSelected)} />
      <input type="hidden" name={legacyFieldName} value={legacyYearValue} />
    </div>
  )
}
