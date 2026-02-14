'use client'

import { useMemo } from 'react'
import CatalogMultiSelect from '@/components/forms/CatalogMultiSelect'
import { normalizeCatalogToken } from '@/lib/catalog/normalization'
import type { CatalogOption } from './types'

type Props = {
  skillCatalog: CatalogOption[]
  majorCatalog: CatalogOption[]
  courseworkCategoryCatalog: CatalogOption[]
  requiredSkillLabels: string[]
  preferredSkillLabels: string[]
  majorLabels: string[]
  courseworkCategoryLabels: string[]
  resumeRequired: boolean
  onResumeRequiredChange: (value: boolean) => void
}

const CURATED_COURSEWORK_LABELS = [
  'Financial Accounting',
  'Managerial Accounting',
  'Business Statistics',
  'Corporate Finance',
  'Operations Management',
  'Business Law',
  'Statistics',
  'Regression',
  'SQL',
  'Data Visualization',
  'Machine Learning',
  'Python',
  'R',
  'Data Structures',
  'Algorithms',
  'Database Systems',
  'Systems Programming',
  'Software Engineering',
  'Digital Marketing',
  'SEO/SEM',
  'Marketing Analytics',
  'Consumer Behavior',
  'Supply Chain',
  'Logistics',
  'Lean/Six Sigma',
]

export default function ListingStepRequirements(props: Props) {
  const courseworkOptions = useMemo(() => {
    const existing = new Set(props.courseworkCategoryCatalog.map((item) => normalizeCatalogToken(item.name)))
    const suggested = CURATED_COURSEWORK_LABELS.filter((label) => !existing.has(normalizeCatalogToken(label))).map((label) => ({
      id: `custom:${normalizeCatalogToken(label)}`,
      name: label,
    }))
    return [...props.courseworkCategoryCatalog, ...suggested]
  }, [props.courseworkCategoryCatalog])

  return (
    <div className="space-y-4">
      <CatalogMultiSelect
        key={`required-skills:${props.requiredSkillLabels.join('|')}`}
        label="Required skills"
        fieldName="required_skills"
        idsFieldName="required_skill_ids"
        customFieldName="required_skill_custom"
        inputId="employer-required-skills-input"
        options={props.skillCatalog}
        initialLabels={props.requiredSkillLabels}
        allowCustom={false}
      />

      <CatalogMultiSelect
        key={`preferred-skills:${props.preferredSkillLabels.join('|')}`}
        label="Preferred skills"
        fieldName="preferred_skills"
        idsFieldName="preferred_skill_ids"
        customFieldName="preferred_skill_custom"
        inputId="employer-preferred-skills-input"
        options={props.skillCatalog}
        initialLabels={props.preferredSkillLabels}
        allowCustom={false}
      />

      <p className="-mt-1 text-xs text-slate-500">Used to improve matching + ranking for students.</p>

      <CatalogMultiSelect
        key={`majors:${props.majorLabels.join('|')}`}
        label="Target majors"
        fieldName="majors"
        idsFieldName="major_ids"
        customFieldName="major_custom"
        inputId="employer-major-input"
        options={props.majorCatalog}
        initialLabels={props.majorLabels}
        allowCustom={false}
      />

      <CatalogMultiSelect
        key={`course-categories:${props.courseworkCategoryLabels.join('|')}`}
        label="Coursework categories (optional)"
        fieldName="required_course_categories"
        idsFieldName="required_course_category_ids"
        customFieldName="required_course_category_custom"
        inputId="employer-course-categories-input"
        options={courseworkOptions}
        initialLabels={props.courseworkCategoryLabels}
        allowCustom
      />

      <div>
        <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.resumeRequired}
            onChange={(event) => props.onResumeRequiredChange(event.target.checked)}
          />
          Resume required
        </label>
        <input type="hidden" name="resume_required" value={props.resumeRequired ? '1' : '0'} />
      </div>
    </div>
  )
}
