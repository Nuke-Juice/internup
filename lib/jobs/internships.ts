import { supabaseServer } from '@/lib/supabase/server'

export type Internship = {
  id: string
  title: string | null
  company_name: string | null
  employer_id: string | null
  employer_verification_tier: 'free' | 'starter' | 'pro' | string | null
  location: string | null
  location_city: string | null
  location_state: string | null
  location_zip: string | null
  location_lat: number | null
  location_lng: number | null
  location_source: 'employer' | 'override' | string | null
  description: string | null
  short_summary: string | null
  remote_eligibility: string | null
  experience_level: string | null
  role_category: string | null
  category: string | null
  work_mode: 'remote' | 'hybrid' | 'on-site' | string | null
  term: string | null
  hours_min: number | null
  hours_max: number | null
  required_skills: string[] | null
  preferred_skills: string[] | null
  recommended_coursework: string[] | null
  target_graduation_years: string[] | null
  internship_required_skill_items:
    | Array<{
        skill_id: string
        skill: {
          id: string
          slug: string
          label: string
          category: string
        } | Array<{
          id: string
          slug: string
          label: string
          category: string
        }> | null
      }>
    | null
  internship_preferred_skill_items:
    | Array<{
        skill_id: string
        skill: {
          id: string
          slug: string
          label: string
          category: string
        } | Array<{
          id: string
          slug: string
          label: string
          category: string
        }> | null
      }>
    | null
  internship_coursework_items:
    | Array<{
        coursework_item_id: string
        coursework: {
          id: string
          name: string
          normalized_name: string
        } | Array<{
          id: string
          name: string
          normalized_name: string
        }> | null
      }>
    | null
  internship_coursework_category_links:
    | Array<{
        category_id: string
        category: {
          id: string
          name: string
          normalized_name: string
        } | Array<{
          id: string
          name: string
          normalized_name: string
        }> | null
      }>
    | null
  required_skill_ids: string[]
  preferred_skill_ids: string[]
  coursework_item_ids: string[]
  coursework_category_ids: string[]
  coursework_category_names: string[]
  resume_required: boolean | null
  application_deadline: string | null
  apply_deadline: string | null
  majors: string[] | string | null
  hours_per_week: number | null
  pay: string | null
  created_at: string | null
  is_active: boolean | null
  source: 'concierge' | 'employer_self' | 'partner' | string | null
}

const INTERNSHIP_SELECT =
  'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, description, short_summary, remote_eligibility, experience_level, role_category, category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, recommended_coursework, target_graduation_years, internship_required_skill_items(skill_id, skill:skills(id, slug, label, category)), internship_preferred_skill_items(skill_id, skill:skills(id, slug, label, category)), internship_coursework_items(coursework_item_id, coursework:coursework_items(id, name, normalized_name)), internship_coursework_category_links(category_id, category:coursework_categories(id, name, normalized_name)), resume_required, application_deadline, apply_deadline, majors, hours_per_week, pay, created_at, is_active, source'
const INTERNSHIP_SELECT_BASE =
  'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, description, short_summary, remote_eligibility, experience_level, role_category, category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, recommended_coursework, target_graduation_years, resume_required, application_deadline, apply_deadline, majors, hours_per_week, pay, created_at, is_active, source'
const INTERNSHIP_SELECT_LEGACY =
  'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, description, experience_level, role_category, category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, recommended_coursework, target_graduation_years, resume_required, application_deadline, apply_deadline, majors, hours_per_week, pay, created_at, is_active, source'

