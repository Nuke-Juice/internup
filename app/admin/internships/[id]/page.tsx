import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { INTERNSHIP_CATEGORIES, type InternshipCategory } from '@/lib/admin/internshipTemplates'
import { canCreateCanonicalItems } from '@/lib/catalog/canCreateCanonicalItems'
import { normalizeCatalogLabel, normalizeCatalogToken, slugifyCatalogLabel } from '@/lib/catalog/normalization'
import { mapCourseworkTextToCategories } from '@/lib/coursework/mapCourseworkCategories'
import { normalizeCoursework } from '@/lib/coursework/normalizeCoursework'
import { getGraduationYearOptions } from '@/lib/internships/formOptions'
import {
  deriveTermFromRange,
  getEndYearOptions,
  getMonthOptions,
  getStartYearOptions,
  inferRangeFromTerm,
} from '@/lib/internships/term'
import { isVerifiedCityForState, normalizeStateCode } from '@/lib/locations/usLocationCatalog'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeSkills } from '@/lib/skills/normalizeSkills'
import { sanitizeSkillLabels } from '@/lib/skills/sanitizeSkillLabels'
import { requireVerifiedEmail } from '@/lib/auth/emailVerification'
import { validateListingForPublish } from '@/lib/listings/validateListingForPublish'
import InternshipLocationFields from '@/components/forms/InternshipLocationFields'
import CatalogMultiSelect from '../_components/CatalogMultiSelect'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ error?: string; success?: string }>

type EmployerOption = {
  user_id: string
  company_name: string | null
}
type CatalogSkillItem = { id: string; label: string | null }
type CatalogCourseworkItem = { id: string; name: string | null }
type CourseworkCategoryItem = { id: string; name: string | null }

function normalizeSource(value: string | null | undefined) {
  if (value === 'concierge' || value === 'partner') return value
  return 'employer_self'
}

