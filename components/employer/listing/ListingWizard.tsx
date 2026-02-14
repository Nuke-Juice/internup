'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import ListingProgressBar from './ListingProgressBar'
import ListingPreviewPanel from './ListingPreviewPanel'
import ListingStepBasics from './ListingStepBasics'
import ListingStepPayTime from './ListingStepPayTime'
import ListingStepRequirements from './ListingStepRequirements'
import ListingStepDescription from './ListingStepDescription'
import type { ApplyMode, CatalogOption, ListingTemplate, ListingWizardInitialValues, WorkMode } from './types'

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
    requiredSkills: ['Excel', 'Attention to detail', 'Financial statement literacy'],
    preferredSkills: ['GAAP basics', 'ERP familiarity'],
    majors: ['Accounting', 'Finance'],
    courseworkCategories: ['Financial Accounting', 'Managerial Accounting'],
    responsibilities: ['Support AP/AR reconciliations', 'Prepare month-end support schedules', 'Maintain audit-ready documentation'],
    qualifications: ['Pursuing Accounting, Finance, or related degree', 'Strong spreadsheet and communication skills'],
  },
  {
    key: 'finance',
    label: 'Finance Intern',
    title: 'Finance Intern',
    category: 'Finance',
    requiredSkills: ['Excel', 'Financial modeling', 'Written communication'],
    preferredSkills: ['PowerPoint', 'Variance analysis'],
    majors: ['Finance', 'Economics', 'Accounting'],
    courseworkCategories: ['Corporate Finance / Valuation', 'Financial Modeling (Excel)'],
    responsibilities: ['Build weekly KPI reports', 'Support forecast and variance analysis', 'Prepare review deck materials'],
    qualifications: ['Pursuing Finance, Accounting, Economics, or related degree', 'Comfortable with quantitative analysis'],
  },
  {
    key: 'data',
    label: 'Data/Analytics Intern',
    title: 'Data Analyst Intern',
    category: 'Data Analytics',
    requiredSkills: ['SQL', 'Analytical thinking', 'Data communication'],
    preferredSkills: ['Python', 'Tableau'],
    majors: ['Data Science', 'Statistics', 'Computer Science'],
    courseworkCategories: ['SQL / Databases', 'Statistics / Probability', 'Data Visualization (Tableau/Power BI)'],
    responsibilities: ['Write SQL queries for recurring analysis', 'Build dashboards for core KPIs', 'Summarize findings for stakeholders'],
    qualifications: ['Pursuing Data Science, Statistics, CS, or related degree', 'Able to explain technical results clearly'],
  },
  {
    key: 'marketing',
    label: 'Marketing Intern',
    title: 'Marketing Intern',
    category: 'Marketing',
    requiredSkills: ['Writing', 'Project coordination', 'Communication'],
    preferredSkills: ['Marketing analytics', 'A/B testing'],
    majors: ['Marketing', 'Business', 'Communications'],
    courseworkCategories: ['Marketing Analytics', 'Business Communication'],
    responsibilities: ['Coordinate campaign calendars', 'Draft channel content', 'Track campaign performance metrics'],
    qualifications: ['Pursuing Marketing, Business, Communications, or related degree', 'Strong written communication'],
  },
  {
    key: 'ops',
    label: 'Ops Intern',
    title: 'Operations Intern',
    category: 'Operations',
    requiredSkills: ['Organization', 'Process documentation', 'Cross-functional communication'],
    preferredSkills: ['Process improvement', 'Spreadsheet analysis'],
    majors: ['Operations', 'Business', 'Supply Chain'],
    courseworkCategories: ['Operations / Supply Chain', 'Project Management Fundamentals'],
    responsibilities: ['Document current workflows', 'Support process-improvement projects', 'Track execution metrics'],
    qualifications: ['Pursuing Business, Operations, or related degree', 'Strong execution and communication habits'],
  },
  {
    key: 'swe',
    label: 'SWE Intern',
    title: 'Software Engineering Intern',
    category: 'Engineering',
    requiredSkills: ['Programming fundamentals', 'Git', 'Debugging'],
    preferredSkills: ['TypeScript', 'React', 'API integration'],
    majors: ['Computer Science', 'Software Engineering', 'Computer Engineering'],
    courseworkCategories: ['Software Engineering Fundamentals', 'Databases / SQL'],
    responsibilities: ['Implement scoped product features', 'Write and update automated tests', 'Participate in code reviews'],
    qualifications: ['Pursuing CS, SWE, or related degree', 'Familiarity with modern web development tooling'],
  },
]

type Props = {
  formId: string
  formAction: (formData: FormData) => void
  internshipId: string
  userId: string
  draftKey: string
  clearOnSuccess?: boolean
  initialValues: ListingWizardInitialValues
  categoryOptions: string[]
  skillCatalog: CatalogOption[]
  majorCatalog: CatalogOption[]
  courseworkCategoryCatalog: CatalogOption[]
  employerBaseState: string
  showTurnstile: boolean
}