export async function fetchInternships(options?: { limit?: number }) {
  const supabase = await supabaseServer()
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase
    .from('internships')
    .select(INTERNSHIP_SELECT)
    .eq('is_active', true)
    .or(`application_deadline.is.null,application_deadline.gte.${today}`)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  let rows =
    (data ?? []) as unknown as Array<
      Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids' | 'coursework_item_ids' | 'coursework_category_ids' | 'coursework_category_names'>
    >

  if (error) {
    console.error('[jobs] fetchInternships rich query failed; retrying with base fields', error.message)
    let fallbackQuery = supabase
      .from('internships')
      .select(INTERNSHIP_SELECT_BASE)
      .eq('is_active', true)
      .or(`application_deadline.is.null,application_deadline.gte.${today}`)
      .order('created_at', { ascending: false })

    if (options?.limit) {
      fallbackQuery = fallbackQuery.limit(options.limit)
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery
    if (fallbackError) {
      console.error('[jobs] fetchInternships base query failed', fallbackError.message)

      const missingColumn = fallbackError.message.toLowerCase().includes('does not exist')
      if (!missingColumn) {
        return []
      }

      let legacyQuery = supabase
        .from('internships')
        .select(INTERNSHIP_SELECT_LEGACY)
        .eq('is_active', true)
        .or(`application_deadline.is.null,application_deadline.gte.${today}`)
        .order('created_at', { ascending: false })

      if (options?.limit) {
        legacyQuery = legacyQuery.limit(options.limit)
      }

      const { data: legacyData, error: legacyError } = await legacyQuery
      if (legacyError) {
        console.error('[jobs] fetchInternships legacy query failed', legacyError.message)
        return []
      }

      rows =
        (legacyData ?? []) as unknown as Array<
          Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids' | 'coursework_item_ids' | 'coursework_category_ids' | 'coursework_category_names'>
        >
      return rows.map((row) => ({
        ...row,
        short_summary: row.short_summary ?? null,
        remote_eligibility: row.remote_eligibility ?? null,
        required_skill_ids: (row.internship_required_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((item): item is string => typeof item === 'string'),
        preferred_skill_ids: (row.internship_preferred_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((item): item is string => typeof item === 'string'),
        coursework_item_ids: (row.internship_coursework_items ?? [])
          .map((item) => item.coursework_item_id)
          .filter((item): item is string => typeof item === 'string'),
        coursework_category_ids: (row.internship_coursework_category_links ?? [])
          .map((item) => item.category_id)
          .filter((item): item is string => typeof item === 'string'),
        coursework_category_names: (row.internship_coursework_category_links ?? [])
          .map((item) => {
            const category = item.category as { name?: string | null } | Array<{ name?: string | null }> | null
            if (Array.isArray(category)) return typeof category[0]?.name === 'string' ? category[0].name : ''
            return typeof category?.name === 'string' ? category.name : ''
          })
          .filter((item): item is string => typeof item === 'string' && item.length > 0),
      }))
    }

    rows =
      (fallbackData ?? []) as unknown as Array<
        Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids' | 'coursework_item_ids' | 'coursework_category_ids' | 'coursework_category_names'>
      >
  }

  return rows.map((row) => ({
    ...row,
    short_summary: row.short_summary ?? null,
    remote_eligibility: row.remote_eligibility ?? null,
    required_skill_ids: (row.internship_required_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((item): item is string => typeof item === 'string'),
    preferred_skill_ids: (row.internship_preferred_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((item): item is string => typeof item === 'string'),
    coursework_item_ids: (row.internship_coursework_items ?? [])
      .map((item) => item.coursework_item_id)
      .filter((item): item is string => typeof item === 'string'),
    coursework_category_ids: (row.internship_coursework_category_links ?? [])
      .map((item) => item.category_id)
      .filter((item): item is string => typeof item === 'string'),
    coursework_category_names: (row.internship_coursework_category_links ?? [])
      .map((item) => {
        const category = item.category as { name?: string | null } | Array<{ name?: string | null }> | null
        if (Array.isArray(category)) return typeof category[0]?.name === 'string' ? category[0].name : ''
        return typeof category?.name === 'string' ? category.name : ''
      })
      .filter((item): item is string => typeof item === 'string' && item.length > 0),
  }))
}

export function formatMajors(value: Internship['majors']) {
  if (!value) return null
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export function getInternshipType(hoursPerWeek: number | null) {
  return typeof hoursPerWeek === 'number' && hoursPerWeek <= 20 ? 'part-time' : 'internship'
}
