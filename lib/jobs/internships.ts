import { supabaseServer } from '@/lib/supabase/server'

export type Internship = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  location_city: string | null
  location_state: string | null
  description: string | null
  experience_level: string | null
  role_category: string | null
  work_mode: 'remote' | 'hybrid' | 'on-site' | string | null
  term: string | null
  hours_min: number | null
  hours_max: number | null
  required_skills: string[] | null
  preferred_skills: string[] | null
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
  required_skill_ids: string[]
  preferred_skill_ids: string[]
  resume_required: boolean | null
  application_deadline: string | null
  majors: string[] | string | null
  hours_per_week: number | null
  pay: string | null
  created_at: string | null
}

const INTERNSHIP_SELECT =
  'id, title, company_name, location, location_city, location_state, description, experience_level, role_category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, internship_required_skill_items(skill_id, skill:skills(id, slug, label, category)), internship_preferred_skill_items(skill_id, skill:skills(id, slug, label, category)), resume_required, application_deadline, majors, hours_per_week, pay, created_at'

export async function fetchInternships(options?: { limit?: number }) {
  const supabase = await supabaseServer()
  let query = supabase.from('internships').select(INTERNSHIP_SELECT).order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data } = await query
  const rows = (data ?? []) as unknown as Array<Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids'>>
  return rows.map((row) => ({
    ...row,
    required_skill_ids: (row.internship_required_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((item): item is string => typeof item === 'string'),
    preferred_skill_ids: (row.internship_preferred_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((item): item is string => typeof item === 'string'),
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
