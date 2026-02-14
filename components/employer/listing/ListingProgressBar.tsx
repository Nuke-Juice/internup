'use client'

export default function ListingProgressBar({
  currentStep,
  totalSteps,
}: {
  currentStep: number
  totalSteps: number
}) {
  const progress = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100))

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{`Step ${currentStep} of ${totalSteps}`}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
