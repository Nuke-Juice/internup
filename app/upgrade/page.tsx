import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  createBillingPortalSessionAction,
  startProEmployerCheckoutAction,
  startStarterEmployerCheckoutAction,
} from '@/lib/billing/actions'
import { EMPLOYER_PLANS, getRemainingCapacity, isUnlimitedInternships, type EmployerPlanId } from '@/lib/billing/plan'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import { supabaseServer } from '@/lib/supabase/server'

function formatDate(value: string | null) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function priceLabel(planId: EmployerPlanId) {
  const plan = EMPLOYER_PLANS[planId]
  if (plan.monthlyPriceCents === 0) return '$0/mo'
  if (planId === 'starter') return `$${Math.round(plan.monthlyPriceCents / 100)}`
  return `$${Math.round(plan.monthlyPriceCents / 100)}/mo`
}

const PLAN_FEATURES: Record<EmployerPlanId, string[]> = {
  free: ['Max 1 active internship', 'No email alerts', 'Core matching and applicant inbox'],
  starter: ['Max 3 active internships', 'Email alerts enabled', 'Company profile header image', 'Ranked applicants + match reasons'],
  pro: [
    'Up to 7 active internship postings',
    'Priority placement in student feeds',
    'Enhanced candidate matching (advanced filters + readiness signals)',
    'Faster application visibility (Pro employer tag)',
  ],
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string; error?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Employer plans</h1>
            <p className="mt-2 text-slate-600">Choose the tier that fits your hiring volume.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/login" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Log in
              </Link>
              <Link
                href="/signup/employer"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Create employer account
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (userRow?.role !== 'employer') {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Employer plans</h1>
            <p className="mt-2 text-slate-600">Billing is available for employer accounts only.</p>
            <Link
              href="/account"
              className="mt-6 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open account
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const [{ status, plan, planId, priceId }, { data: subscription }, { count: activeCount }] = await Promise.all([
    getEmployerVerificationStatus({ supabase, userId: user.id }),
    supabase
      .from('subscriptions')
      .select('price_id, current_period_end, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('internships')
      .select('id', { count: 'exact', head: true })
      .eq('employer_id', user.id)
      .eq('is_active', true),
  ])

  const activeInternships = activeCount ?? 0
  const remaining = getRemainingCapacity(plan, activeInternships)

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <Link
            href="/dashboard/employer"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Choose your employer plan</h1>
            <p className="mt-2 text-slate-600">Scale from one posting to a high-signal recruiting pipeline.</p>
          </div>
        </div>

        {resolvedSearchParams?.checkout === 'success' && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Checkout completed. Your subscription status will update shortly.
          </div>
        )}
        {resolvedSearchParams?.checkout === 'canceled' && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Checkout canceled.
          </div>
        )}
        {resolvedSearchParams?.error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          You are on: <span className="font-semibold text-slate-900">{plan.name}</span>. You have {activeInternships} active internships
          {remaining === null ? ' (unlimited remaining).' : ` (${remaining} remaining on ${plan.name}).`}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {(['free', 'starter', 'pro'] as const).map((candidatePlanId) => {
            const candidate = EMPLOYER_PLANS[candidatePlanId]
            const isCurrent = candidatePlanId === planId
            const isPopular = candidatePlanId === 'starter'

            return (
              <article
                key={candidatePlanId}
                className={`flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  isPopular ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{candidate.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{candidate.valueProp}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {isPopular ? (
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold leading-none tracking-wide text-blue-700">
                        Most popular
                      </span>
                    ) : null}
                    {isCurrent ? (
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold leading-none tracking-wide text-emerald-700">
                        Current plan
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 text-3xl font-bold text-slate-900">{priceLabel(candidatePlanId)}</div>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-slate-400">
                  {PLAN_FEATURES[candidatePlanId].map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <div className="mt-6 pt-1">
                  {candidatePlanId === 'free' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
                    >
                      {isCurrent ? 'Current plan' : 'Always available'}
                    </button>
                  ) : candidatePlanId === 'starter' ? (
                    isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
                      >
                        Current plan
                      </button>
                    ) : (
                      <form action={startStarterEmployerCheckoutAction}>
                        <button
                          type="submit"
                          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Choose Starter
                        </button>
                      </form>
                    )
                  ) : isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
                    >
                      Current plan
                    </button>
                  ) : (
                    <form action={startProEmployerCheckoutAction}>
                      <button
                        type="submit"
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Choose Pro
                      </button>
                    </form>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Launch model: quality over quantity</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Free keeps the core live: basic posting capacity plus core applicant inbox workflow.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Starter and Pro sell speed: ranked applicants, match reasons, and faster candidate triage.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Pro adds efficiency at scale: advanced filters, readiness signals, and priority student-feed placement.
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Why upgrade?</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">More active listings</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Email alerts for new applicants</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Higher-quality applicants via match scoring</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <form action={createBillingPortalSessionAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Manage subscription
              </button>
            </form>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Subscription status: {status ?? 'none'} • Price ID: {priceId ?? subscription?.price_id ?? 'n/a'} • Period end:{' '}
              {formatDate(subscription?.current_period_end ?? null)}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
