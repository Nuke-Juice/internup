export const TARGET_STUDENT_YEAR_OPTIONS = ['freshman', 'sophomore', 'junior', 'senior'] as const

export type TargetStudentYear = (typeof TARGET_STUDENT_YEAR_OPTIONS)[number]

export const TARGET_STUDENT_YEAR_LABELS: Record<TargetStudentYear, string> = {
  freshman: 'Freshman',
  sophomore: 'Sophomore',
  junior: 'Junior',
  senior: 'Senior',
}
