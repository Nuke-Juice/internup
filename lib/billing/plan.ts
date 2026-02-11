export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED'

export type EmployerPlanId = 'free' | 'starter' | 'pro'

export type EmployerPlan = {
  id: EmployerPlanId
  name: string
  monthlyPriceCents: number
  maxActiveInternships: number | null
  emailAlertsEnabled: boolean
  valueProp: string
}

export type EmployerPlanFeatures = {
  rankedApplicants: boolean
  matchReasons: boolean
  readinessSignals: boolean
  advancedApplicantFilters: boolean
  priorityPlacementInStudentFeed: boolean
  proEmployerTag: boolean
}

export const EMPLOYER_PLANS: Record<EmployerPlanId, EmployerPlan> = {
  free: {
    id: 'free',
    name: 'Free Employer',
    monthlyPriceCents: 0,
    maxActiveInternships: 1,
    emailAlertsEnabled: false,
    valueProp: 'Start posting with core matching.',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPriceCents: 4900,
    maxActiveInternships: 3,
    emailAlertsEnabled: true,
    valueProp: 'Post more roles and get email alerts.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceCents: 9900,
    maxActiveInternships: 7,
    emailAlertsEnabled: true,
    valueProp: 'For teams actively hiring interns.',
  },
}

export function getEmployerPlan(planId: EmployerPlanId) {
  return EMPLOYER_PLANS[planId]
}

export function isUnlimitedInternships(plan: EmployerPlan) {
  return plan.maxActiveInternships === null
}

export function getRemainingCapacity(plan: EmployerPlan, currentActiveInternships: number) {
  if (plan.maxActiveInternships === null) return null
  return Math.max(0, plan.maxActiveInternships - currentActiveInternships)
}

export function isPlanLimitReachedCode(code: string | null | undefined) {
  return code === PLAN_LIMIT_REACHED
}

const EMPLOYER_PLAN_FEATURES: Record<EmployerPlanId, EmployerPlanFeatures> = {
  free: {
    rankedApplicants: false,
    matchReasons: false,
    readinessSignals: false,
    advancedApplicantFilters: false,
    priorityPlacementInStudentFeed: false,
    proEmployerTag: false,
  },
  starter: {
    rankedApplicants: true,
    matchReasons: true,
    readinessSignals: false,
    advancedApplicantFilters: false,
    priorityPlacementInStudentFeed: false,
    proEmployerTag: false,
  },
  pro: {
    rankedApplicants: true,
    matchReasons: true,
    readinessSignals: true,
    advancedApplicantFilters: true,
    priorityPlacementInStudentFeed: true,
    proEmployerTag: true,
  },
}

export function getEmployerPlanFeatures(planId: EmployerPlanId): EmployerPlanFeatures {
  return EMPLOYER_PLAN_FEATURES[planId]
}
