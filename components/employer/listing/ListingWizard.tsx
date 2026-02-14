'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ListingProgressBar from './ListingProgressBar'
import ListingPreviewPanel from './ListingPreviewPanel'
import ListingStepBasics from './ListingStepBasics'
import ListingStepPayTime from './ListingStepPayTime'
import ListingStepRequirements from './ListingStepRequirements'
import ListingStepDescription from './ListingStepDescription'
import {
  isRecentDraft,
  listingDraftStorageKey,
  listingLastDraftPointerKey,
  parseListingLastDraftPointer,
} from '@/lib/internships/draftStorage'
import type {
  ApplyMode,
  CatalogOption,
  ListingStep1FieldKey,
  ListingStep2FieldKey,
  ListingStep4FieldKey,
  ListingTemplate,
  ListingWizardInitialValues,
  WorkMode,
} from './types'

const TOTAL_STEPS = 4
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const EMPLOYER_LISTING_TEMPLATES: ListingTemplate[] = [
  {
    key: 'accounting',
    label: 'Accounting Intern',
    title: 'Accounting Intern',
    category: 'Accounting',
    requiredSkills: ['Excel', 'Attention to detail'],
    preferredSkills: ['GAAP basics'],
    majors: ['Accounting', 'Finance'],
    courseworkCategories: ['Financial Accounting', 'Managerial Accounting'],
    responsibilities: ['Support AP/AR reconciliations', 'Prepare close schedules'],
    qualifications: ['Pursuing Accounting, Finance, or related degree'],
  },
  {
    key: 'finance',
    label: 'Finance Intern',
    title: 'Finance Intern',
    category: 'Finance',
    requiredSkills: ['Excel', 'Financial modeling'],
    preferredSkills: ['PowerPoint'],
    majors: ['Finance', 'Economics', 'Accounting'],
    courseworkCategories: ['Corporate Finance', 'Business Statistics'],
    responsibilities: ['Build weekly KPI reports', 'Support forecast and variance analysis'],
    qualifications: ['Strong quantitative communication skills'],
  },
  {
    key: 'business-analyst',
    label: 'Business Analyst Intern',
    title: 'Business Analyst Intern',
    category: 'Operations',
    requiredSkills: ['Analytical thinking', 'Excel', 'Communication'],
    preferredSkills: ['SQL', 'Data visualization'],
    majors: ['Business', 'Economics', 'Analytics'],
    courseworkCategories: ['Business Statistics', 'Operations Management'],
    responsibilities: ['Analyze process performance', 'Share actionable recommendations'],
    qualifications: ['Comfortable working with structured datasets'],
  },
  {
    key: 'data-analytics',
    label: 'Data / Analytics Intern',
    title: 'Data / Analytics Intern',
    category: 'Data Analytics',
    requiredSkills: ['SQL', 'Data communication'],
    preferredSkills: ['Python', 'Tableau'],
    majors: ['Data Science', 'Statistics', 'Computer Science'],
    courseworkCategories: ['Statistics', 'Regression', 'SQL', 'Data Visualization'],
    responsibilities: ['Write SQL for recurring analysis', 'Build dashboard views'],
    qualifications: ['Able to translate analysis into recommendations'],
  },
  {
    key: 'marketing',
    label: 'Marketing Intern',
    title: 'Marketing Intern',
    category: 'Marketing',
    requiredSkills: ['Writing', 'Project coordination'],
    preferredSkills: ['Marketing analytics'],
    majors: ['Marketing', 'Business', 'Communications'],
    courseworkCategories: ['Digital Marketing', 'Marketing Analytics', 'Consumer Behavior'],
    responsibilities: ['Coordinate campaign timelines', 'Track campaign KPIs'],
    qualifications: ['Strong writing and execution habits'],
  },
  {
    key: 'operations',
    label: 'Operations Intern',
    title: 'Operations Intern',
    category: 'Operations',
    requiredSkills: ['Organization', 'Process documentation'],
    preferredSkills: ['Spreadsheet analysis'],
    majors: ['Operations', 'Business', 'Supply Chain'],
    courseworkCategories: ['Operations Management', 'Supply Chain', 'Logistics'],
    responsibilities: ['Map workflows', 'Assist with improvement projects'],
    qualifications: ['Detail oriented with strong follow-through'],
  },
  {
    key: 'software-engineering',
    label: 'Software Engineering Intern',
    title: 'Software Engineering Intern',
    category: 'Engineering',
    requiredSkills: ['Programming fundamentals', 'Git'],
    preferredSkills: ['TypeScript', 'React'],
    majors: ['Computer Science', 'Software Engineering'],
    courseworkCategories: ['Data Structures', 'Algorithms', 'Software Engineering'],
    responsibilities: ['Implement scoped features', 'Write automated tests'],
    qualifications: ['Pursuing CS/SWE or related degree'],
  },
  {
    key: 'product',
    label: 'Product Intern',
    title: 'Product Intern',
    category: 'Product',
    requiredSkills: ['Communication', 'Problem solving'],
    preferredSkills: ['User research'],
    majors: ['Business', 'Computer Science', 'Product'],
    courseworkCategories: ['Business Statistics', 'Consumer Behavior'],
    responsibilities: ['Synthesize user feedback', 'Document requirements'],
    qualifications: ['Comfortable with cross-functional collaboration'],
  },
  {
    key: 'hr',
    label: 'HR Intern',
    title: 'HR Intern',
    category: 'HR',
    requiredSkills: ['Communication', 'Organization'],
    preferredSkills: ['ATS familiarity'],
    majors: ['HR', 'Psychology', 'Business'],
    courseworkCategories: ['Business Law', 'Operations Management'],
    responsibilities: ['Coordinate scheduling', 'Support onboarding workflows'],
    qualifications: ['Excellent interpersonal communication'],
  },
  {
    key: 'sales-bd',
    label: 'Sales / Business Development Intern',
    title: 'Sales / Business Development Intern',
    category: 'Sales',
    requiredSkills: ['Communication', 'Follow-through'],
    preferredSkills: ['Outbound prospecting'],
    majors: ['Business', 'Marketing', 'Communications'],
    courseworkCategories: ['Marketing Analytics', 'Consumer Behavior'],
    responsibilities: ['Research target accounts', 'Assist outbound outreach'],
    qualifications: ['Comfortable with customer-facing work'],
  },
  {
    key: 'supply-chain',
    label: 'Supply Chain Intern',
    title: 'Supply Chain Intern',
    category: 'Operations',
    requiredSkills: ['Organization', 'Spreadsheet analysis'],
    preferredSkills: ['Process improvement'],
    majors: ['Supply Chain', 'Operations', 'Business'],
    courseworkCategories: ['Supply Chain', 'Logistics', 'Lean/Six Sigma'],
    responsibilities: ['Track inventory flows', 'Support vendor coordination'],
    qualifications: ['Strong execution and analytical skills'],
  },
  {
    key: 'real-estate',
    label: 'Real Estate Intern',
    title: 'Real Estate Intern',
    category: 'Finance',
    requiredSkills: ['Excel', 'Market research'],
    preferredSkills: ['Financial modeling'],
    majors: ['Finance', 'Real Estate', 'Economics'],
    courseworkCategories: ['Corporate Finance', 'Business Law'],
    responsibilities: ['Research markets', 'Support underwriting analysis'],
    qualifications: ['Interested in commercial or residential markets'],
  },
  {
    key: 'investment-asset-mgmt',
    label: 'Investment / Asset Management Intern',
    title: 'Investment / Asset Management Intern',
    category: 'Finance',
    requiredSkills: ['Excel', 'Analytical thinking'],
    preferredSkills: ['Financial modeling'],
    majors: ['Finance', 'Economics', 'Accounting'],
    courseworkCategories: ['Corporate Finance', 'Business Statistics'],
    responsibilities: ['Assist portfolio reviews', 'Prepare investment memos'],
    qualifications: ['Strong quantitative and writing skills'],
  },
  {
    key: 'risk-compliance',
    label: 'Risk / Compliance Intern',
    title: 'Risk / Compliance Intern',
    category: 'Operations',
    requiredSkills: ['Attention to detail', 'Documentation'],
    preferredSkills: ['Policy review'],
    majors: ['Finance', 'Accounting', 'Business'],
    courseworkCategories: ['Business Law', 'Managerial Accounting'],
    responsibilities: ['Review controls', 'Track compliance checkpoints'],
    qualifications: ['Detail-focused and process-oriented'],
  },
  {
    key: 'healthcare-admin',
    label: 'Healthcare Admin Intern',
    title: 'Healthcare Admin Intern',
    category: 'Operations',
    requiredSkills: ['Organization', 'Communication'],
    preferredSkills: ['Spreadsheet analysis'],
    majors: ['Healthcare Administration', 'Business'],
    courseworkCategories: ['Operations Management', 'Business Statistics'],
    responsibilities: ['Support care operations reporting', 'Assist scheduling workflows'],
    qualifications: ['Interested in healthcare operations'],
  },
  {
    key: 'ux-design',
    label: 'UX / Design Intern',
    title: 'UX / Design Intern',
    category: 'Design',
    requiredSkills: ['Figma', 'Visual communication'],
    preferredSkills: ['Usability testing'],
    majors: ['Design', 'HCI', 'Psychology'],
    courseworkCategories: ['Consumer Behavior', 'Data Visualization'],
    responsibilities: ['Design UI flows', 'Iterate based on feedback'],
    qualifications: ['Portfolio with relevant work samples'],
  },
  {
    key: 'cybersecurity',
    label: 'Cybersecurity Intern',
    title: 'Cybersecurity Intern',
    category: 'Engineering',
    requiredSkills: ['Security fundamentals', 'Documentation'],
    preferredSkills: ['Scripting'],
    majors: ['Cybersecurity', 'Computer Science'],
    courseworkCategories: ['Systems Programming', 'Database Systems'],
    responsibilities: ['Assist vulnerability reviews', 'Support incident documentation'],
    qualifications: ['Strong interest in security operations'],
  },
  {
    key: 'it-support',
    label: 'IT Support Intern',
    title: 'IT Support Intern',
    category: 'Engineering',
    requiredSkills: ['Troubleshooting', 'Communication'],
    preferredSkills: ['Ticketing systems'],
    majors: ['Information Systems', 'Computer Science'],
    courseworkCategories: ['Systems Programming', 'Database Systems'],
    responsibilities: ['Resolve support tickets', 'Document recurring issues'],
    qualifications: ['Customer-first and detail-oriented'],
  },
]

