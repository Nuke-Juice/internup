import Link from 'next/link'

export type ApplicantsSort = 'match_score' | 'applied_at'

type Props = {
  currentSort: ApplicantsSort
}

function buttonClass(active: boolean) {
  return `inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium ${
    active
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`
}

export default function ApplicantsSortControls({ currentSort }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Sort</span>
      <Link href="/dashboard/employer/applicants?sort=match_score" className={buttonClass(currentSort === 'match_score')}>
        Match score
      </Link>
      <Link href="/dashboard/employer/applicants?sort=applied_at" className={buttonClass(currentSort === 'applied_at')}>
        Applied date
      </Link>
    </div>
  )
}
