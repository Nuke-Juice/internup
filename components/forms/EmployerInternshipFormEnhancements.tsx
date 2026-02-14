'use client'

import { useEffect, useMemo, useState } from 'react'

type Props = {
  formId: string
  userId: string
  draftKey: string
  clearOnSuccess?: boolean
}

type ValidationIssue = {
  field: string
  message: string
}

const REQUIRED_PUBLISH_FIELDS: Array<{ name: string; label: string }> = [
  { name: 'title', label: 'Title' },
  { name: 'category', label: 'Category' },
  { name: 'work_mode', label: 'Work mode' },
  { name: 'start_month', label: 'Start month' },
  { name: 'start_year', label: 'Start year' },
  { name: 'end_month', label: 'End month' },
  { name: 'end_year', label: 'End year' },
  { name: 'hours_min', label: 'Hours min/week' },
  { name: 'hours_max', label: 'Hours max/week' },
  { name: 'pay_min', label: 'Pay min ($/hr)' },
  { name: 'pay_max', label: 'Pay max ($/hr)' },
  { name: 'short_summary', label: 'Short summary' },
  { name: 'description', label: 'Description' },
]

function isBlank(value: FormDataEntryValue | null) {
  return String(value ?? '').trim().length === 0
}

function parseInteger(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim())
  return Number.isInteger(parsed) ? parsed : null
}

function toStorageKey(userId: string, draftKey: string) {
  return `employer_create_internship:${userId}:${draftKey}`
}