type Props = {
  formId: string
  formAction: (formData: FormData) => void
  internshipId: string
  userId: string
  draftId: string
  clearOnSuccess?: boolean
  serverError?: {
    message: string
    code?: string | null
    field?: string | null
    fields?: string[] | null
    reason?: string | null
    details?: string | null
  } | null
  initialValues: ListingWizardInitialValues
  categoryOptions: string[]
  skillCatalog: CatalogOption[]
  majorCatalog: CatalogOption[]
  courseworkCategoryCatalog: CatalogOption[]
  employerBaseState: string
}

type PendingExit = { kind: 'back' } | { kind: 'href'; href: string }
type ServerErrorPayload = NonNullable<Props['serverError']>

type StepFieldErrors = {
  step1: Partial<Record<ListingStep1FieldKey, string>>
  step2: Partial<Record<ListingStep2FieldKey, string>>
  step4: Partial<Record<ListingStep4FieldKey, string>>
}

function emptyStepFieldErrors(): StepFieldErrors {
  return { step1: {}, step2: {}, step4: {} }
}

function mapServerFieldsToStepErrors(error: ServerErrorPayload | null | undefined): StepFieldErrors {
  if (!error) return emptyStepFieldErrors()
  const mapped = emptyStepFieldErrors()
  const incomingFields = Array.isArray(error.fields) && error.fields.length > 0
    ? error.fields
    : error.field
      ? [error.field]
      : []
  for (const rawField of incomingFields) {
    const field = rawField.trim().toLowerCase()
    if (!field) continue
    if (field === 'title') mapped.step1.title = error.message
    if (field === 'category' || field === 'role_category') mapped.step1.category = error.message
    if (field === 'work_mode') mapped.step1.work_mode = error.message
    if (field === 'location' || field === 'location_city') mapped.step1.location_city = error.message
    if (field === 'location' || field === 'location_state') mapped.step1.location_state = error.message
    if (field === 'external_apply_url') mapped.step1.external_apply_url = error.message
    if (field === 'pay' || field === 'pay_min') mapped.step2.pay_min = error.message
    if (field === 'pay' || field === 'pay_max') mapped.step2.pay_max = error.message
    if (field === 'hours' || field === 'hours_min') mapped.step2.hours_min = error.message
    if (field === 'hours' || field === 'hours_max') mapped.step2.hours_max = error.message
    if (field === 'term' || field === 'duration_weeks') mapped.step2.duration_weeks = error.message
    if (field === 'term' || field === 'start_date') mapped.step2.start_date = error.message
    if (field === 'application_deadline') mapped.step2.application_deadline = error.message
    if (field === 'short_summary') mapped.step4.short_summary = error.message
  }
  return mapped
}

