'use client'

import { useMemo } from 'react'

type Props = {
  listingId: string
  applyMode?: 'native' | 'ats_link' | 'hybrid' | string | null
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  isClosed?: boolean
  className?: string
}

export default function ApplyButton({
  listingId,
  applyMode = 'native',
  isAuthenticated,
  userRole = null,
  isClosed = false,
  className,
}: Props) {
  const buttonClassName = useMemo(
    () =>
      className ||
      'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700',
    [className]
  )

  async function trackApplyClick() {
    try {
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'apply_click',
          properties: { listing_id: listingId, is_authenticated: isAuthenticated, user_role: userRole ?? null },
        }),
        keepalive: true,
      })
    } catch {
      // no-op
    }
  }

  const mode = applyMode === 'ats_link' || applyMode === 'hybrid' ? applyMode : 'native'
  const applyHref = mode === 'native' ? `/apply/${listingId}` : `/apply/${listingId}?quick=1`
  const applyLabel = mode === 'native' ? 'Apply' : 'Quick apply'

  if (isClosed) {
    return (
      <button type="button" disabled className={`${buttonClassName} cursor-not-allowed opacity-60`}>
        Closed
      </button>
    )
  }

  if (userRole === 'employer') {
    return (
      <button
        type="button"
        disabled
        title="Employer accounts cannot apply. Switch to a student account to apply."
        className={`${buttonClassName} cursor-not-allowed opacity-60`}
      >
        Switch to student account to apply
      </button>
    )
  }

  if (isAuthenticated && userRole === 'student') {
    return (
      <a
        href={applyHref}
        className={buttonClassName}
        onClick={() => {
          void trackApplyClick()
        }}
      >
        {applyLabel}
      </a>
    )
  }

  if (isAuthenticated) {
    return (
      <a
        href="/account"
        className={buttonClassName}
        onClick={() => {
          void trackApplyClick()
        }}
      >
        Choose account type to apply
      </a>
    )
  }

  return (
      <a
      href={`/signup/student?next=${encodeURIComponent(applyHref)}`}
      className={buttonClassName}
      onClick={() => {
        void trackApplyClick()
      }}
    >
      Apply
    </a>
  )
}
