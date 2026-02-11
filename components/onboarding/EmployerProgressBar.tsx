'use client'

import ProgressBar from '@/components/onboarding/ProgressBar'

type Props = {
  currentStep: number
  totalSteps: number
}

export default function EmployerProgressBar({ currentStep, totalSteps }: Props) {
  return <ProgressBar currentStep={currentStep} totalSteps={totalSteps} caption="Almost there. This helps students trust your listings." />
}