function serializeFormForDirtyCheck(form: HTMLFormElement) {
  const formData = new FormData(form)
  const values: Array<[string, string]> = []
  for (const [key, value] of formData.entries()) {
    if (key === 'internship_id' || key === 'create_mode') continue
    values.push([key, typeof value === 'string' ? value : ''])
  }
  values.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1])
    return a[0].localeCompare(b[0])
  })
  return JSON.stringify(values)
}

function parseCsvList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseResponsibilities(value: string) {
  const normalized = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return normalized.length > 0 ? normalized : ['']
}

function parseBulletLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function isValidExternalUrl(value: string) {
  const input = value.trim()
  if (!input) return false
  const lowered = input.toLowerCase()
  if (lowered.startsWith('//')) return false
  if (lowered.startsWith('javascript:') || lowered.startsWith('data:') || lowered.startsWith('vbscript:')) return false
  try {
    const decoded = decodeURIComponent(input)
    const decodedLowered = decoded.toLowerCase()
    if (decodedLowered.startsWith('javascript:') || decodedLowered.startsWith('data:') || decodedLowered.startsWith('vbscript:')) {
      return false
    }
  } catch {
    // Ignore malformed encoding; URL parser handles invalid urls.
  }
  try {
    const parsed = new URL(input)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function deriveRange(startDate: string, durationWeeks: string) {
  const fallback = {
    startMonth: '',
    startYear: '',
    endMonth: '',
    endYear: '',
  }

  const normalizedStart = startDate.trim()
  if (!normalizedStart) return fallback
  const start = new Date(`${normalizedStart}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return fallback

  const weeks = Number.parseInt(durationWeeks, 10)
  if (!Number.isFinite(weeks) || weeks < 1) return fallback

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + weeks * 7)

  return {
    startMonth: MONTH_NAMES[start.getUTCMonth()],
    startYear: String(start.getUTCFullYear()),
    endMonth: MONTH_NAMES[end.getUTCMonth()],
    endYear: String(end.getUTCFullYear()),
  }
}

async function postAnalyticsEvent(eventName: string, properties: Record<string, unknown>) {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, properties }),
      keepalive: true,
    })
  } catch {
    // Non-blocking by design.
  }
}

export default function ListingWizard(props: Props) {
  const [step, setStep] = useState(1)
  const [attemptedStep, setAttemptedStep] = useState<Record<number, boolean>>({})
  const [templateKey, setTemplateKey] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showPreviewMobile, setShowPreviewMobile] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [pendingExit, setPendingExit] = useState<PendingExit | null>(null)
  const [resumeCandidate, setResumeCandidate] = useState<{ draftId: string; savedAt: string } | null>(null)
  const [persistentServerError, setPersistentServerError] = useState<ServerErrorPayload | null>(props.serverError ?? null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const allowExitRef = useRef(false)
  const initialSnapshotRef = useRef<string | null>(null)
  const hasPushedExitGuardRef = useRef(false)
  const hydratedStorageKeyRef = useRef<string | null>(null)
  const storageKey = useMemo(() => listingDraftStorageKey(props.userId, props.draftId), [props.userId, props.draftId])
  const lastDraftKey = useMemo(() => listingLastDraftPointerKey(props.userId), [props.userId])
  const latestInitialValuesRef = useRef(props.initialValues)

  const [state, setState] = useState(props.initialValues)
  const [responsibilities, setResponsibilities] = useState<string[]>(() => parseResponsibilities(props.initialValues.responsibilities))
  const [requiredSkillLabels, setRequiredSkillLabels] = useState(props.initialValues.requiredSkillLabels)
  const [preferredSkillLabels, setPreferredSkillLabels] = useState(props.initialValues.preferredSkillLabels)
  const [majorLabels, setMajorLabels] = useState(props.initialValues.majorLabels)
  const [courseworkCategoryLabels, setCourseworkCategoryLabels] = useState(props.initialValues.courseworkCategoryLabels)

  useEffect(() => {
    latestInitialValuesRef.current = props.initialValues
  }, [props.initialValues])

  useEffect(() => {
    const initialValues = latestInitialValuesRef.current
    setStep(1)
    setAttemptedStep({})
    setTemplateKey('')
    setSavedAt(null)
    setSubmitted(false)
    setIsDirty(false)
    setShowPreviewMobile(false)
    setShowExitModal(false)
    setPendingExit(null)
    setResumeCandidate(null)
    allowExitRef.current = false
    initialSnapshotRef.current = null
    hasPushedExitGuardRef.current = false
    setState(initialValues)
    setResponsibilities(parseResponsibilities(initialValues.responsibilities))
    setRequiredSkillLabels(initialValues.requiredSkillLabels)
    setPreferredSkillLabels(initialValues.preferredSkillLabels)
    setMajorLabels(initialValues.majorLabels)
    setCourseworkCategoryLabels(initialValues.courseworkCategoryLabels)
    setPersistentServerError(props.serverError ?? null)
  }, [props.draftId, props.serverError])

  useEffect(() => {
    postAnalyticsEvent('employer_listing_started', { draft_key: props.draftId })
  }, [props.draftId])

  useEffect(() => {
    postAnalyticsEvent('employer_listing_step_viewed', { step })
  }, [step])

  useEffect(() => {
    if (!props.clearOnSuccess) return
    const initialValues = latestInitialValuesRef.current
    window.localStorage.removeItem(storageKey)
    const pointer = parseListingLastDraftPointer(window.localStorage.getItem(lastDraftKey))
    if (pointer && pointer.draftId === props.draftId) {
      window.localStorage.removeItem(lastDraftKey)
    }
    setState(initialValues)
    setResponsibilities(parseResponsibilities(initialValues.responsibilities))
    setRequiredSkillLabels(initialValues.requiredSkillLabels)
    setPreferredSkillLabels(initialValues.preferredSkillLabels)
    setMajorLabels(initialValues.majorLabels)
    setCourseworkCategoryLabels(initialValues.courseworkCategoryLabels)
    setSavedAt(null)
    initialSnapshotRef.current = null
    setIsDirty(false)
  }, [lastDraftKey, props.clearOnSuccess, props.draftId, storageKey])

  useLayoutEffect(() => {
    if (hydratedStorageKeyRef.current === storageKey) return
    hydratedStorageKeyRef.current = storageKey
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      if (!props.internshipId) {
        const pointer = parseListingLastDraftPointer(window.localStorage.getItem(lastDraftKey))
        if (pointer && pointer.draftId !== props.draftId && isRecentDraft(pointer.savedAt)) {
          const resumeKey = listingDraftStorageKey(props.userId, pointer.draftId)
          if (window.localStorage.getItem(resumeKey)) {
            setResumeCandidate({ draftId: pointer.draftId, savedAt: pointer.savedAt })
          }
        }
      }
      return
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      setState((prev) => ({
        ...prev,
        title: typeof parsed.title === 'string' ? parsed.title : prev.title,
        category: typeof parsed.category === 'string' ? parsed.category : prev.category,
        workMode: typeof parsed.work_mode === 'string' ? (parsed.work_mode as WorkMode) : prev.workMode,
        locationCity: typeof parsed.location_city === 'string' ? parsed.location_city : prev.locationCity,
        locationState: typeof parsed.location_state === 'string' ? parsed.location_state : prev.locationState,
        applyMode: typeof parsed.apply_mode === 'string' ? (parsed.apply_mode as ApplyMode) : prev.applyMode,
        externalApplyUrl: typeof parsed.external_apply_url === 'string' ? parsed.external_apply_url : prev.externalApplyUrl,
        externalApplyType: typeof parsed.external_apply_type === 'string' ? parsed.external_apply_type : prev.externalApplyType,
        payType: typeof parsed.pay_type === 'string' ? 'hourly' : prev.payType,
        payMin: typeof parsed.pay_min === 'string' ? parsed.pay_min : prev.payMin,
        payMax: typeof parsed.pay_max === 'string' ? parsed.pay_max : prev.payMax,
        hoursMin: typeof parsed.hours_min === 'string' ? parsed.hours_min : prev.hoursMin,
        hoursMax: typeof parsed.hours_max === 'string' ? parsed.hours_max : prev.hoursMax,
        durationWeeks: typeof parsed.duration_weeks === 'string' ? parsed.duration_weeks : prev.durationWeeks,
        startDate: typeof parsed.start_date === 'string' ? parsed.start_date : prev.startDate,
        applicationDeadline:
          typeof parsed.application_deadline === 'string' ? parsed.application_deadline : prev.applicationDeadline,
        shortSummary: typeof parsed.short_summary === 'string' ? parsed.short_summary : prev.shortSummary,
        qualifications: typeof parsed.qualifications === 'string' ? parsed.qualifications : prev.qualifications,
        screeningQuestion:
          typeof parsed.screening_question === 'string' ? parsed.screening_question : prev.screeningQuestion,
        resumeRequired: parsed.resume_required !== '0',
      }))
      if (typeof parsed.responsibilities === 'string') {
        setResponsibilities(parseResponsibilities(parsed.responsibilities))
      }
      if (typeof parsed.required_skills === 'string') setRequiredSkillLabels(parseCsvList(parsed.required_skills))
      if (typeof parsed.preferred_skills === 'string') setPreferredSkillLabels(parseCsvList(parsed.preferred_skills))
      if (typeof parsed.majors === 'string') setMajorLabels(parseCsvList(parsed.majors))
      if (typeof parsed.required_course_categories === 'string') {
        setCourseworkCategoryLabels(parseCsvList(parsed.required_course_categories))
      }
      if (typeof parsed._saved_at === 'string') setSavedAt(parsed._saved_at)
      setResumeCandidate(null)
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [lastDraftKey, props.draftId, props.internshipId, props.userId, storageKey])

  useEffect(() => {
    if (props.serverError) {
      setPersistentServerError(props.serverError)
    }
  }, [props.serverError])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (submitted || allowExitRef.current || !isDirty) return
      event.preventDefault()
      event.returnValue = ''
      void postAnalyticsEvent('employer_listing_abandoned', { step, draft_key: props.draftId })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [isDirty, props.draftId, step, submitted])

  useEffect(() => {
    const form = formRef.current
    if (!form) return
    const captureDirtyState = () => {
      const current = serializeFormForDirtyCheck(form)
      if (initialSnapshotRef.current === null) {
        initialSnapshotRef.current = current
        setIsDirty(false)
        return
      }
      setIsDirty(current !== initialSnapshotRef.current)
    }
    const timer = window.setTimeout(captureDirtyState, 0)
    form.addEventListener('input', captureDirtyState)
    form.addEventListener('change', captureDirtyState)
    return () => {
      window.clearTimeout(timer)
      form.removeEventListener('input', captureDirtyState)
      form.removeEventListener('change', captureDirtyState)
    }
  }, [])

  useEffect(() => {
    if (submitted || !isDirty) return

    const marker = { listingGuard: props.draftId, ts: Date.now() }
    if (!hasPushedExitGuardRef.current) {
      window.history.pushState(marker, '', window.location.href)
      hasPushedExitGuardRef.current = true
    }

    const onPopState = () => {
      if (allowExitRef.current || submitted || !isDirty) return
      setPendingExit({ kind: 'back' })
      setShowExitModal(true)
      window.history.pushState(marker, '', window.location.href)
    }

    const onClickCapture = (event: MouseEvent) => {
      if (allowExitRef.current || submitted || !isDirty) return
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return
      if (anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const nextUrl = new URL(href, window.location.href)
      const currentUrl = new URL(window.location.href)
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search && nextUrl.hash) return
      event.preventDefault()
      setPendingExit({ kind: 'href', href: nextUrl.toString() })
      setShowExitModal(true)
    }

    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', onClickCapture, true)
    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [isDirty, props.draftId, submitted])

  const derivedRange = useMemo(() => deriveRange(state.startDate, state.durationWeeks), [state.startDate, state.durationWeeks])

  const derivedDescription = useMemo(() => {
    const lines: string[] = []
    if (state.shortSummary.trim()) lines.push(state.shortSummary.trim())
    const normalizedResponsibilities = responsibilities.map((item) => item.trim()).filter(Boolean)
    if (normalizedResponsibilities.length > 0) {
      lines.push('Responsibilities:')
      lines.push(...normalizedResponsibilities.map((item) => `- ${item}`))
    }
    const qualifications = parseBulletLines(state.qualifications)
    if (qualifications.length > 0) {
      lines.push('Qualifications:')
      lines.push(...qualifications.map((item) => `- ${item}`))
    }
    if (state.screeningQuestion.trim()) {
      lines.push(`Screening question: ${state.screeningQuestion.trim()}`)
    }
    return lines.join('\n')
  }, [responsibilities, state.qualifications, state.screeningQuestion, state.shortSummary])

  const updateState = (patch: Partial<Record<string, string>>) => {
    setState((prev) => ({
      ...prev,
      ...(Object.fromEntries(
        Object.entries(patch).map(([key, value]) => {
          if (key === 'workMode') return ['workMode', value as WorkMode]
          if (key === 'applyMode') return ['applyMode', value as ApplyMode]
          return [key, value]
        })
      ) as Partial<typeof prev>),
    }))
  }

  const applyTemplate = (nextTemplateKey: string) => {
    setTemplateKey(nextTemplateKey)
    const template = EMPLOYER_LISTING_TEMPLATES.find((item) => item.key === nextTemplateKey)
    if (!template) return
    setState((prev) => ({
      ...prev,
      title: template.title,
      category: template.category,
      qualifications: template.qualifications.join('\n'),
    }))
    setResponsibilities(template.responsibilities.length > 0 ? template.responsibilities : [''])
    setRequiredSkillLabels(template.requiredSkills)
    setPreferredSkillLabels(template.preferredSkills)
    setMajorLabels(template.majors)
    setCourseworkCategoryLabels(template.courseworkCategories)
  }

  const stepValidation = useMemo(() => {
    const stepIssues: string[] = []
    const step1FieldErrors: Partial<Record<ListingStep1FieldKey, string>> = {}

    if (!state.title.trim()) {
      stepIssues.push('Title is required.')
      step1FieldErrors.title = 'Title is required.'
    }
    if (!state.category.trim()) {
      stepIssues.push('Role category is required.')
      step1FieldErrors.category = 'Role category is required.'
    }
    if (!state.workMode.trim()) {
      stepIssues.push('Please choose a valid work location: Remote, In-person, or Hybrid.')
      step1FieldErrors.work_mode = 'Please choose a valid work location: Remote, In-person, or Hybrid.'
    }
    if ((state.workMode === 'hybrid' || state.workMode === 'on-site') && (!state.locationCity.trim() || !state.locationState.trim())) {
      stepIssues.push('City and state are required for hybrid/in-person roles.')
      if (!state.locationCity.trim()) step1FieldErrors.location_city = 'City is required for hybrid/in-person roles.'
      if (!state.locationState.trim()) step1FieldErrors.location_state = 'State is required for hybrid/in-person roles.'
    }
    if ((state.applyMode === 'ats_link' || state.applyMode === 'hybrid') && !isValidExternalUrl(state.externalApplyUrl)) {
      stepIssues.push('ATS Link/Hybrid requires a valid https URL.')
      step1FieldErrors.external_apply_url = 'A valid https URL is required for ATS Link/Hybrid.'
    }
    const step1Valid = stepIssues.length === 0

    const payMin = Number(state.payMin)
    const payMax = Number(state.payMax)
    const hoursMin = Number(state.hoursMin)
    const hoursMax = Number(state.hoursMax)
    const durationWeeks = Number(state.durationWeeks)

    const step2Issues: string[] = []
    const step2FieldErrors: Partial<Record<ListingStep2FieldKey, string>> = {}
    if (!Number.isFinite(payMin) || !Number.isFinite(payMax) || payMin < 0 || payMax < payMin) {
      step2Issues.push('Pay range min must be <= max.')
      step2FieldErrors.pay_min = 'Pay range min must be <= max.'
      step2FieldErrors.pay_max = 'Pay range min must be <= max.'
    }
    if (!Number.isFinite(hoursMin) || !Number.isFinite(hoursMax) || hoursMin < 1 || hoursMax < hoursMin || hoursMax > 80) {
      step2Issues.push('Hours/week min must be <= max.')
      step2FieldErrors.hours_min = 'Hours/week min must be <= max.'
      step2FieldErrors.hours_max = 'Hours/week min must be <= max.'
    }
    if (!Number.isFinite(durationWeeks) || durationWeeks < 1) {
      step2Issues.push('Duration must be at least 1 week.')
      step2FieldErrors.duration_weeks = 'Duration must be at least 1 week.'
    }
    if (!state.startDate.trim()) {
      step2Issues.push('Start date is required. This can be a placeholder.')
      step2FieldErrors.start_date = 'Start date is required.'
    }
    if (!state.applicationDeadline.trim()) {
      step2Issues.push('Application deadline is required.')
      step2FieldErrors.application_deadline = 'Application deadline is required.'
    }
    if (!derivedRange.startMonth || !derivedRange.endMonth) {
      step2Issues.push('Start date or duration is invalid.')
      step2FieldErrors.start_date = 'Start date or duration is invalid.'
      step2FieldErrors.duration_weeks = 'Start date or duration is invalid.'
    }
    if (state.applicationDeadline) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const deadline = new Date(`${state.applicationDeadline}T00:00:00`)
      if (!Number.isNaN(deadline.getTime()) && deadline < today) {
        step2Issues.push('Deadline cannot be in the past.')
        step2FieldErrors.application_deadline = 'Deadline cannot be in the past.'
      }
    }
    const step2Valid = step2Issues.length === 0

    const step3Warnings: string[] = []
    if (requiredSkillLabels.length === 0) {
      step3Warnings.push('Add at least one required skill for better matching quality.')
    }

    const step4Issues: string[] = []
    const step4FieldErrors: Partial<Record<ListingStep4FieldKey, string>> = {}
    if (!state.shortSummary.trim()) {
      step4Issues.push('Short summary is required.')
      step4FieldErrors.short_summary = 'Short summary is required.'
    }
    if (state.shortSummary.length > 200) {
      step4Issues.push('Short summary must be 200 characters or fewer.')
      step4FieldErrors.short_summary = 'Short summary must be 200 characters or fewer.'
    }
    const step4Valid = step4Issues.length === 0

    return {
      step1: { valid: step1Valid, issues: stepIssues, fieldErrors: step1FieldErrors },
      step2: { valid: step2Valid, issues: step2Issues, fieldErrors: step2FieldErrors },
      step3: { valid: true, issues: step3Warnings },
      step4: { valid: step4Valid, issues: step4Issues, fieldErrors: step4FieldErrors },
    }
  }, [
    derivedRange.endMonth,
    derivedRange.startMonth,
    requiredSkillLabels.length,
    state.applyMode,
    state.category,
    state.durationWeeks,
    state.externalApplyUrl,
    state.hoursMax,
    state.hoursMin,
    state.locationCity,
    state.locationState,
    state.payMax,
    state.payMin,
    state.shortSummary,
    state.title,
    state.workMode,
    state.applicationDeadline,
  ])

  const isCurrentStepValid =
    step === 1
      ? stepValidation.step1.valid
      : step === 2
        ? stepValidation.step2.valid
        : step === 3
          ? stepValidation.step3.valid
          : stepValidation.step4.valid

  const currentIssues =
    step === 1
      ? stepValidation.step1.issues
      : step === 2
        ? stepValidation.step2.issues
        : step === 3
          ? stepValidation.step3.issues
          : stepValidation.step4.issues
  const serverStepFieldErrors = useMemo(
    () => mapServerFieldsToStepErrors(persistentServerError),
    [persistentServerError]
  )
  const step1FieldErrors = {
    ...(attemptedStep[1] ? stepValidation.step1.fieldErrors : {}),
    ...serverStepFieldErrors.step1,
  }
  const step2FieldErrors = {
    ...(attemptedStep[2] ? stepValidation.step2.fieldErrors : {}),
    ...serverStepFieldErrors.step2,
  }
  const step4FieldErrors = {
    ...(attemptedStep[4] ? stepValidation.step4.fieldErrors : {}),
    ...serverStepFieldErrors.step4,
  }

  const previewRequiredSkills = requiredSkillLabels
  const previewPreferredSkills = preferredSkillLabels
  const previewMajors = majorLabels

  const persistDraft = async () => {
    const form = formRef.current
    if (!form) return
    const formData = new FormData(form)
    const next: Record<string, string | string[]> = {}
    for (const [name, value] of formData.entries()) {
      if (name === 'internship_id') continue
      const asString = typeof value === 'string' ? value : ''
      const existing = next[name]
      if (existing === undefined) {
        next[name] = asString
      } else if (Array.isArray(existing)) {
        next[name] = [...existing, asString]
      } else {
        next[name] = [existing, asString]
      }
    }
    const now = new Date().toISOString()
    next._saved_at = now
    window.localStorage.setItem(storageKey, JSON.stringify(next))
    window.localStorage.setItem(lastDraftKey, JSON.stringify({ draftId: props.draftId, savedAt: now }))
    setSavedAt(now)
    void postAnalyticsEvent('employer_listing_draft_saved', { step, draft_key: props.draftId, autosave: true })
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void persistDraft()
    }, 900)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, responsibilities, requiredSkillLabels, preferredSkillLabels, majorLabels, courseworkCategoryLabels, step])

  const onNext = () => {
    setAttemptedStep((prev) => ({ ...prev, [step]: true }))
    if (!isCurrentStepValid) return
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1))
    setAttemptedStep((prev) => ({ ...prev, [step + 1]: false }))
  }

  const onBack = () => {
    setStep((prev) => Math.max(1, prev - 1))
  }

  const confirmExit = () => {
    allowExitRef.current = true
    window.localStorage.removeItem(storageKey)
    const pointer = parseListingLastDraftPointer(window.localStorage.getItem(lastDraftKey))
    if (pointer && pointer.draftId === props.draftId) {
      window.localStorage.removeItem(lastDraftKey)
    }
    setState(props.initialValues)
    setResponsibilities(parseResponsibilities(props.initialValues.responsibilities))
    setRequiredSkillLabels(props.initialValues.requiredSkillLabels)
    setPreferredSkillLabels(props.initialValues.preferredSkillLabels)
    setMajorLabels(props.initialValues.majorLabels)
    setCourseworkCategoryLabels(props.initialValues.courseworkCategoryLabels)
    setSavedAt(null)
    initialSnapshotRef.current = null
    setIsDirty(false)
    setShowExitModal(false)
    const target = pendingExit?.kind === 'href' ? pendingExit.href : '/dashboard/employer'
    window.location.replace(target)
  }

  return (
    <>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <ListingProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

            <div>
              <label className="text-sm font-medium text-slate-700">Start from template (optional)</label>
              <select
                value={templateKey}
                onChange={(event) => applyTemplate(event.target.value)}
                className={`mt-1 w-full rounded-md border p-2 text-sm outline-none transition ${
                  templateKey
                    ? 'border-blue-300 bg-blue-50 text-slate-900'
                    : 'border-slate-300 bg-white text-slate-900'
                } focus:border-blue-500 focus:ring-2 focus:ring-blue-200`}
              >
                <option value="">None</option>
                {EMPLOYER_LISTING_TEMPLATES.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>

            {resumeCandidate ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>Resume your saved draft from {new Date(resumeCandidate.savedAt).toLocaleString()}?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.assign(`/dashboard/employer/new?draft=${encodeURIComponent(resumeCandidate.draftId)}`)
                    }}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.localStorage.removeItem(lastDraftKey)
                      setResumeCandidate(null)
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Start new
                  </button>
                </div>
              </div>
            ) : null}

            {persistentServerError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div className="flex items-start justify-between gap-3">
                  <p>{persistentServerError.message}</p>
                  <button
                    type="button"
                    onClick={() => setPersistentServerError(null)}
                    className="text-xs font-medium text-red-700 underline"
                  >
                    Dismiss
                  </button>
                </div>
                {process.env.NODE_ENV !== 'production' ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-red-700">Copy error details</summary>
                    <pre className="mt-2 overflow-x-auto rounded border border-red-200 bg-white p-2 text-[11px] text-red-900">
{JSON.stringify(
  {
    code: persistentServerError.code ?? null,
    reason: persistentServerError.reason ?? null,
    fields: persistentServerError.fields ?? (persistentServerError.field ? [persistentServerError.field] : []),
    details: persistentServerError.details ?? null,
  },
  null,
  2
)}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        const payload = JSON.stringify(
                          {
                            code: persistentServerError?.code ?? null,
                            reason: persistentServerError?.reason ?? null,
                            fields:
                              persistentServerError?.fields ??
                              (persistentServerError?.field ? [persistentServerError.field] : []),
                            details: persistentServerError?.details ?? null,
                          },
                          null,
                          2
                        )
                        void navigator.clipboard.writeText(payload)
                      }}
                      className="mt-2 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700"
                    >
                      Copy error details
                    </button>
                  </details>
                ) : null}
              </div>
            ) : null}

            <form
              id={props.formId}
              ref={formRef}
              action={props.formAction}
              onSubmit={() => {
                setPersistentServerError(null)
                setSubmitted(true)
              }}
              className="space-y-4"
            >
              <input type="hidden" name="internship_id" value={props.internshipId} />
              <input type="hidden" name="draft_id" value={props.draftId} />
              <input type="hidden" name="company_name" value={state.companyName} />
              <input type="hidden" name="start_month" value={derivedRange.startMonth} />
              <input type="hidden" name="start_year" value={derivedRange.startYear} />
              <input type="hidden" name="end_month" value={derivedRange.endMonth} />
              <input type="hidden" name="end_year" value={derivedRange.endYear} />
              <input type="hidden" name="target_student_year" value="any" />
              <input type="hidden" name="target_student_years" value={JSON.stringify(['freshman', 'sophomore', 'junior', 'senior'])} />
              <input type="hidden" name="desired_coursework_strength" value="low" />
              <input type="hidden" name="remote_eligible_region" value="state" />
              <input type="hidden" name="remote_eligible_state" value={state.locationState || props.employerBaseState || 'UT'} />
              <input type="hidden" name="description" value={derivedDescription} />
              <input type="hidden" name="responsibilities" value={responsibilities.map((item) => item.trim()).filter(Boolean).join('\n')} />

              <div className={step === 1 ? '' : 'hidden'}>
                <ListingStepBasics
                  title={state.title}
                  category={state.category}
                  workMode={state.workMode}
                  locationCity={state.locationCity}
                  locationState={state.locationState}
                  applyMode={state.applyMode}
                  externalApplyUrl={state.externalApplyUrl}
                  externalApplyType={state.externalApplyType}
                  categories={props.categoryOptions}
                  fieldErrors={step1FieldErrors}
                  onChange={updateState}
                />
              </div>

              <div className={step === 2 ? '' : 'hidden'}>
                <ListingStepPayTime
                  payType={state.payType}
                  payMin={state.payMin}
                  payMax={state.payMax}
                  hoursMin={state.hoursMin}
                  hoursMax={state.hoursMax}
                  durationWeeks={state.durationWeeks}
                  startDate={state.startDate}
                  applicationDeadline={state.applicationDeadline}
                  fieldErrors={step2FieldErrors}
                  onChange={updateState}
                />
                <p className="text-xs text-slate-500">
                  Listings with pay + hours filled get more qualified applicants.
                </p>
              </div>

              <div className={step === 3 ? '' : 'hidden'}>
                <ListingStepRequirements
                  skillCatalog={props.skillCatalog}
                  majorCatalog={props.majorCatalog}
                  courseworkCategoryCatalog={props.courseworkCategoryCatalog}
                  requiredSkillLabels={requiredSkillLabels}
                  preferredSkillLabels={preferredSkillLabels}
                  majorLabels={majorLabels}
                  courseworkCategoryLabels={courseworkCategoryLabels}
                  resumeRequired={state.resumeRequired}
                  onResumeRequiredChange={(value) => setState((prev) => ({ ...prev, resumeRequired: value }))}
                />
              </div>

              <div className={step === 4 ? '' : 'hidden'}>
                <ListingStepDescription
                  shortSummary={state.shortSummary}
                  responsibilities={responsibilities}
                  qualifications={state.qualifications}
                  screeningQuestion={state.screeningQuestion}
                  fieldErrors={step4FieldErrors}
                  onChange={updateState}
                  onResponsibilitiesChange={setResponsibilities}
                />
              </div>

              {attemptedStep[step] && currentIssues.length > 0 ? (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    step === 3 ? 'border border-blue-200 bg-blue-50 text-blue-800' : 'border border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {currentIssues.join(' ')}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  {savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : 'Autosaving draft...'}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={step === 1}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    Back
                  </button>
                  {step < TOTAL_STEPS ? (
                    <button
                      type="button"
                      onClick={onNext}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      Next
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        name="create_mode"
                        value="draft"
                        onClick={() => {
                          setPersistentServerError(null)
                          void postAnalyticsEvent('employer_listing_draft_saved', {
                            draft_key: props.draftId,
                            step,
                            autosave: false,
                          })
                        }}
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        Save draft
                      </button>
                      <button
                        type="submit"
                        name="create_mode"
                        value="publish"
                        onClick={(event) => {
                          setPersistentServerError(null)
                          setAttemptedStep((prev) => ({ ...prev, 4: true }))
                          if (!stepValidation.step4.valid) {
                            event.preventDefault()
                            return
                          }
                          void postAnalyticsEvent('employer_listing_published', { draft_key: props.draftId })
                        }}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {props.internshipId ? 'Update & publish' : 'Publish internship'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </form>

            <button
              type="button"
              onClick={() => setShowPreviewMobile((prev) => !prev)}
              className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 lg:hidden"
            >
              {showPreviewMobile ? 'Hide preview' : 'Show preview'}
            </button>

            {showPreviewMobile ? (
              <ListingPreviewPanel
                title={state.title}
                companyName={state.companyName}
                category={state.category}
                workMode={state.workMode}
                locationCity={state.locationCity}
                locationState={state.locationState}
                payMin={state.payMin}
                payMax={state.payMax}
                hoursMin={state.hoursMin}
                hoursMax={state.hoursMax}
                durationWeeks={state.durationWeeks}
                shortSummary={state.shortSummary}
                responsibilities={responsibilities.join('\n')}
                qualifications={state.qualifications}
                applyMode={state.applyMode}
                externalApplyUrl={state.externalApplyUrl}
                requiredSkills={previewRequiredSkills}
                preferredSkills={previewPreferredSkills}
                majors={previewMajors}
              />
            ) : null}
          </div>
        </div>

        <div className="hidden lg:block">
          <ListingPreviewPanel
            title={state.title}
            companyName={state.companyName}
            category={state.category}
            workMode={state.workMode}
            locationCity={state.locationCity}
            locationState={state.locationState}
            payMin={state.payMin}
            payMax={state.payMax}
            hoursMin={state.hoursMin}
            hoursMax={state.hoursMax}
            durationWeeks={state.durationWeeks}
            shortSummary={state.shortSummary}
            responsibilities={responsibilities.join('\n')}
            qualifications={state.qualifications}
            applyMode={state.applyMode}
            externalApplyUrl={state.externalApplyUrl}
            requiredSkills={previewRequiredSkills}
            preferredSkills={previewPreferredSkills}
            majors={previewMajors}
          />
        </div>
      </div>

      {showExitModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Leave listing creation?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {savedAt ? 'Your draft is saved. You will return to your dashboard.' : 'You may lose your progress. You will return to your dashboard.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false)
                  setPendingExit(null)
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
