import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isVerifiedEmployerStatus } from '@/lib/billing/subscriptions'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import {
  INTERNSHIP_CATEGORIES,
  INTERNSHIP_TEMPLATES,
  INTERNSHIP_TEMPLATE_BY_KEY,
  type InternshipCategory,
} from '@/lib/admin/internshipTemplates'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { canCreateCanonicalItems } from '@/lib/catalog/canCreateCanonicalItems'
import { normalizeCatalogLabel, normalizeCatalogToken, slugifyCatalogLabel } from '@/lib/catalog/normalization'
import { mapCourseworkTextToCategories } from '@/lib/coursework/mapCourseworkCategories'
import { normalizeCoursework } from '@/lib/coursework/normalizeCoursework'
import { getGraduationYearOptions } from '@/lib/internships/formOptions'
import { deriveTermFromRange, getEndYearOptions, getMonthOptions, getStartYearOptions } from '@/lib/internships/term'
import { isVerifiedCityForState, normalizeStateCode } from '@/lib/locations/usLocationCatalog'
import { normalizeSkills } from '@/lib/skills/normalizeSkills'
import { sanitizeSkillLabels } from '@/lib/skills/sanitizeSkillLabels'
import { requireVerifiedEmail } from '@/lib/auth/emailVerification'
import InternshipLocationFields from '@/components/forms/InternshipLocationFields'
import CatalogMultiSelect from './_components/CatalogMultiSelect'
import TemplatePicker from './_components/TemplatePicker'
import EmployerSelectWithCreate from './_components/EmployerSelectWithCreate'

const PAGE_SIZE = 20

type SearchParams = Promise<{
  q?: string
  page?: string
  template?: string
  error?: string
  success?: string
  new_employer_id?: string
}>

type InternshipAdminRow = {
  id: string
  title: string | null
  employer_id: string
  company_name: string | null
  source: 'concierge' | 'employer_self' | 'partner' | string | null
  is_active: boolean | null
  category: string | null
  experience_level: string | null
  apply_deadline: string | null
  required_skills: string[] | null
  preferred_skills: string[] | null
  recommended_coursework: string[] | null
  majors: string[] | string | null
  term: string | null
  target_graduation_years: string[] | null
  hours_per_week: number | null
  location_city: string | null
  location_state: string | null
  remote_allowed: boolean | null
}

type EmployerOption = {
  user_id: string
  company_name: string | null
}

type EmployerUserIdRow = { user_id: string | null }
type CatalogSkillItem = { id: string; label: string | null }
type CatalogCourseworkItem = { id: string; name: string | null }
type CourseworkCategoryItem = { id: string; name: string | null }

function normalizePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return parsed
}

function normalizeSource(value: string | undefined) {
  if (value === 'concierge' || value === 'partner') return value
  return 'employer_self'
}

function isValidCategory(value: string | null): value is InternshipCategory {
  return typeof value === 'string' && (INTERNSHIP_CATEGORIES as readonly string[]).includes(value)
}

function normalizeExperience(value: string | undefined) {
  if (value === 'entry' || value === 'mid' || value === 'senior') return value
  return 'entry'
}

function parseNullableNumber(raw: FormDataEntryValue | null) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNullableInteger(raw: FormDataEntryValue | null) {
  const value = parseNullableNumber(raw)
  if (value === null) return null
  return Math.round(value)
}

function parseList(raw: FormDataEntryValue | null) {
  return String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .flatMap((line) => line.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.join('\n')
  if (typeof value === 'string') return value
  return ''
}

function buildPageHref(params: { q?: string; page: number; template?: string }) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.page > 1) search.set('page', String(params.page))
  if (params.template) search.set('template', params.template)
  const query = search.toString()
  return query ? `/admin/internships?${query}` : '/admin/internships'
}

function toSyntheticEmployerEmail(companyName: string) {
  const slug = slugifyCatalogLabel(companyName) || 'employer'
  return `concierge+${slug}-${crypto.randomUUID().slice(0, 8)}@example.invalid`
}

function buildLocation(city: string, state: string, remoteAllowed: boolean) {
  if (remoteAllowed && !city && !state) return 'Remote'
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (state) return state
  return remoteAllowed ? 'Remote' : null
}

function validatePublishInput(params: {
  title: string
  employerId: string
  category: string | null
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  description: string
  locationCity: string
  locationState: string
  remoteAllowed: boolean
}) {
  if (!params.title) return 'Title is required to publish'
  if (!params.employerId) return 'Employer is required to publish'
  if (!params.category || !isValidCategory(params.category)) return 'Category is required to publish'
  if (!params.startMonth || !params.startYear || !params.endMonth || !params.endYear) {
    return 'Start month/year and end month/year are required to publish'
  }
  if (!params.description) return 'Description is required to publish'
  if (!params.remoteAllowed && !params.locationCity && !params.locationState) {
    return 'Location city/state or remote allowed is required to publish'
  }
  if (params.locationCity && params.locationState && !isVerifiedCityForState(params.locationCity, params.locationState)) {
    return 'Select a verified city and state combination'
  }
  return null
}

function formatDate(value: string | null) {
  if (!value) return 'No deadline'
  return value
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseJsonStringArray(raw: FormDataEntryValue | null) {
  const text = String(raw ?? '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  } catch {
    return []
  }
}

function parseFormStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((item) => String(item).trim())
    .filter(Boolean)
}