function normalizeExperience(value: string | null | undefined) {
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

function isValidCategory(value: string | null): value is InternshipCategory {
  return typeof value === 'string' && (INTERNSHIP_CATEGORIES as readonly string[]).includes(value)
}

function buildLocation(city: string, state: string, workMode: string, remoteEligibility: string) {
  if (workMode === 'remote' && !city && !state) {
    return remoteEligibility ? `Remote (${remoteEligibility})` : 'Remote'
  }
  if (city && state) return `${city}, ${state}`
  if (city) return city
  if (state) return state
  return workMode === 'remote' ? (remoteEligibility ? `Remote (${remoteEligibility})` : 'Remote') : null
}

function validatePublishInput(params: {
  title: string
  employerId: string
  category: string | null
  workMode: string
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  hoursPerWeekMin: number | null
  hoursPerWeekMax: number | null
  payMinHourly: number | null
  payMaxHourly: number | null
  payText: string | null
  majors: string[]
  shortSummary: string
  description: string
  locationCity: string
  locationState: string
}) {
  if (!params.category || !isValidCategory(params.category)) return 'Category is required to publish'
  const term = deriveTermFromRange(params.startMonth, params.startYear, params.endMonth, params.endYear)
  const publishValidation = validateListingForPublish({
    title: params.title,
    employerId: params.employerId,
    workMode: params.workMode,
    locationCity: params.locationCity,
    locationState: params.locationState,
    payText: params.payText,
    payMinHourly: params.payMinHourly,
    payMaxHourly: params.payMaxHourly,
    hoursMin: params.hoursPerWeekMin,
    hoursMax: params.hoursPerWeekMax,
    term,
    majors: params.majors,
    shortSummary: params.shortSummary,
    description: params.description,
  })
  if (!publishValidation.ok) return publishValidation.code
  if (
    params.locationCity &&
    params.locationState &&
    !isVerifiedCityForState(params.locationCity, params.locationState)
  ) {
    return 'Select a verified city and state combination'
  }
  return null
}

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

export default async function AdminInternshipEditPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: SearchParams
}) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships/[id]' })
  if (!hasSupabaseAdminCredentials()) {
    redirect('/admin/internships?error=Missing+service+role+credentials')
  }

  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const admin = supabaseAdmin()
  const monthOptions = getMonthOptions()
  const startYearOptions = getStartYearOptions()
  const endYearOptions = getEndYearOptions()
  const graduationYearOptions = getGraduationYearOptions()

  const [
    { data: internship },
    { data: employerOptionsData },
    { data: skillCatalogRows },
    { data: courseworkCatalogRows },
    { data: courseworkCategoryRows },
    { data: requiredSkillLinkRows },
    { data: preferredSkillLinkRows },
    { data: courseworkLinkRows },
    { data: courseworkCategoryLinkRows },
  ] = await Promise.all([
    admin
      .from('internships')
      .select(
        'id, title, employer_id, source, is_active, category, experience_level, work_mode, location_city, location_state, remote_allowed, remote_eligibility, pay_min_hourly, pay_max_hourly, hours_per_week_min, hours_per_week_max, short_summary, description, responsibilities, qualifications, majors, term, target_graduation_years, required_skills, preferred_skills, recommended_coursework, apply_deadline, application_deadline, admin_notes, template_used'
      )
      .eq('id', id)
      .maybeSingle(),
    admin.from('employer_profiles').select('user_id, company_name').order('company_name', { ascending: true }).limit(500),
    admin.from('skills').select('id, label').order('label', { ascending: true }).limit(1200),
    admin.from('coursework_items').select('id, name').order('name', { ascending: true }).limit(1200),
    admin.from('coursework_categories').select('id, name').order('name', { ascending: true }).limit(500),
    admin
      .from('internship_required_skill_items')
      .select('skill_id, skill:skills(label)')
      .eq('internship_id', id),
    admin
      .from('internship_preferred_skill_items')
      .select('skill_id, skill:skills(label)')
      .eq('internship_id', id),
    admin
      .from('internship_coursework_items')
      .select('coursework_item_id, coursework:coursework_items(name)')
      .eq('internship_id', id),
    admin
      .from('internship_coursework_category_links')
      .select('category_id, category:coursework_categories(name)')
      .eq('internship_id', id),
  ])

  if (!internship?.id) {
    redirect('/admin/internships?error=Internship+not+found')
  }

  const employerOptions = ((employerOptionsData ?? []) as EmployerOption[]).filter((row) => row.user_id)
  const skillCatalog = ((skillCatalogRows ?? []) as CatalogSkillItem[])
    .filter((row) => row.id && row.label?.trim())
    .map((row) => ({ id: row.id, name: row.label!.trim() }))
  const courseworkCatalog = ((courseworkCatalogRows ?? []) as CatalogCourseworkItem[])
    .filter((row) => row.id && row.name?.trim())
    .map((row) => ({ id: row.id, name: row.name!.trim() }))
  const courseworkCategoriesCatalog = ((courseworkCategoryRows ?? []) as CourseworkCategoryItem[])
    .filter((row) => row.id && row.name?.trim())
    .map((row) => ({ id: row.id, name: row.name!.trim() }))

  const requiredSkillLabels = ((requiredSkillLinkRows ?? []) as Array<{ skill_id: string; skill: { label?: string | null } | null }>)
    .map((row) => (typeof row.skill?.label === 'string' ? row.skill.label.trim() : ''))
    .filter(Boolean)
  const preferredSkillLabels = ((preferredSkillLinkRows ?? []) as Array<{ skill_id: string; skill: { label?: string | null } | null }>)
    .map((row) => (typeof row.skill?.label === 'string' ? row.skill.label.trim() : ''))
    .filter(Boolean)
  const courseworkLabels = ((courseworkLinkRows ?? []) as Array<{ coursework_item_id: string; coursework: { name?: string | null } | null }>)
    .map((row) => (typeof row.coursework?.name === 'string' ? row.coursework.name.trim() : ''))
    .filter(Boolean)
  const courseworkCategoryLabels = (
    (courseworkCategoryLinkRows ?? []) as Array<{ category_id: string; category: { name?: string | null } | null }>
  )
    .map((row) => (typeof row.category?.name === 'string' ? row.category.name.trim() : ''))
    .filter(Boolean)
  const currentTerm = (internship.term ?? '').trim()
  const { startMonth: defaultStartMonth, startYear: defaultStartYear, endMonth: defaultEndMonth, endYear: defaultEndYear } =
    inferRangeFromTerm(currentTerm)
  const selectedGraduationYearSet = new Set<string>(
    (Array.isArray(internship.target_graduation_years) ? internship.target_graduation_years : [])
      .map((year: string) => String(year).trim())
      .filter(Boolean)
  )
  const legacyGraduationYears = Array.from(selectedGraduationYearSet).filter(
    (year) => !graduationYearOptions.includes(year)
  )

  async function updateInternship(formData: FormData) {
    'use server'

    const { user, role } = await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships/[id]' })
    const adminWrite = supabaseAdmin()

    const internshipId = String(formData.get('internship_id') ?? '').trim()
    const updateMode = String(formData.get('update_mode') ?? 'publish')
    const isDraft = updateMode === 'draft'
    const title = String(formData.get('title') ?? '').trim()
    const employerId = String(formData.get('employer_id') ?? '').trim()
    const source = normalizeSource(String(formData.get('source') ?? '').trim())
    const category = String(formData.get('category') ?? '').trim() || null
    const experienceLevel = normalizeExperience(String(formData.get('experience_level') ?? '').trim())
    const workMode = String(formData.get('work_mode') ?? '').trim().toLowerCase()
    const locationCity = String(formData.get('location_city') ?? '').trim()
    const locationState = normalizeStateCode(String(formData.get('location_state') ?? ''))
    const remoteAllowed = workMode === 'remote'
    const remoteEligibility = String(formData.get('remote_eligibility') ?? '').trim()
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
    const shortSummary = String(formData.get('short_summary') ?? '').trim()
    const adminNotes = String(formData.get('admin_notes') ?? '').trim() || null
    const templateUsed = String(formData.get('template_used') ?? '').trim() || null
    const payString =
      payMinHourly !== null || payMaxHourly !== null
        ? `$${payMinHourly ?? payMaxHourly ?? 0}-${payMaxHourly ?? payMinHourly ?? 0}/hr`
        : null

    const publishError = isDraft
      ? null
      : validatePublishInput({
          title,
          employerId,
          category,
          workMode,
          startMonth,
          startYear,
          endMonth,
          endYear,
          hoursPerWeekMin,
          hoursPerWeekMax,
          payMinHourly,
          payMaxHourly,
          payText: payString,
          majors,
          shortSummary,
          description,
          locationCity,
          locationState,
        })
    if (publishError) {
      redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(publishError)}`)
    }

    if (!isDraft) {
      const verificationGate = requireVerifiedEmail({
        user,
        nextUrl: `/admin/internships/${internshipId}`,
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
      redirect(`/admin/internships/${internshipId}?error=Employer+profile+not+found`)
    }

    const location = buildLocation(locationCity, locationState, workMode, remoteEligibility)

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
          targetSet.add(inserted.label ?? label)
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
        ...((mappedCategoryRows ?? [])
          .map((row: { category_id: string | null }) => row.category_id)
          .filter((value: string | null): value is string => typeof value === 'string')),
        ...mappedCategoryIdsFromText,
      ])
    )

    const { error } = await adminWrite
      .from('internships')
      .update({
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
        remote_eligibility: remoteEligibility || null,
        location,
        pay_min_hourly: payMinHourly,
        pay_max_hourly: payMaxHourly,
        pay: payString,
        hours_per_week_min: hoursPerWeekMin,
        hours_per_week_max: hoursPerWeekMax,
        hours_min: hoursPerWeekMin,
        hours_max: hoursPerWeekMax,
        hours_per_week: hoursPerWeekMax ?? hoursPerWeekMin ?? null,
        short_summary: shortSummary || null,
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
        work_mode: workMode || null,
        location_type: workMode || null,
      })
      .eq('id', internshipId)

    if (error) {
      redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(error.message)}`)
    }

    const [{ error: deleteRequiredError }, { error: deletePreferredError }, { error: deleteCourseworkError }, { error: deleteCourseworkCategoryError }] = await Promise.all([
      adminWrite.from('internship_required_skill_items').delete().eq('internship_id', internshipId),
      adminWrite.from('internship_preferred_skill_items').delete().eq('internship_id', internshipId),
      adminWrite.from('internship_coursework_items').delete().eq('internship_id', internshipId),
      adminWrite.from('internship_coursework_category_links').delete().eq('internship_id', internshipId),
    ])

    if (deleteRequiredError || deletePreferredError || deleteCourseworkError || deleteCourseworkCategoryError) {
      const message =
        deleteRequiredError?.message ??
        deletePreferredError?.message ??
        deleteCourseworkError?.message ??
        deleteCourseworkCategoryError?.message ??
        'Could not refresh canonical links'
      redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(message)}`)
    }

    if (canonicalRequiredSkillIds.length > 0) {
      const { error: requiredInsertError } = await adminWrite.from('internship_required_skill_items').insert(
        canonicalRequiredSkillIds.map((skillId) => ({
          internship_id: internshipId,
          skill_id: skillId,
        }))
      )
      if (requiredInsertError) {
        redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(requiredInsertError.message)}`)
      }
    }

    if (canonicalPreferredSkillIds.length > 0) {
      const { error: preferredInsertError } = await adminWrite.from('internship_preferred_skill_items').insert(
        canonicalPreferredSkillIds.map((skillId) => ({
          internship_id: internshipId,
          skill_id: skillId,
        }))
      )
      if (preferredInsertError) {
        redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(preferredInsertError.message)}`)
      }
    }

    if (canonicalCourseworkIds.length > 0) {
      const { error: courseworkInsertError } = await adminWrite.from('internship_coursework_items').insert(
        canonicalCourseworkIds.map((courseworkItemId) => ({
          internship_id: internshipId,
          coursework_item_id: courseworkItemId,
        }))
      )
      if (courseworkInsertError) {
        redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(courseworkInsertError.message)}`)
      }
    }

    if (canonicalCourseworkCategoryIds.length > 0) {
      const { error: courseworkCategoryInsertError } = await adminWrite
        .from('internship_coursework_category_links')
        .insert(
          canonicalCourseworkCategoryIds.map((categoryId) => ({
            internship_id: internshipId,
            category_id: categoryId,
          }))
        )
      if (courseworkCategoryInsertError) {
        redirect(`/admin/internships/${internshipId}?error=${encodeURIComponent(courseworkCategoryInsertError.message)}`)
      }
    }

    redirect(`/admin/internships/${internshipId}?success=Internship+updated`)
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto max-w-5xl space-y-4">
        <div>
          <Link
            href="/admin/internships"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Edit internship</h1>
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

        <form action={updateInternship} className="admin-readable grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
          <input type="hidden" name="internship_id" value={internship.id} />

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basics</h2>
            <div>
              <label className="text-xs font-medium text-slate-700">Title</label>
              <input
                name="title"
                defaultValue={internship.title ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Employer</label>
              <select
                name="employer_id"
                defaultValue={internship.employer_id}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              >
                {employerOptions.map((employer) => (
                  <option key={employer.user_id} value={employer.user_id}>
                    {employer.company_name?.trim() || employer.user_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Category</label>
                <select name="category" defaultValue={internship.category ?? ''} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
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
                  defaultValue={normalizeExperience(internship.experience_level)}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                >
                  <option value="entry">entry</option>
                  <option value="mid">mid</option>
                  <option value="senior">senior</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Target majors</label>
                <input
                  name="majors"
                  defaultValue={formatList(internship.majors)}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Source</label>
                <select name="source" defaultValue={normalizeSource(internship.source)} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm">
                  <option value="concierge">concierge</option>
                  <option value="employer_self">employer_self</option>
                  <option value="partner">partner</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700">Work mode</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { value: 'on-site', label: 'On-site' },
                    { value: 'hybrid', label: 'Hybrid' },
                    { value: 'remote', label: 'Remote' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700">
                      <input type="radio" name="work_mode" value={option.value} defaultChecked={(internship.work_mode ?? 'hybrid') === option.value} required />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700">Remote eligibility (optional)</label>
                <input
                  type="text"
                  name="remote_eligibility"
                  defaultValue={internship.remote_eligibility ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  placeholder="e.g., US only, Utah only"
                />
              </div>
            </div>

            <InternshipLocationFields
              defaultCity={internship.location_city ?? ''}
              defaultState={internship.location_state ?? ''}
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Pay min ($/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  name="pay_min_hourly"
                  defaultValue={internship.pay_min_hourly ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Pay max ($/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  name="pay_max_hourly"
                  defaultValue={internship.pay_max_hourly ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Hours/week min</label>
                <input
                  type="number"
                  name="hours_per_week_min"
                  defaultValue={internship.hours_per_week_min ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Hours/week max</label>
                <input
                  type="number"
                  name="hours_per_week_max"
                  defaultValue={internship.hours_per_week_max ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Short summary</label>
              <textarea
                name="short_summary"
                rows={2}
                required
                defaultValue={internship.short_summary ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Description</label>
              <textarea
                name="description"
                rows={5}
                defaultValue={internship.description ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Responsibilities</label>
              <textarea
                name="responsibilities"
                rows={4}
                defaultValue={formatList(internship.responsibilities)}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Qualifications</label>
              <textarea
                name="qualifications"
                rows={4}
                defaultValue={formatList(internship.qualifications)}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Narrative only. Qualifications are not used directly for match scoring.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Start month</label>
              <select
                name="start_month"
                defaultValue={defaultStartMonth}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                required
              >
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
              <select
                name="start_year"
                defaultValue={defaultStartYear}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                required
              >
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
              <select
                name="end_month"
                defaultValue={defaultEndMonth}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                required
              >
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
              <select
                name="end_year"
                defaultValue={defaultEndYear}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                required
              >
                <option value="">Select end year</option>
                {endYearOptions.map((yearOption) => (
                  <option key={`end-year-${yearOption}`} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Target graduation year(s)</label>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-md border border-slate-200 p-2">
                {legacyGraduationYears.map((year) => (
                  <label key={`legacy-${year}`} className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" name="target_graduation_years" value={year} defaultChecked />
                    {year} (legacy)
                  </label>
                ))}
                {graduationYearOptions.map((year) => (
                  <label key={year} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      name="target_graduation_years"
                      value={year}
                      defaultChecked={selectedGraduationYearSet.has(year)}
                    />
                    {year}
                  </label>
                ))}
              </div>
            </div>
            <CatalogMultiSelect
              label="Required skills"
              fieldName="required_skills"
              idsFieldName="required_skill_ids"
              customFieldName="required_skill_custom"
              inputId="required-skills-input"
              options={skillCatalog}
              initialLabels={requiredSkillLabels.length > 0 ? requiredSkillLabels : parseList(formatList(internship.required_skills))}
              helperText="Type to search canonical skills. Enter adds custom text if no match."
            />
            <CatalogMultiSelect
              label="Preferred skills"
              fieldName="preferred_skills"
              idsFieldName="preferred_skill_ids"
              customFieldName="preferred_skill_custom"
              inputId="preferred-skills-input"
              options={skillCatalog}
              initialLabels={preferredSkillLabels.length > 0 ? preferredSkillLabels : parseList(formatList(internship.preferred_skills))}
              helperText="Preferred skills improve ranking but do not hard-filter candidates."
            />
            <CatalogMultiSelect
              label="Recommended coursework categories"
              fieldName="recommended_coursework_categories"
              idsFieldName="recommended_coursework_category_ids"
              customFieldName="recommended_coursework_category_custom"
              inputId="recommended-coursework-category-input"
              options={courseworkCategoriesCatalog}
              initialLabels={
                courseworkCategoryLabels.length > 0
                  ? courseworkCategoryLabels
                  : parseList(formatList(internship.recommended_coursework))
              }
              helperText="Use categories so students from different schools match."
            />
            <CatalogMultiSelect
              label="Specific courses (optional)"
              fieldName="recommended_coursework"
              idsFieldName="recommended_coursework_ids"
              customFieldName="recommended_coursework_custom"
              inputId="recommended-coursework-input"
              options={courseworkCatalog}
              initialLabels={courseworkLabels}
              helperText="Optional course titles for recruiter context. Categories drive matching."
            />
            <div>
              <label className="text-xs font-medium text-slate-700">Apply deadline</label>
              <input
                type="date"
                name="apply_deadline"
                defaultValue={internship.apply_deadline ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Template used</label>
              <input
                name="template_used"
                defaultValue={internship.template_used ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Admin notes</label>
              <textarea
                name="admin_notes"
                rows={3}
                defaultValue={internship.admin_notes ?? ''}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              name="update_mode"
              value="publish"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save and publish active
            </button>
            <button
              type="submit"
              name="update_mode"
              value="draft"
              formNoValidate
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save as draft
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
