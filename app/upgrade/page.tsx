const mockListings = [
  {
    id: '1',
    title: 'Finance Intern',
    company: 'Canyon Capital',
    pay: '$18/hr',
    hoursPerWeek: 20,
    startDate: 'May 2026',
    deadline: 'Mar 15, 2026',
    readiness: 'Match',
  },
  {
    id: '2',
    title: 'Data Analyst Intern',
    company: 'Wasatch Tech',
    pay: '$22/hr',
    hoursPerWeek: 15,
    startDate: 'Jun 2026',
    deadline: 'Apr 1, 2026',
    readiness: 'Stretch',
  },
  {
    id: '3',
    title: 'Operations Intern',
    company: 'Mountain Logistics',
    pay: '$20/hr',
    hoursPerWeek: 25,
    startDate: 'May 2026',
    deadline: 'Mar 25, 2026',
    readiness: 'Exploratory',
  },
  {
    id: '4',
    title: 'Marketing Intern',
    company: 'Bluebird Media',
    pay: '$17/hr',
    hoursPerWeek: 10,
    startDate: 'Apr 2026',
    deadline: 'Mar 10, 2026',
    readiness: 'Match',
  },
]

const readinessStyles: Record<string, string> = {
  Match: 'border-blue-200 bg-blue-50 text-blue-700',
  Stretch: 'border-slate-200 bg-slate-50 text-slate-700',
  Exploratory: 'border-slate-200 bg-white text-slate-600',
}

export default function DashboardPage() {
  const freeLimit = 10
  const showing = Math.min(mockListings.length, freeLimit)

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <a href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              InternUP
            </a>
          </div>

          <nav className="flex items-center gap-2">
            <a
              href="/applications"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Applications
            </a>
            <a
              href="/upgrade"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Upgrade
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Curated internships</h1>
            <p className="mt-1 text-slate-600">
              Readiness labels are guidance — not judgment.
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/signup/student"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit profile
            </a>
            <a
              href="/upgrade"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upgrade to Verified
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Free accounts can view up to <b>10</b> listings. Verified accounts can view <b>20</b> and get priority review.
          <div className="mt-1 text-xs text-slate-500">
            “Verification improves signal — not outcomes.”
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {mockListings.slice(0, showing).map((l) => (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{l.title}</h3>
                  <p className="text-sm text-slate-600">{l.company}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-medium ${readinessStyles[l.readiness]}`}
                >
                  {l.readiness}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700">
                <div><span className="text-slate-500">Pay:</span> {l.pay}</div>
                <div><span className="text-slate-500">Hours/week:</span> {l.hoursPerWeek}</div>
                <div><span className="text-slate-500">Start:</span> {l.startDate}</div>
                <div><span className="text-slate-500">Deadline:</span> {l.deadline}</div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <a
                  className="text-sm font-medium text-blue-700 hover:underline"
                  href={`/apply/${l.id}`}
                >
                  Apply
                </a>
                <a className="text-sm text-slate-600 hover:underline" href="/applications">
                  Track
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-sm text-slate-500">
          Showing {showing} of {freeLimit} available in the free tier.
        </div>
      </section>
    </main>
  )
}
