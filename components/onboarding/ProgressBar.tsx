'use client'

type Props = {
  currentStep: number
  totalSteps: number
  caption?: string
}

export default function ProgressBar({ currentStep, totalSteps, caption }: Props) {
  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps)
  const progressPercent = Math.round((clampedStep / totalSteps) * 100)

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Step {clampedStep} of {totalSteps}</p>
        <p className="text-xs text-slate-500">{caption ?? `${progressPercent}% complete`}</p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
