import { ShieldCheck } from 'lucide-react'
import type { EmployerPlanId } from '@/lib/billing/plan'

type Props = {
  tier: EmployerPlanId | string
  className?: string
}

function normalizeTier(tier: EmployerPlanId | string): EmployerPlanId {
  if (tier === 'starter' || tier === 'pro') return tier
  return 'free'
}

function classesForTier(tier: EmployerPlanId | string) {
  const normalized = normalizeTier(tier)
  if (normalized === 'pro') {
    return 'border-amber-300 bg-amber-50 text-amber-800'
  }
  if (normalized === 'starter') {
    return 'border-blue-300 bg-blue-50 text-blue-700'
  }
  return 'border-slate-300 bg-slate-50 text-slate-700'
}

function labelForTier(tier: EmployerPlanId | string) {
  const normalized = normalizeTier(tier)
  if (normalized === 'pro') return 'Verified Employer'
  return ''
}

export default function EmployerVerificationBadge({ tier, className = '' }: Props) {
  const normalized = normalizeTier(tier)
  if (normalized !== 'pro') return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${classesForTier(normalized)} ${className}`.trim()}
      title={labelForTier(normalized)}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {labelForTier(normalized)}
    </span>
  )
}
