'use client'

type PreviewProps = {
  title: string
  companyName: string
  category: string
  workMode: string
  locationCity: string
  locationState: string
  payMin: string
  payMax: string
  hoursMin: string
  hoursMax: string
  durationWeeks: string
  shortSummary: string
  responsibilities: string
  qualifications: string
  applyMode: string
  externalApplyUrl: string
  requiredSkills: string[]
  preferredSkills: string[]
  majors: string[]
}

function splitBullets(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

export default function ListingPreviewPanel(props: PreviewProps) {
  const responsibilities = splitBullets(props.responsibilities)
  const qualifications = splitBullets(props.qualifications)
  const locationLabel =
    props.workMode === 'remote'
      ? 'Remote'
      : props.locationCity && props.locationState
        ? `${props.locationCity}, ${props.locationState}`
        : 'Location pending'

  return (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</div>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">{props.title || 'Untitled internship'}</h3>
      <div className="mt-1 text-sm text-slate-600">{props.companyName || 'Your company'}</div>
      <div className="mt-2 text-xs text-slate-600">
        {(props.category || 'Category pending') + ' · ' + locationLabel + ' · ' + (props.workMode || 'mode pending')}
      </div>
      <div className="mt-2 text-xs text-slate-600">
        {`$${props.payMin || '?'}-$${props.payMax || '?'} / hr · ${props.hoursMin || '?'}-${props.hoursMax || '?'} hrs/week · ${props.durationWeeks || '?'} weeks`}
      </div>
      <p className="mt-3 text-sm text-slate-700">{props.shortSummary || 'Add a short summary to show students what this role is about.'}</p>

      {responsibilities.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsibilities</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
            {responsibilities.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {qualifications.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qualifications</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
            {qualifications.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 text-xs text-slate-600">Apply mode: {props.applyMode || 'native'}</div>
      {(props.applyMode === 'ats_link' || props.applyMode === 'hybrid') && props.externalApplyUrl ? (
        <div className="mt-1 break-all text-xs text-slate-600">ATS URL: {props.externalApplyUrl}</div>
      ) : null}

      {props.requiredSkills.length > 0 ? (
        <div className="mt-3 text-xs text-slate-600">Required skills: {props.requiredSkills.slice(0, 6).join(', ')}</div>
      ) : null}
      {props.preferredSkills.length > 0 ? (
        <div className="mt-1 text-xs text-slate-600">Preferred skills: {props.preferredSkills.slice(0, 6).join(', ')}</div>
      ) : null}
      {props.majors.length > 0 ? <div className="mt-1 text-xs text-slate-600">Target majors: {props.majors.slice(0, 5).join(', ')}</div> : null}
    </aside>
  )
}