export default function EmployerInternshipFormEnhancements({
  formId,
  userId,
  draftKey,
  clearOnSuccess = false,
}: Props) {
  const storageKey = useMemo(() => toStorageKey(userId, draftKey), [draftKey, userId])
  const [issues, setIssues] = useState<ValidationIssue[]>([])

  useEffect(() => {
    if (!clearOnSuccess) return
    window.localStorage.removeItem(storageKey)
  }, [clearOnSuccess, storageKey])

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return

    const raw = window.localStorage.getItem(storageKey)
    if (raw) {
      try {
        const persisted = JSON.parse(raw) as Record<string, string | string[]>
        const entries = Object.entries(persisted)
        for (const [name, value] of entries) {
          const elements = form.querySelectorAll(`[name="${CSS.escape(name)}"]`)
          if (elements.length === 0) continue
          const values = Array.isArray(value) ? value : [value]
          elements.forEach((node) => {
            if (node instanceof HTMLInputElement) {
              if (node.type === 'radio') {
                node.checked = values.includes(node.value)
              } else if (node.type === 'checkbox') {
                node.checked = values.includes('1') || values.includes(node.value)
              } else {
                node.value = values[0] ?? ''
              }
              return
            }
            if (node instanceof HTMLSelectElement && node.multiple) {
              const selectedSet = new Set(values)
              for (const option of Array.from(node.options)) {
                option.selected = selectedSet.has(option.value)
              }
              return
            }
            if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
              node.value = values[0] ?? ''
            }
          })
        }
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }

    const save = () => {
      const formData = new FormData(form)
      const next: Record<string, string | string[]> = {}
      for (const [name, value] of formData.entries()) {
        if (name === 'internship_id') continue
        const safe = typeof value === 'string' ? value : ''
        const existing = next[name]
        if (existing === undefined) {
          next[name] = safe
        } else if (Array.isArray(existing)) {
          next[name] = [...existing, safe]
        } else {
          next[name] = [existing, safe]
        }
      }
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    }

    const validateForPublish = (formData: FormData) => {
      const nextIssues: ValidationIssue[] = []
      for (const field of REQUIRED_PUBLISH_FIELDS) {
        if (isBlank(formData.get(field.name))) {
          nextIssues.push({ field: field.name, message: `${field.label} is required.` })
        }
      }

      const workMode = String(formData.get('work_mode') ?? '').trim()
      if ((workMode === 'on-site' || workMode === 'hybrid') && (isBlank(formData.get('location_state')) || isBlank(formData.get('location_city')))) {
        nextIssues.push({ field: 'location_city', message: 'City and state are required for hybrid/on-site roles.' })
      }

      if (workMode === 'remote' || workMode === 'hybrid') {
        const region = String(formData.get('remote_eligible_region') ?? '').trim()
        const remoteState = String(formData.get('remote_eligible_state') ?? '').trim()
        if (!region) {
          nextIssues.push({ field: 'remote_eligible_region', message: 'Eligible location is required for remote/hybrid roles.' })
        } else if (region === 'state' && !remoteState) {
          nextIssues.push({ field: 'remote_eligible_state', message: 'Choose one eligible state for remote/hybrid roles.' })
        }
      }

      if (isBlank(formData.get('required_skill_ids'))) {
        nextIssues.push({ field: 'required_skill_ids', message: 'Select at least one canonical skill.' })
      }
      if (isBlank(formData.get('required_course_category_ids'))) {
        nextIssues.push({ field: 'required_course_category_ids', message: 'Select at least one required coursework category.' })
      }
      if (isBlank(formData.get('target_student_years'))) {
        nextIssues.push({ field: 'target_student_year', message: 'Year in school is required.' })
      }
      if (isBlank(formData.get('major_ids'))) {
        nextIssues.push({ field: 'majors', message: 'Select at least one major.' })
      }
      if (isBlank(formData.get('desired_coursework_strength'))) {
        nextIssues.push({ field: 'desired_coursework_strength', message: 'Coursework strength is required.' })
      }

      const hoursMin = parseInteger(formData.get('hours_min'))
      const hoursMax = parseInteger(formData.get('hours_max'))
      if (hoursMin === null || hoursMax === null || hoursMin < 1 || hoursMax < hoursMin) {
        nextIssues.push({ field: 'hours_min', message: 'Hours range must be valid (min <= max).' })
      }
      const payMin = parseInteger(formData.get('pay_min'))
      const payMax = parseInteger(formData.get('pay_max'))
      if (payMin === null || payMax === null || payMin < 0 || payMax < payMin) {
        nextIssues.push({ field: 'pay_min', message: 'Pay range must be valid (min >= 0 and max >= min).' })
      }
      return nextIssues
    }

    const onInput = () => save()
    const onChange = () => {
      save()
      syncWorkModeSections()
    }
    const onPageHide = () => save()
    const syncWorkModeSections = () => {
      const mode = String(new FormData(form).get('work_mode') ?? '').trim()
      const remoteSection = form.querySelector<HTMLElement>('[data-remote-eligibility-section="1"]')
      if (remoteSection) {
        remoteSection.style.display = mode === 'on-site' ? 'none' : ''
      }
    }
    const onSubmit = (event: SubmitEvent) => {
      const submitter = event.submitter as HTMLButtonElement | null
      const isPublish = submitter?.name === 'create_mode' && submitter?.value === 'publish'
      if (!isPublish) {
        setIssues([])
        save()
        return
      }
      const formData = new FormData(form)
      const nextIssues = validateForPublish(formData)
      if (nextIssues.length > 0) {
        event.preventDefault()
        setIssues(nextIssues)
        return
      }
      setIssues([])
      save()
    }

    form.addEventListener('input', onInput)
    form.addEventListener('change', onChange)
    form.addEventListener('submit', onSubmit)
    window.addEventListener('pagehide', onPageHide)
    syncWorkModeSections()
    return () => {
      form.removeEventListener('input', onInput)
      form.removeEventListener('change', onChange)
      form.removeEventListener('submit', onSubmit)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [formId, storageKey])

  if (issues.length === 0) return null

  return (
    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="font-semibold">Please fix the following before publishing:</p>
      <ul className="mt-1 list-disc pl-5">
        {issues.map((issue) => (
          <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  )
}
