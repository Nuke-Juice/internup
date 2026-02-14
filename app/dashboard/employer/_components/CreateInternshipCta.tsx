'use client'

import Link from 'next/link'
import { useState } from 'react'
import CenteredModal from '@/app/dashboard/employer/_components/CenteredModal'

type CreateInternshipCtaProps = {
  atLimit: boolean
  activeCount: number
  planLimit: number | null
}

export default function CreateInternshipCta({ atLimit, activeCount, planLimit }: CreateInternshipCtaProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  if (!atLimit) {
    return (
      <Link
        href="/dashboard/employer/new"
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 sm:w-auto"
      >
        Create internship
      </Link>
    )
  }

  const limitLabel = typeof planLimit === 'number' ? planLimit : activeCount
  const plural = limitLabel === 1 ? '' : 's'

  return (
    <>
      <button
        type="button"
        onClick={() => setShowUpgradeModal(true)}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 sm:w-auto"
      >
        Create internship
      </button>
      <CenteredModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade to post more internships"
        description={`Your plan allows ${limitLabel} active internship${plural}. You currently have ${activeCount} active.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <Link
              href="/upgrade"
              className="rounded-md border border-blue-700 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upgrade
            </Link>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Free plan allows 1 active internship. Deactivate an active listing or upgrade to post more.
        </p>
      </CenteredModal>
    </>
  )
}