export default async function AdminInternshipsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships' })
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Admin internships</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
            Add both in `.env.local`, then restart the dev server.
          </div>
        </section>
      </main>
    )
  }

  const q = (resolvedSearchParams?.q ?? '').trim()
  const page = normalizePage(resolvedSearchParams?.page)
  const selectedTemplateKey = (resolvedSearchParams?.template ?? '').trim()
  const selectedTemplate = INTERNSHIP_TEMPLATE_BY_KEY.get(selectedTemplateKey) ?? null
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const admin = supabaseAdmin()
  const monthOptions = getMonthOptions()
  const startYearOptions = getStartYearOptions()
  const endYearOptions = getEndYearOptions()
  const graduationYearOptions = getGraduationYearOptions()

  const { data: employerOptionsData } = await admin
    .from('employer_profiles')
    .select('user_id, company_name')
    .order('company_name', { ascending: true })
    .limit(500)
  const employerOptions = ((employerOptionsData ?? []) as EmployerOption[]).filter((row) => row.user_id)

  const [{ data: skillCatalogRows }, { data: courseworkCatalogRows }, { data: courseworkCategoryRows }] = await Promise.all([
    admin.from('skills').select('id, label').order('label', { ascending: true }).limit(1200),
    admin.from('coursework_items').select('id, name').order('name', { ascending: true }).limit(1200),
    admin.from('coursework_categories').select('id, name').order('name', { ascending: true }).limit(500),
  ])
  const skillCatalog = ((skillCatalogRows ?? []) as CatalogSkillItem[])
    .filter((row) => row.id && row.label?.trim())
    .map((row) => ({ id: row.id, name: row.label!.trim() }))
  const courseworkCatalog = ((courseworkCatalogRows ?? []) as CatalogCourseworkItem[])
    .filter((row) => row.id && row.name?.trim())
    .map((row) => ({ id: row.id, name: row.name!.trim() }))
  const courseworkCategoriesCatalog = ((courseworkCategoryRows ?? []) as CourseworkCategoryItem[])
    .filter((row) => row.id && row.name?.trim())
    .map((row) => ({ id: row.id, name: row.name!.trim() }))

  let searchEmployerIds: string[] = []
  if (q) {
    const { data: matchingEmployers } = await admin
      .from('employer_profiles')
      .select('user_id')
      .ilike('company_name', `%${q}%`)
      .limit(200)
    searchEmployerIds = ((matchingEmployers ?? []) as EmployerUserIdRow[])
      .map((row) => row.user_id)
      .filter((value): value is string => typeof value === 'string')
  }

  let internshipsQuery = admin
    .from('internships')
    .select(
      'id, title, employer_id, company_name, source, is_active, category, experience_level, apply_deadline, required_skills, preferred_skills, recommended_coursework, majors, term, target_graduation_years, hours_per_week, location_city, location_state, remote_allowed',
      {
      count: 'exact',
      }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    const queryParts = [`title.ilike.%${q}%`, `company_name.ilike.%${q}%`]
    if (searchEmployerIds.length > 0) {
      queryParts.push(`employer_id.in.(${searchEmployerIds.join(',')})`)
    }
    internshipsQuery = internshipsQuery.or(queryParts.join(','))
  }

  const { data: internshipsData, count } = await internshipsQuery
  const internships = (internshipsData ?? []) as InternshipAdminRow[]

  const employerIds = Array.from(new Set(internships.map((row) => row.employer_id)))
  const [{ data: profilesData }, { data: subscriptionsData }, { data: applicationsData }, { data: requiredSkillItems }, { data: preferredSkillItems }] = await Promise.all([
    employerIds.length > 0
      ? admin.from('employer_profiles').select('user_id, company_name').in('user_id', employerIds)
      : Promise.resolve({ data: [] as EmployerOption[] }),
    employerIds.length > 0
      ? admin.from('subscriptions').select('user_id, status').in('user_id', employerIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; status: string | null }> }),
    internships.length > 0
      ? admin.from('applications').select('internship_id').in('internship_id', internships.map((row) => row.id))
      : Promise.resolve({ data: [] as Array<{ internship_id: string }> }),
    internships.length > 0
      ? admin
          .from('internship_required_skill_items')
          .select('internship_id')
          .in('internship_id', internships.map((row) => row.id))
      : Promise.resolve({ data: [] as Array<{ internship_id: string }> }),
    internships.length > 0
      ? admin
          .from('internship_preferred_skill_items')
          .select('internship_id')
          .in('internship_id', internships.map((row) => row.id))
      : Promise.resolve({ data: [] as Array<{ internship_id: string }> }),
  ])

  const companyByEmployerId = new Map(
    ((profilesData ?? []) as EmployerOption[]).map((profile) => [profile.user_id, profile.company_name])
  )
  const verificationByEmployerId = new Map(
    ((subscriptionsData ?? []) as Array<{ user_id: string; status: string | null }>).map((subscription) => [
      subscription.user_id,
      isVerifiedEmployerStatus(subscription.status) ? 'verified' : 'unverified',
    ])
  )

  const applicantsCountByInternshipId = new Map<string, number>()
  for (const row of (applicationsData ?? []) as Array<{ internship_id: string }>) {
    applicantsCountByInternshipId.set(
      row.internship_id,
      (applicantsCountByInternshipId.get(row.internship_id) ?? 0) + 1
    )
  }

  const requiredSkillLinksByInternshipId = new Map<string, number>()
  for (const row of (requiredSkillItems ?? []) as Array<{ internship_id: string }>) {
    requiredSkillLinksByInternshipId.set(
      row.internship_id,
      (requiredSkillLinksByInternshipId.get(row.internship_id) ?? 0) + 1
    )
  }

  const preferredSkillLinksByInternshipId = new Map<string, number>()
  for (const row of (preferredSkillItems ?? []) as Array<{ internship_id: string }>) {
    preferredSkillLinksByInternshipId.set(
      row.internship_id,
      (preferredSkillLinksByInternshipId.get(row.internship_id) ?? 0) + 1
    )
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  async function createInternship(formData: FormData) {
    'use server'

    const { user, role } = await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships' })
    const adminWrite = supabaseAdmin()

    const createMode = String(formData.get('create_mode') ?? 'publish')
    const isDraft = createMode === 'draft'
    const title = String(formData.get('title') ?? '').trim()
    const employerId = String(formData.get('employer_id') ?? '').trim()
    const source = normalizeSource(String(formData.get('source') ?? '').trim())
    const category = String(formData.get('category') ?? '').trim() || null
    const experienceLevel = normalizeExperience(String(formData.get('experience_level') ?? '').trim())
    const locationCity = String(formData.get('location_city') ?? '').trim()
    const locationState = normalizeStateCode(String(formData.get('location_state') ?? ''))
    const remoteAllowed = String(formData.get('remote_allowed') ?? '') === 'on'
    const payMinHourly = parseNullableNumber(formData.get('pay_min_hourly'))
    const payMaxHourly = parseNullableNumber(formData.get('pay_max_hourly'))
    const hoursPerWeekMin = parseNullableInteger(formData.get('hours_per_week_min'))
    const hoursPerWeekMax = parseNullableInteger(formData.get('hours_per_week_max'))
    const description = String(formData.get('description') ?? '').trim()
    const responsibilities = parseList(formData.get('responsibilities'))
    const qualifications = parseList(formData.get('qualifications'))
    const majors = parseList(formData.get('majors'))
    const startMonth = String(formData.get('start_month') ?? '').trim()
    const startYear = String(formData.get('start_year') ?? '').trim()
    const endMonth = String(formData.get('end_month') ?? '').trim()
    const endYear = String(formData.get('end_year') ?? '').trim()
    const term = deriveTermFromRange(startMonth, startYear, endMonth, endYear)
    const targetGraduationYears = parseFormStringArray(formData, 'target_graduation_years')
    const requiredSkills = parseList(formData.get('required_skills'))
    const preferredSkills = parseList(formData.get('preferred_skills'))
    const recommendedCoursework = parseList(formData.get('recommended_coursework'))
    const recommendedCourseworkCategories = parseList(formData.get('recommended_coursework_categories'))
    const selectedRequiredSkillIds = parseJsonStringArray(formData.get('required_skill_ids'))
    const selectedPreferredSkillIds = parseJsonStringArray(formData.get('preferred_skill_ids'))
    const selectedCourseworkIds = parseJsonStringArray(formData.get('recommended_coursework_ids'))
    const selectedCourseworkCategoryIds = parseJsonStringArray(formData.get('recommended_coursework_category_ids'))
    const customRequiredSkills = parseJsonStringArray(formData.get('required_skill_custom'))
    const customPreferredSkills = parseJsonStringArray(formData.get('preferred_skill_custom'))
    const customCoursework = parseJsonStringArray(formData.get('recommended_coursework_custom'))
    const customCourseworkCategories = parseJsonStringArray(formData.get('recommended_coursework_category_custom'))
    const applyDeadline = String(formData.get('apply_deadline') ?? '').trim() || null
    const adminNotes = String(formData.get('admin_notes') ?? '').trim() || null
    const templateUsed = String(formData.get('template_used') ?? '').trim() || null

    const publishError = isDraft
      ? null
      : validatePublishInput({
          title,
          employerId,
          category,
          startMonth,
          startYear,
          endMonth,
          endYear,
          description,
          locationCity,
          locationState,
          remoteAllowed,
        })

    if (publishError) {
      redirect(`/admin/internships?error=${encodeURIComponent(publishError)}`)
    }

    if (!isDraft) {
      const verificationGate = requireVerifiedEmail({
        user,
        nextUrl: '/admin/internships',
        actionName: 'admin_internship_publish',
      })
      if (!verificationGate.ok) {
        redirect(verificationGate.redirectTo)
      }
    }

    const { data: employerProfile } = await adminWrite
      .from('employer_profiles')
      .select('user_id, company_name')
      .eq('user_id', employerId)
      .maybeSingle()

    if (!employerProfile?.user_id) {
      redirect('/admin/internships?error=Employer+profile+not+found')
    }

    const location = buildLocation(locationCity, locationState, remoteAllowed)
    const payString =
      payMinHourly !== null || payMaxHourly !== null
        ? `$${payMinHourly ?? payMaxHourly ?? 0}-${payMaxHourly ?? payMinHourly ?? 0}/hr`
        : null

    const normalizedRequiredSkills = sanitizeSkillLabels(requiredSkills).valid
    const normalizedPreferredSkills = sanitizeSkillLabels(preferredSkills).valid
    const normalizedCoursework = recommendedCoursework.map(normalizeCatalogLabel).filter(Boolean)
    const normalizedCourseworkCategories = recommendedCourseworkCategories.map(normalizeCatalogLabel).filter(Boolean)

    const requiredSkillIds = Array.from(new Set(selectedRequiredSkillIds))
    const preferredSkillIds = Array.from(new Set(selectedPreferredSkillIds))
    const courseworkItemIds = Array.from(new Set(selectedCourseworkIds))
    const courseworkCategoryIds = Array.from(new Set(selectedCourseworkCategoryIds))

    const resolvedRequiredSkillLabels = new Set(normalizedRequiredSkills)
    const resolvedPreferredSkillLabels = new Set(normalizedPreferredSkills)
    const resolvedCourseworkLabels = new Set(normalizedCoursework)
    const resolvedCourseworkCategoryLabels = new Set(normalizedCourseworkCategories)

    const skillRowsById = new Map(skillCatalog.map((item) => [item.id, item.name]))
    for (const id of requiredSkillIds) {
      const label = skillRowsById.get(id)
      if (label) resolvedRequiredSkillLabels.add(label)
    }
    for (const id of preferredSkillIds) {
      const label = skillRowsById.get(id)
      if (label) resolvedPreferredSkillLabels.add(label)
    }
    const courseworkRowsById = new Map(courseworkCatalog.map((item) => [item.id, item.name]))
    for (const id of courseworkItemIds) {
      const label = courseworkRowsById.get(id)
      if (label) resolvedCourseworkLabels.add(label)
    }
    const courseworkCategoryRowsById = new Map(courseworkCategoriesCatalog.map((item) => [item.id, item.name]))
    for (const id of courseworkCategoryIds) {
      const label = courseworkCategoryRowsById.get(id)
      if (label) resolvedCourseworkCategoryLabels.add(label)
    }

    async function ensureSkillsForCustomLabels(labels: string[], targetSet: Set<string>) {
      const normalized = labels.map(normalizeCatalogLabel).filter(Boolean)
      if (normalized.length === 0) return [] as string[]

      const { skillIds: knownSkillIds, unknown } = await normalizeSkills(normalized)
      const customIds = [...knownSkillIds]
      const canCreate = canCreateCanonicalItems(role)

      for (const raw of unknown) {
        const label = normalizeCatalogLabel(raw)
        if (!canCreate) {
          targetSet.add(label)
          continue
        }
        const slug = slugifyCatalogLabel(label)
        const normalizedName = normalizeCatalogToken(label)
        if (!slug || !normalizedName) continue
        const { data: inserted } = await adminWrite
          .from('skills')
          .upsert(
            {
              slug,
              label,
              category: 'general',
              normalized_name: normalizedName,
            },
            { onConflict: 'slug' }
          )
          .select('id, label')
          .maybeSingle()
        if (inserted?.id) {
          customIds.push(inserted.id)
          if (inserted.label) {
            targetSet.add(inserted.label)
          } else {
            targetSet.add(label)
          }
        } else {
          targetSet.add(label)
        }
      }

      return customIds
    }

    async function ensureCourseworkForCustomLabels(labels: string[]) {
      const normalized = labels.map(normalizeCatalogLabel).filter(Boolean)
      if (normalized.length === 0) return [] as string[]

      const { courseworkItemIds: knownIds, unknown } = await normalizeCoursework(normalized)
      const customIds = [...knownIds]
      const canCreate = canCreateCanonicalItems(role)

      for (const raw of unknown) {
        const name = normalizeCatalogLabel(raw)
        if (!canCreate) {
          resolvedCourseworkLabels.add(name)
          continue
        }
        const normalizedName = normalizeCatalogToken(name)
        if (!name || !normalizedName) continue
        const { data: inserted } = await adminWrite
          .from('coursework_items')
          .upsert({ name, normalized_name: normalizedName }, { onConflict: 'normalized_name' })
          .select('id, name')
          .maybeSingle()
        if (inserted?.id) {
          customIds.push(inserted.id)
          resolvedCourseworkLabels.add(inserted.name ?? name)
        } else {
          resolvedCourseworkLabels.add(name)
        }
      }

      return customIds
    }

    async function ensureCourseworkCategoriesForCustomLabels(labels: string[]) {
      const normalized = labels.map(normalizeCatalogLabel).filter(Boolean)
      if (normalized.length === 0) return [] as string[]

      const customIds: string[] = []
      for (const raw of normalized) {
        const name = normalizeCatalogLabel(raw)
        const normalizedName = normalizeCatalogToken(name)
        if (!name || !normalizedName) continue
        const { data: inserted } = await adminWrite
          .from('coursework_categories')
          .upsert({ name, normalized_name: normalizedName }, { onConflict: 'normalized_name' })
          .select('id, name')
          .maybeSingle()
        if (inserted?.id) {
          customIds.push(inserted.id)
          resolvedCourseworkCategoryLabels.add(inserted.name ?? name)
        } else {
          resolvedCourseworkCategoryLabels.add(name)
        }
      }
      return customIds
    }

    const [customRequiredSkillIds, customPreferredSkillIds, customCourseworkIds, customCourseworkCategoryIds] = await Promise.all([
      ensureSkillsForCustomLabels(customRequiredSkills, resolvedRequiredSkillLabels),
      ensureSkillsForCustomLabels(customPreferredSkills, resolvedPreferredSkillLabels),
      ensureCourseworkForCustomLabels(customCoursework),
      ensureCourseworkCategoriesForCustomLabels(customCourseworkCategories),
    ])

    const canonicalRequiredSkillIds = Array.from(new Set([...requiredSkillIds, ...customRequiredSkillIds]))
    const canonicalPreferredSkillIds = Array.from(new Set([...preferredSkillIds, ...customPreferredSkillIds]))
    const canonicalCourseworkIds = Array.from(new Set([...courseworkItemIds, ...customCourseworkIds]))

    const { data: mappedCategoryRows } =
      canonicalCourseworkIds.length > 0
        ? await adminWrite
            .from('coursework_item_category_map')
            .select('category_id')
            .in('coursework_item_id', canonicalCourseworkIds)
        : { data: [] as Array<{ category_id: string }> }

    const { categoryIds: mappedCategoryIdsFromText } = await mapCourseworkTextToCategories([
      ...Array.from(resolvedCourseworkLabels),
      ...Array.from(resolvedCourseworkCategoryLabels),
    ])

    const canonicalCourseworkCategoryIds = Array.from(
      new Set([
        ...courseworkCategoryIds,
        ...customCourseworkCategoryIds,
        ...(mappedCategoryRows ?? [])
          .map((row: { category_id: string | null }) => row.category_id)
          .filter((value: string | null): value is string => typeof value === 'string'),
        ...mappedCategoryIdsFromText,
      ])
    )

    const { data: insertedInternship, error } = await adminWrite
      .from('internships')
      .insert({
      title: title || null,
      employer_id: employerId,
      company_name: employerProfile.company_name ?? null,
      source,
      is_active: !isDraft,
      category,
      role_category: category,
      experience_level: experienceLevel,
      location_city: locationCity || null,
      location_state: locationState || null,
      remote_allowed: remoteAllowed,
      location,
      pay_min_hourly: payMinHourly,
      pay_max_hourly: payMaxHourly,
      pay: payString,
      hours_per_week_min: hoursPerWeekMin,
      hours_per_week_max: hoursPerWeekMax,
      hours_min: hoursPerWeekMin,
      hours_max: hoursPerWeekMax,
      hours_per_week: hoursPerWeekMax ?? hoursPerWeekMin ?? null,
      description: description || null,
      majors: majors.length > 0 ? majors : null,
      term,
      target_graduation_years: targetGraduationYears.length > 0 ? targetGraduationYears : null,
      responsibilities: responsibilities.length > 0 ? responsibilities : null,
      qualifications: qualifications.length > 0 ? qualifications : null,
      required_skills: resolvedRequiredSkillLabels.size > 0 ? Array.from(resolvedRequiredSkillLabels) : null,
      preferred_skills: resolvedPreferredSkillLabels.size > 0 ? Array.from(resolvedPreferredSkillLabels) : null,
      recommended_coursework:
        resolvedCourseworkCategoryLabels.size > 0
          ? Array.from(resolvedCourseworkCategoryLabels)
          : resolvedCourseworkLabels.size > 0
            ? Array.from(resolvedCourseworkLabels)
            : null,
      apply_deadline: applyDeadline,
      application_deadline: applyDeadline,
      admin_notes: adminNotes,
      template_used: templateUsed,
      work_mode: remoteAllowed ? 'remote' : 'on-site',
      location_type: remoteAllowed ? 'remote' : 'on-site',
    })
      .select('id')
      .single()

    if (error) {
      redirect(`/admin/internships?error=${encodeURIComponent(error.message)}`)
    }

    if (insertedInternship?.id) {
      if (canonicalRequiredSkillIds.length > 0) {
        const { error: requiredInsertError } = await adminWrite.from('internship_required_skill_items').insert(
          canonicalRequiredSkillIds.map((skillId) => ({
            internship_id: insertedInternship.id,
            skill_id: skillId,
          }))
        )
        if (requiredInsertError) {
          redirect(`/admin/internships?error=${encodeURIComponent(requiredInsertError.message)}`)
        }
      }
      if (canonicalPreferredSkillIds.length > 0) {
        const { error: preferredInsertError } = await adminWrite.from('internship_preferred_skill_items').insert(
          canonicalPreferredSkillIds.map((skillId) => ({
            internship_id: insertedInternship.id,
            skill_id: skillId,
          }))
        )
        if (preferredInsertError) {
          redirect(`/admin/internships?error=${encodeURIComponent(preferredInsertError.message)}`)
        }
      }
      if (canonicalCourseworkIds.length > 0) {
        const { error: courseworkInsertError } = await adminWrite.from('internship_coursework_items').insert(
          canonicalCourseworkIds.map((courseworkItemId) => ({
            internship_id: insertedInternship.id,
            coursework_item_id: courseworkItemId,
          }))
        )
        if (courseworkInsertError) {
          redirect(`/admin/internships?error=${encodeURIComponent(courseworkInsertError.message)}`)
        }
      }
      if (canonicalCourseworkCategoryIds.length > 0) {
        const { error: courseworkCategoryInsertError } = await adminWrite
          .from('internship_coursework_category_links')
          .insert(
            canonicalCourseworkCategoryIds.map((categoryId) => ({
              internship_id: insertedInternship.id,
              category_id: categoryId,
            }))
          )
        if (courseworkCategoryInsertError) {
          redirect(`/admin/internships?error=${encodeURIComponent(courseworkCategoryInsertError.message)}`)
        }
      }
    }

    redirect('/admin/internships?success=Internship+saved')
  }

  async function createEmployerProfile(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships' })
    const adminWrite = supabaseAdmin()

    const companyName = String(formData.get('company_name') ?? '').trim()
    const website = String(formData.get('website') ?? '').trim()
    const contactEmail = String(formData.get('contact_email') ?? '').trim().toLowerCase()
    const qValue = String(formData.get('q') ?? '').trim()
    const pageValue = normalizePage(String(formData.get('page') ?? '1'))
    const templateValue = String(formData.get('template') ?? '').trim()

    const baseHref = buildPageHref({
      q: qValue || undefined,
      page: pageValue,
      template: templateValue || undefined,
    })

    if (!companyName) {
      redirect(`${baseHref}${baseHref.includes('?') ? '&' : '?'}error=Company+name+is+required`)
    }
    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
      redirect(`${baseHref}${baseHref.includes('?') ? '&' : '?'}error=Contact+email+must+be+a+valid+email+address`)
    }

    const syntheticAuthEmail = toSyntheticEmployerEmail(companyName)
    const tempPassword = `${crypto.randomUUID()}!A1`
    const { data: createdAuthUser, error: authCreateError } = await adminWrite.auth.admin.createUser({
      email: syntheticAuthEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        concierge_placeholder: true,
        source: 'admin_new_employer',
      },
    })
    if (authCreateError || !createdAuthUser.user?.id) {
      const message = authCreateError?.message ?? 'Could not create placeholder auth user'
      redirect(`${baseHref}${baseHref.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`)
    }

    const employerId = createdAuthUser.user.id

    const { error: userInsertError } = await adminWrite.from('users').insert({
      id: employerId,
      role: 'employer',
      verified: false,
    })
    if (userInsertError) {
      redirect(`${baseHref}${baseHref.includes('?') ? '&' : '?'}error=${encodeURIComponent(userInsertError.message)}`)
    }

    const { error: profileInsertError } = await adminWrite.from('employer_profiles').insert({
      user_id: employerId,
      company_name: companyName,
      website: website || null,
      contact_email: contactEmail || syntheticAuthEmail,
      industry: 'Unknown',
      location: 'Unknown',
    })

    if (profileInsertError) {
      redirect(`${baseHref}${baseHref.includes('?') ? '&' : '?'}error=${encodeURIComponent(profileInsertError.message)}`)
    }

    redirect(
      `${baseHref}${baseHref.includes('?') ? '&' : '?'}success=Employer+created&new_employer_id=${encodeURIComponent(employerId)}`
    )
  }

  async function toggleActive(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships' })
    const adminWrite = supabaseAdmin()

    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const nextActive = String(formData.get('next_active') ?? '') === 'true'
    const qValue = String(formData.get('q') ?? '').trim()
    const pageValue = normalizePage(String(formData.get('page') ?? '1'))
    const templateValue = String(formData.get('template') ?? '').trim()

    if (!internshipId) {
      redirect('/admin/internships?error=Missing+internship+id')
    }

    const { error } = await adminWrite
      .from('internships')
      .update({ is_active: nextActive })
      .eq('id', internshipId)

    if (error) {
      redirect(`/admin/internships?error=${encodeURIComponent(error.message)}`)
    }

    const href = buildPageHref({
      q: qValue || undefined,
      page: pageValue,
      template: templateValue || undefined,
    })
    redirect(`${href}${href.includes('?') ? '&' : '?'}success=Internship+status+updated`)
  }

  const defaultResponsibilities = formatList(selectedTemplate?.responsibilities)
  const defaultQualifications = formatList(selectedTemplate?.qualifications)
  const defaultRequiredSkills = formatList(selectedTemplate?.required_skills)
  const defaultPreferredSkills = formatList(selectedTemplate?.preferred_skills)
  const defaultRecommendedCourseworkCategories = formatList(selectedTemplate?.recommended_coursework_categories)

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Admin internships</h1>
            <p className="mt-1 text-sm text-slate-600">
              Concierge-post and manage listings with publish/draft workflow.
            </p>
          </div>
          <a
            href="#create-internship-form"
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            New internship
          </a>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-medium text-slate-800">Quick actions</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href="#manage-internships"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage internships
            </a>
            <Link
              href="/admin/employers"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage employers
            </Link>
            <Link
              href="/admin/students"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Manage student profiles
            </Link>
          </div>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}
        {resolvedSearchParams?.success ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {decodeURIComponent(resolvedSearchParams.success)}
          </div>
        ) : null}

        <div id="create-internship" className="admin-readable rounded-2xl border border-slate-200 bg-white p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-sm font-medium text-slate-800">Template library</div>
            <form method="get" className="flex flex-wrap items-end gap-2">
              {q ? <input type="hidden" name="q" value={q} /> : null}
              {page > 1 ? <input type="hidden" name="page" value={String(page)} /> : null}
              <input type="hidden" name="toast" value="Template selection updated" />
              <input type="hidden" name="toast_type" value="success" />
              <TemplatePicker options={INTERNSHIP_TEMPLATES} selectedTemplateKey={selectedTemplateKey} />
            </form>
          </div>

          <div className="mt-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
              <p className="mt-1 text-xs text-slate-500">
                Pick a template to prefill and publish in under 3 minutes.
              </p>
            </div>
          </div>
          <form id="create-internship-form" action={createInternship} className="mt-3 grid gap-4 lg:grid-cols-12">
            <input type="hidden" name="template_used" value={selectedTemplate?.label ?? ''} />
            <div className="space-y-3 lg:col-span-5">
              <details open className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">Basics</summary>
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Title</label>
                    <input
                      name="title"
                      required
                      defaultValue={selectedTemplate?.title ?? ''}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      placeholder="e.g., Data Analyst Intern"
                    />
                  </div>

                  <div>
                    <EmployerSelectWithCreate
                      employers={employerOptions}
                      selectedEmployerId={resolvedSearchParams?.new_employer_id ?? ''}
                      createEmployerAction={createEmployerProfile}
                      q={q}
                      page={page}
                      template={selectedTemplateKey}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Category</label>
                      <select
                        name="category"
                        defaultValue={selectedTemplate?.category ?? ''}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      >
                        <option value="">Select category</option>
                        {INTERNSHIP_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700">Experience</label>
                      <select
                        name="experience_level"
                        defaultValue={selectedTemplate?.experience_level ?? 'entry'}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      >
                        <option value="entry">entry</option>
                        <option value="mid">mid</option>
                        <option value="senior">senior</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Target majors</label>
                      <input
                        name="majors"
                        defaultValue={selectedTemplate?.category ?? ''}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                        placeholder="e.g., Finance, Accounting"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Source</label>
                      <select
                        name="source"
                        defaultValue="concierge"
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      >
                        <option value="concierge">concierge</option>
                        <option value="employer_self">employer_self</option>
                        <option value="partner">partner</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Pay min ($/hr)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="pay_min_hourly"
                        defaultValue={selectedTemplate?.pay_min_hourly ?? undefined}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Pay max ($/hr)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="pay_max_hourly"
                        defaultValue={selectedTemplate?.pay_max_hourly ?? undefined}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Hours/week min</label>
                      <input
                        type="number"
                        name="hours_per_week_min"
                        defaultValue={selectedTemplate?.hours_per_week_min ?? undefined}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Hours/week max</label>
                      <input
                        type="number"
                        name="hours_per_week_max"
                        defaultValue={selectedTemplate?.hours_per_week_max ?? undefined}
                        className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">Location</summary>
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="remote_allowed" defaultChecked />
                      Remote allowed
                    </label>
                  </div>
                  <InternshipLocationFields />
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">Publishing</summary>
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Start month</label>
                      <select name="start_month" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" required>
                        <option value="">Select start month</option>
                        {monthOptions.map((monthOption) => (
                          <option key={`start-${monthOption}`} value={monthOption}>
                            {monthOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Start year</label>
                      <select name="start_year" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" required>
                        <option value="">Select start year</option>
                        {startYearOptions.map((yearOption) => (
                          <option key={`year-${yearOption}`} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">End month</label>
                      <select name="end_month" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" required>
                        <option value="">Select end month</option>
                        {monthOptions.map((monthOption) => (
                          <option key={`end-${monthOption}`} value={monthOption}>
                            {monthOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">End year</label>
                      <select name="end_year" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" required>
                        <option value="">Select end year</option>
                        {endYearOptions.map((yearOption) => (
                          <option key={`end-year-${yearOption}`} value={yearOption}>
                            {yearOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Target graduation year(s)</label>
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-md border border-slate-200 p-2">
                      {graduationYearOptions.map((year) => (
                        <label key={year} className="flex items-center gap-2 text-xs text-slate-700">
                          <input type="checkbox" name="target_graduation_years" value={year} />
                          {year}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Apply deadline</label>
                    <input type="date" name="apply_deadline" className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Admin notes (private)</label>
                    <textarea
                      name="admin_notes"
                      rows={3}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      name="create_mode"
                      value="publish"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Publish active
                    </button>
                    <button
                      type="submit"
                      name="create_mode"
                      value="draft"
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Save draft
                    </button>
                  </div>
                </div>
              </details>
            </div>

            <div className="space-y-3 lg:col-span-7">
              <details open className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">Details</summary>
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Description</label>
                    <textarea
                      name="description"
                      rows={5}
                      defaultValue={selectedTemplate?.description ?? ''}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                      placeholder="Role overview, team context, impact."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Responsibilities (newline or comma separated)</label>
                    <textarea
                      name="responsibilities"
                      rows={4}
                      defaultValue={defaultResponsibilities}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">Qualifications (newline or comma separated)</label>
                    <textarea
                      name="qualifications"
                      rows={4}
                      defaultValue={defaultQualifications}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Narrative only. Qualifications are not used directly for match scoring.
                    </p>
                  </div>

                  <CatalogMultiSelect
                    label="Required skills"
                    fieldName="required_skills"
                    idsFieldName="required_skill_ids"
                    customFieldName="required_skill_custom"
                    inputId="required-skills-input"
                    options={skillCatalog}
                    initialLabels={parseList(defaultRequiredSkills)}
                    helperText="Type to search canonical skills. Enter adds custom text if no match."
                  />

                  <CatalogMultiSelect
                    label="Preferred skills"
                    fieldName="preferred_skills"
                    idsFieldName="preferred_skill_ids"
                    customFieldName="preferred_skill_custom"
                    inputId="preferred-skills-input"
                    options={skillCatalog}
                    initialLabels={parseList(defaultPreferredSkills)}
                    helperText="Preferred skills improve ranking but do not hard-filter candidates."
                  />

                  <CatalogMultiSelect
                    label="Recommended coursework categories"
                    fieldName="recommended_coursework_categories"
                    idsFieldName="recommended_coursework_category_ids"
                    customFieldName="recommended_coursework_category_custom"
                    inputId="recommended-coursework-category-input"
                    options={courseworkCategoriesCatalog}
                    initialLabels={parseList(defaultRecommendedCourseworkCategories)}
                    helperText="Use categories so students from different schools match."
                  />

                  <CatalogMultiSelect
                    label="Specific courses (optional)"
                    fieldName="recommended_coursework"
                    idsFieldName="recommended_coursework_ids"
                    customFieldName="recommended_coursework_custom"
                    inputId="recommended-coursework-input"
                    options={courseworkCatalog}
                    initialLabels={[]}
                    helperText="Optional course titles for recruiter context. Categories drive matching."
                  />
                </div>
              </details>
            </div>
          </form>
        </div>

        <div id="manage-internships" className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <form method="get" className="flex w-full max-w-lg items-end gap-2">
              <div className="w-full">
                <label className="text-xs font-medium text-slate-700">Search</label>
                <input
                  name="q"
                  defaultValue={q}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  placeholder="Search title or employer"
                />
              </div>
              {selectedTemplateKey ? <input type="hidden" name="template" value={selectedTemplateKey} /> : null}
              <button
                type="submit"
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Search
              </button>
            </form>
            <div className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} total
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Employer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Verification status</th>
                  <th className="px-3 py-2">Match signals</th>
                  <th className="px-3 py-2">Applicants count</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {internships.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                      No internships found.
                    </td>
                  </tr>
                ) : (
                  internships.map((row) => {
                    const employerName = companyByEmployerId.get(row.employer_id) ?? row.company_name ?? 'Unknown employer'
                    const status = row.is_active ? 'active' : 'inactive'
                    const source = normalizeSource(row.source ?? undefined)
                    const verification = verificationByEmployerId.get(row.employer_id) ?? 'unverified'
                    const applicantsCount = applicantsCountByInternshipId.get(row.id) ?? 0
                    const requiredSkillLinks = requiredSkillLinksByInternshipId.get(row.id) ?? 0
                    const preferredSkillLinks = preferredSkillLinksByInternshipId.get(row.id) ?? 0
                    const requiredSkillsCount = row.required_skills?.length ?? 0
                    const preferredSkillsCount = row.preferred_skills?.length ?? 0
                    const courseworkCount = row.recommended_coursework?.length ?? 0
                    const majorsPresent = Array.isArray(row.majors)
                      ? row.majors.length > 0
                      : typeof row.majors === 'string'
                        ? row.majors.trim().length > 0
                        : false
                    const targetGraduationYearsPresent = Array.isArray(row.target_graduation_years)
                      ? row.target_graduation_years.length > 0
                      : false
                    const experiencePresent = Boolean(row.experience_level?.trim())
                    const termPresent = Boolean(row.term?.trim())
                    const hoursPresent = typeof row.hours_per_week === 'number' && row.hours_per_week > 0
                    const locationOrRemotePresent =
                      Boolean(row.remote_allowed) || Boolean(row.location_city?.trim() || row.location_state?.trim())
                    const coverageChecks = [
                      ['majors', majorsPresent] as const,
                      ['target_graduation_years', targetGraduationYearsPresent] as const,
                      ['experience_level', experiencePresent] as const,
                      ['term', termPresent] as const,
                      ['hours_per_week', hoursPresent] as const,
                      ['location/remote', locationOrRemotePresent] as const,
                    ]
                    const coverageMet = coverageChecks.filter(([, present]) => present).length
                    const missingCoverageFields = coverageChecks
                      .filter(([, present]) => !present)
                      .map(([field]) => field)
                    const coverageTooltip =
                      missingCoverageFields.length > 0
                        ? `Missing: ${missingCoverageFields.join(', ')}`
                        : 'All key matching fields present'

                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-3 text-slate-900">
                          <div className="font-medium">{row.title || 'Untitled'}</div>
                          <div className="text-xs text-slate-500">
                            {row.category || 'Uncategorized'} · {row.experience_level || 'n/a'} · {formatDate(row.apply_deadline)}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{employerName}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-slate-300 px-2 py-1 text-xs">{status}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{source}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-slate-300 px-2 py-1 text-xs">{verification}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          <div>Skills: {requiredSkillsCount} required, {preferredSkillsCount} preferred</div>
                          <div>Verified skill links: {requiredSkillLinks + preferredSkillLinks}</div>
                          <div>Recommended coursework: {courseworkCount}</div>
                          <div className="mt-1">
                            <span
                              title={coverageTooltip}
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                coverageMet === 6
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : 'border-amber-300 bg-amber-50 text-amber-700'
                              }`}
                            >
                              Coverage: {coverageMet}/6
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/internships/${row.id}/applicants`}
                            className="text-sm font-medium text-blue-700 hover:underline"
                          >
                            {applicantsCount}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/internships/${row.id}`}
                              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </Link>
                            <form action={toggleActive}>
                              <input type="hidden" name="internship_id" value={row.id} />
                              <input type="hidden" name="q" value={q} />
                              <input type="hidden" name="page" value={String(page)} />
                              <input type="hidden" name="template" value={selectedTemplateKey} />
                              <input type="hidden" name="next_active" value={row.is_active ? 'false' : 'true'} />
                              <button
                                type="submit"
                                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                {row.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              {hasPrev ? (
                <Link
                  href={buildPageHref({
                    q: q || undefined,
                    page: page - 1,
                    template: selectedTemplateKey || undefined,
                  })}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400">Previous</span>
              )}
            </div>
            <div>
              {hasNext ? (
                <Link
                  href={buildPageHref({
                    q: q || undefined,
                    page: page + 1,
                    template: selectedTemplateKey || undefined,
                  })}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400">Next</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