function toStorageKey(userId: string, draftKey: string) {
  return `employer_listing_wizard:${userId}:${draftKey}`
}

function parseCsvList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseBullets(value: string) {
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

  const normalizedStart = startDate.trim() || new Date().toISOString().slice(0, 10)
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
  const [templateKey, setTemplateKey] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showPreviewMobile, setShowPreviewMobile] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const storageKey = useMemo(() => toStorageKey(props.userId, props.draftKey), [props.userId, props.draftKey])

  const [state, setState] = useState(props.initialValues)
  const [requiredSkillLabels, setRequiredSkillLabels] = useState(props.initialValues.requiredSkillLabels)
  const [preferredSkillLabels, setPreferredSkillLabels] = useState(props.initialValues.preferredSkillLabels)
  const [majorLabels, setMajorLabels] = useState(props.initialValues.majorLabels)
  const [courseworkCategoryLabels, setCourseworkCategoryLabels] = useState(props.initialValues.courseworkCategoryLabels)

  useEffect(() => {
    postAnalyticsEvent('employer_listing_started', { draft_key: props.draftKey })
  }, [props.draftKey])

  useEffect(() => {
    postAnalyticsEvent('employer_listing_step_viewed', { step })
  }, [step])

  useEffect(() => {
    if (!props.clearOnSuccess) return
    window.localStorage.removeItem(storageKey)
  }, [props.clearOnSuccess, storageKey])

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return
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
        responsibilities: typeof parsed.responsibilities === 'string' ? parsed.responsibilities : prev.responsibilities,
        qualifications: typeof parsed.qualifications === 'string' ? parsed.qualifications : prev.qualifications,
        screeningQuestion:
          typeof parsed.screening_question === 'string' ? parsed.screening_question : prev.screeningQuestion,
        resumeRequired: parsed.resume_required !== '0',
      }))
      if (typeof parsed.required_skills === 'string') setRequiredSkillLabels(parseCsvList(parsed.required_skills))
      if (typeof parsed.preferred_skills === 'string') setPreferredSkillLabels(parseCsvList(parsed.preferred_skills))
      if (typeof parsed.majors === 'string') setMajorLabels(parseCsvList(parsed.majors))
      if (typeof parsed.required_course_categories === 'string') {
        setCourseworkCategoryLabels(parseCsvList(parsed.required_course_categories))
      }
      if (typeof parsed._saved_at === 'string') setSavedAt(parsed._saved_at)
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    const onBeforeUnload = () => {
      if (submitted) return
      void postAnalyticsEvent('employer_listing_abandoned', { step, draft_key: props.draftKey })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [props.draftKey, step, submitted])

  const derivedRange = useMemo(() => deriveRange(state.startDate, state.durationWeeks), [state.startDate, state.durationWeeks])

  const derivedDescription = useMemo(() => {
    const lines: string[] = []
    if (state.shortSummary.trim()) lines.push(state.shortSummary.trim())
    const responsibilities = parseBullets(state.responsibilities)
    if (responsibilities.length > 0) {
      lines.push('Responsibilities:')
      lines.push(...responsibilities.map((item) => `- ${item}`))
    }
    const qualifications = parseBullets(state.qualifications)
    if (qualifications.length > 0) {
      lines.push('Qualifications:')
      lines.push(...qualifications.map((item) => `- ${item}`))
    }
    if (state.screeningQuestion.trim()) {
      lines.push(`Screening question: ${state.screeningQuestion.trim()}`)
    }
    return lines.join('\n')
  }, [state.qualifications, state.responsibilities, state.screeningQuestion, state.shortSummary])

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
      responsibilities: template.responsibilities.map((line) => `- ${line}`).join('\n'),
      qualifications: template.qualifications.map((line) => `- ${line}`).join('\n'),
    }))
    setRequiredSkillLabels(template.requiredSkills)
    setPreferredSkillLabels(template.preferredSkills)
    setMajorLabels(template.majors)
    setCourseworkCategoryLabels(template.courseworkCategories)
  }

  const stepValidation = useMemo(() => {
    const stepIssues: string[] = []

    if (!state.title.trim()) stepIssues.push('Title is required.')
    if (!state.category.trim()) stepIssues.push('Role category is required.')
    if (!state.workMode.trim()) stepIssues.push('Location type is required.')
    if ((state.workMode === 'hybrid' || state.workMode === 'on-site') && (!state.locationCity.trim() || !state.locationState.trim())) {
      stepIssues.push('City and state are required for hybrid/in-person roles.')
    }
    if ((state.applyMode === 'ats_link' || state.applyMode === 'hybrid') && !isValidExternalUrl(state.externalApplyUrl)) {
      stepIssues.push('ATS Link/Hybrid requires a valid https URL.')
    }
    const step1Valid = stepIssues.length === 0

    const payMin = Number(state.payMin)
    const payMax = Number(state.payMax)
    const hoursMin = Number(state.hoursMin)
    const hoursMax = Number(state.hoursMax)
    const durationWeeks = Number(state.durationWeeks)

    const step2Issues: string[] = []
    if (!Number.isFinite(payMin) || !Number.isFinite(payMax) || payMin < 0 || payMax < payMin) {
      step2Issues.push('Pay range must be valid (min >= 0 and max >= min).')
    }
    if (!Number.isFinite(hoursMin) || !Number.isFinite(hoursMax) || hoursMin < 1 || hoursMax < hoursMin || hoursMax > 80) {
      step2Issues.push('Hours range must be between 1-80 with min <= max.')
    }
    if (!Number.isFinite(durationWeeks) || durationWeeks < 1) {
      step2Issues.push('Duration must be at least 1 week.')
    }
    if (!derivedRange.startMonth || !derivedRange.endMonth) {
      step2Issues.push('Start date or duration is invalid.')
    }
    const step2Valid = step2Issues.length === 0

    const step3Warnings: string[] = []
    if (requiredSkillLabels.length === 0) {
      step3Warnings.push('Add at least one required skill for better matching quality.')
    }

    const step4Issues: string[] = []
    if (!state.shortSummary.trim()) step4Issues.push('Short summary is required.')
    if (state.shortSummary.length > 200) step4Issues.push('Short summary must be 200 characters or fewer.')
    if (parseBullets(state.responsibilities).length === 0) step4Issues.push('Add at least one responsibility.')
    if (parseBullets(state.qualifications).length === 0) step4Issues.push('Add at least one qualification.')
    const step4Valid = step4Issues.length === 0

    return {
      step1: { valid: step1Valid, issues: stepIssues },
      step2: { valid: step2Valid, issues: step2Issues },
      step3: { valid: true, issues: step3Warnings },
      step4: { valid: step4Valid, issues: step4Issues },
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
    state.qualifications,
    state.responsibilities,
    state.shortSummary,
    state.title,
    state.workMode,
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
    setSavedAt(now)
    void postAnalyticsEvent('employer_listing_draft_saved', { step, draft_key: props.draftKey, autosave: true })
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void persistDraft()
    }, 900)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, requiredSkillLabels, preferredSkillLabels, majorLabels, courseworkCategoryLabels, step])

  const onNext = () => {
    if (!isCurrentStepValid) return
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1))
  }

  const onBack = () => {
    setStep((prev) => Math.max(1, prev - 1))
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <ListingProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

          <div>
            <label className="text-sm font-medium text-slate-700">Use template</label>
            <select
              value={templateKey}
              onChange={(event) => applyTemplate(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            >
              <option value="">Start from scratch</option>
              {EMPLOYER_LISTING_TEMPLATES.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>

          <form
            id={props.formId}
            ref={formRef}
            action={props.formAction}
            onSubmit={() => setSubmitted(true)}
            className="space-y-4"
          >
            <input type="hidden" name="internship_id" value={props.internshipId} />
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

            {step === 1 ? (
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
                onChange={updateState}
              />
            ) : null}

            {step === 2 ? (
              <>
                <ListingStepPayTime
                  payType={state.payType}
                  payMin={state.payMin}
                  payMax={state.payMax}
                  hoursMin={state.hoursMin}
                  hoursMax={state.hoursMax}
                  durationWeeks={state.durationWeeks}
                  startDate={state.startDate}
                  applicationDeadline={state.applicationDeadline}
                  onChange={updateState}
                />
                <p className="text-xs text-slate-500">
                  Listings with pay + hours filled get more qualified applicants.
                </p>
              </>
            ) : null}

            {step === 3 ? (
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
            ) : null}

            {step === 4 ? (
              <ListingStepDescription
                shortSummary={state.shortSummary}
                responsibilities={state.responsibilities}
                qualifications={state.qualifications}
                screeningQuestion={state.screeningQuestion}
                onChange={updateState}
              />
            ) : null}

            {currentIssues.length > 0 ? (
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  step === 3 ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {currentIssues[0]}
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
                    disabled={!isCurrentStepValid}
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
                        void postAnalyticsEvent('employer_listing_draft_saved', {
                          draft_key: props.draftKey,
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
                      onClick={() => {
                        void postAnalyticsEvent('employer_listing_published', { draft_key: props.draftKey })
                      }}
                      disabled={!stepValidation.step4.valid}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {props.internshipId ? 'Update & publish' : 'Publish internship'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {props.showTurnstile && step === TOTAL_STEPS ? <TurnstileWidget action="create_internship" fieldName="turnstile_token" /> : null}
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
              responsibilities={state.responsibilities}
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
          responsibilities={state.responsibilities}
          qualifications={state.qualifications}
          applyMode={state.applyMode}
          externalApplyUrl={state.externalApplyUrl}
          requiredSkills={previewRequiredSkills}
          preferredSkills={previewPreferredSkills}
          majors={previewMajors}
        />
      </div>
    </div>
  )
}
