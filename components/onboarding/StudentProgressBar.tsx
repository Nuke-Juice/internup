'use client'

import ProgressBar from '@/components/onboarding/ProgressBar'

type Props = {
  currentStep: number
  totalSteps: number
}

export default function StudentProgressBar({ currentStep, totalSteps }: Props) {
  return <ProgressBar currentStep={currentStep} totalSteps={totalSteps} caption="Keep going. This helps employers find you faster." />
}
