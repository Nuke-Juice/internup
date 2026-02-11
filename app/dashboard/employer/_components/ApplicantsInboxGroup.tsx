type Applicant = {
  id: string
  applicationId: string
  studentId: string
  applicantName: string
  university: string
  major: string
  graduationYear: string
  appliedAt: string | null
  matchScore: number | null
  topReasons: string[]
  readinessLabel?: string | null
  resumeUrl: string | null
  status: 'submitted' | 'reviewing' | 'interview' | 'rejected' | 'accepted'
  notes: string | null
}

type Props = {
  internshipId: string
  internshipTitle: string
  applicants: Applicant[]
  onUpdate: (formData: FormData) => Promise<void>
  showMatchScore: boolean
  showReasons: boolean
  showReadiness: boolean
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function statusClass(status: Applicant['status']) {
  const map: Record<Applicant['status'], string> = {
    submitted: 'border-slate-200 bg-slate-50 text-slate-700',
    reviewing: 'border-blue-200 bg-blue-50 text-blue-700',
    interview: 'border-blue-200 bg-blue-50 text-blue-700',
    rejected: 'border-slate-200 bg-slate-100 text-slate-700',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
  return map[status]
}

export default function ApplicantsInboxGroup({
  internshipId,
  internshipTitle,
  applicants,
  onUpdate,
  showMatchScore,
  showReasons,
  showReadiness,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{internshipTitle || 'Internship'}</div>
        <div className="mt-1 text-xs text-slate-500">{applicants.length} applicant(s)</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Applicant</th>
              <th className="px-4 py-3 font-medium">Applied</th>
              {showMatchScore ? <th className="px-4 py-3 font-medium">Match</th> : null}
              {showReasons ? <th className="px-4 py-3 font-medium">Reasons</th> : null}
              {showReadiness ? <th className="px-4 py-3 font-medium">Readiness</th> : null}
              <th className="px-4 py-3 font-medium">Resume</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant) => (
              <tr key={applicant.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{applicant.applicantName}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {applicant.university} • {applicant.major} • {applicant.graduationYear}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(applicant.appliedAt)}</td>
                {showMatchScore ? (
                  <td className="px-4 py-3 text-slate-900">
                    {typeof applicant.matchScore === 'number' ? applicant.matchScore : '—'}
                  </td>
                ) : null}
                {showReasons ? (
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {applicant.topReasons.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {applicant.topReasons.map((reason) => (
                          <li key={`${applicant.id}-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
                {showReadiness ? (
                  <td className="px-4 py-3 text-xs text-slate-700">{applicant.readinessLabel ?? 'Baseline'}</td>
                ) : null}
                <td className="px-4 py-3">
                  {applicant.resumeUrl ? (
                    <a
                      href={applicant.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      View resume
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">No resume</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(applicant.status)}`}>
                    {applicant.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[220px] whitespace-pre-wrap text-xs text-slate-700">
                    {applicant.notes?.trim() ? applicant.notes : '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <form action={onUpdate} className="space-y-2">
                    <input type="hidden" name="application_id" value={applicant.applicationId} />
                    <input type="hidden" name="internship_id" value={internshipId} />
                    <select
                      name="status"
                      defaultValue={applicant.status}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    >
                      <option value="submitted">submitted</option>
                      <option value="reviewing">reviewing</option>
                      <option value="interview">interview</option>
                      <option value="rejected">rejected</option>
                      <option value="accepted">accepted</option>
                    </select>
                    <textarea
                      name="notes"
                      defaultValue={applicant.notes ?? ''}
                      rows={2}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400"
                      placeholder="Add note (optional)"
                    />
                    <button
                      type="submit"
                      className="inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
