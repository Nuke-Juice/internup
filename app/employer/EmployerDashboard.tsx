'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Posting = {
  id: string
  title: string
  deadline: string
  location: string
  pay: string
}

type Applicant = {
  postingId: string
  name: string
  major: string
  experience: 'None' | 'Projects' | 'Internship'
  verified: boolean
  status: 'submitted' | 'viewed' | 'interview' | 'accepted' | 'rejected'
}

const mockEmployerInternships: Posting[] = [
  { id: 'p1', title: 'Finance Intern', deadline: 'Mar 15, 2026', location: 'In-person (SLC)', pay: '$18/hr' },
  { id: 'p2', title: 'Data Analyst Intern', deadline: 'Apr 1, 2026', location: 'Remote', pay: '$22/hr' },
  { id: 'p3', title: 'Operations Intern', deadline: 'Mar 25, 2026', location: 'Hybrid', pay: '$20/hr' },
]

const mockApplicants: Applicant[] = [
  { postingId: 'p1', name: 'Alex E.', major: 'Finance', experience: 'Projects', verified: true, status: 'submitted' },
  { postingId: 'p1', name: 'Jordan S.', major: 'Accounting', experience: 'None', verified: false, status: 'viewed' },
  { postingId: 'p2', name: 'Sam P.', major: 'Information Systems', experience: 'Internship', verified: true, status: 'interview' },
  { postingId: 'p2', name: 'Taylor R.', major: 'Computer Science', experience: 'Projects', verified: false, status: 'submitted' },
  { postingId: 'p3', name: 'Morgan K.', major: 'Operations', experience: 'Internship', verified: true, status: 'accepted' },
]

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  )
}

function StatusPill({ status }: { status: Applicant['status'] }) {
  const map: Record<string, string> = {
    submitted: 'bg-slate-50 text-slate-700 border-slate-200',
    viewed: 'bg-blue-50 text-blue-700 border-blue-200',
    interview: 'bg-blue-50 text-blue-700 border-blue-200',
    accepted: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function EmployerDashboard() {
  const [selectedPostingId, setSelectedPostingId] = useState<string>(mockEmployerInternships[0]?.id ?? '')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [experienceFilter, setExperienceFilter] = useState<'all' | Applicant['experience']>('all')

  const selectedPosting = useMemo(
    () => mockEmployerInternships.find((p) => p.id === selectedPostingId),
    [selectedPostingId]
  )

  const applicantsForPosting = useMemo(() => {
    let rows = mockApplicants.filter((a) => a.postingId === selectedPostingId)
    if (verifiedOnly) rows = rows.filter((a) => a.verified)
    if (experienceFilter !== 'all') rows = rows.filter((a) => a.experience === experienceFilter)
    return rows
  }, [selectedPostingId, verifiedOnly, experienceFilter])

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              InternUP
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/signup/employer"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Company profile
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employer dashboard</h1>
          <p className="mt-1 text-slate-600">
            Applicants are organized by internship posting for clarity.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Create posting (UI-only) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
            <p className="mt-1 text-sm text-slate-600">
              UI-only for now. This will save to Supabase later.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  placeholder="e.g., Finance Intern"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={5} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Pay</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="$18/hr" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Hours/week</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="20" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Location type</label>
                <select className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm">
                  <option>Remote</option>
                  <option>In-person</option>
                  <option>Hybrid</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Deadline</label>
                <input className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" placeholder="Mar 15, 2026" />
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Publish (demo)
              </button>
            </div>
          </div>

          {/* Postings + scoped applicants */}
          <div className="space-y-6">
            {/* Postings list */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Your postings</h2>
              <p className="mt-1 text-sm text-slate-600">
                Select a posting to view its applicants.
              </p>

              <div className="mt-4 space-y-3">
                {mockEmployerInternships.map((p) => {
                  const selected = p.id === selectedPostingId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPostingId(p.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        selected ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{p.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{p.location} â€¢ {p.pay}</div>
                        </div>
                        <div className="text-sm text-slate-600">Deadline: {p.deadline}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Applicants scoped to selected posting */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Applicants</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedPosting ? (
                      <>
                        For: <span className="font-medium text-slate-900">{selectedPosting.title}</span>
                      </>
                    ) : (
                      'Select a posting to view applicants.'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={verifiedOnly}
                      onChange={(e) => setVerifiedOnly(e.target.checked)}
                    />
                    Verified only
                  </label>

                  <select
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value as 'all' | Applicant['experience'])}
                  >
                    <option value="all">All experience</option>
                    <option value="None">None</option>
                    <option value="Projects">Projects</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {applicantsForPosting.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    No applicants match the current filters.
                  </div>
                ) : (
                  applicantsForPosting.map((a, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-slate-900">{a.name}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {a.major} â€¢ {a.experience}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <StatusPill status={a.status} />
                            {a.verified ? <Pill>Verified</Pill> : <Pill>Not verified</Pill>}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download resume (demo)
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                In the real build, this list comes from the Applications table filtered by internshipId.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
