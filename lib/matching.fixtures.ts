import type { InternshipMatchInput, StudentMatchProfile } from './matching'

export const mockStudents: Array<{ id: string; name: string; profile: StudentMatchProfile }> = [
  {
    id: 'student_1',
    name: 'Finance student (Summer, 20h)',
    profile: {
      majors: ['finance'],
      skills: ['excel', 'financial modeling', 'powerpoint'],
      coursework: ['valuation', 'accounting'],
      availability_hours_per_week: 20,
      preferred_terms: ['summer'],
      preferred_work_modes: ['hybrid', 'remote'],
      preferred_locations: ['new york', 'boston'],
    },
  },
  {
    id: 'student_2',
    name: 'Data student (Fall, remote-only)',
    profile: {
      majors: ['data science', 'statistics'],
      skills: ['sql', 'python', 'tableau'],
      coursework: ['machine learning', 'database systems'],
      availability_hours_per_week: 30,
      preferred_terms: ['fall'],
      preferred_work_modes: ['remote'],
      remote_only: true,
    },
  },
]

export const mockInternships: InternshipMatchInput[] = [
  {
    id: 'internship_finance_1',
    title: 'Private Equity Summer Analyst',
    majors: ['finance', 'accounting'],
    hours_per_week: 20,
    location: 'New York, NY (Hybrid)',
    description:
      'Work on live deal support.\nCategory: Finance\nSeason: Summer 2026\nRequired skills: excel, financial modeling\nPreferred skills: powerpoint, accounting',
  },
  {
    id: 'internship_data_1',
    title: 'Data Analytics Intern',
    majors: ['data science', 'computer science'],
    hours_per_week: 25,
    location: 'Remote (Remote)',
    description:
      'Build weekly dashboards.\nCategory: Data\nSeason: Fall 2026\nRequired skills: sql, python\nPreferred skills: tableau, experimentation',
  },
  {
    id: 'internship_ops_1',
    title: 'Operations Intern',
    majors: ['operations', 'business'],
    hours_per_week: 35,
    location: 'Chicago, IL (On-site)',
    description:
      'Support fulfillment projects.\nCategory: Operations\nSeason: Summer 2026\nRequired skills: excel\nPreferred skills: communication',
  },
]
