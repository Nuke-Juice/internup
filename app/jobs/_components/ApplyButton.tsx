'use client'

import { useMemo } from 'react'

type Props = {
  listingId: string
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  className?: string
}

export default function ApplyButton({ listingId, isAuthenticated, userRole = null, className }: Props) {
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
          event_name: 'click_apply',
          properties: { listing_id: listingId, is_authenticated: isAuthenticated, user_role: userRole ?? null },
        }),
        keepalive: true,
      })
    } catch {
      // no-op
    }
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
        href={`/apply/${listingId}`}
        className={buttonClassName}
        onClick={() => {
          void trackApplyClick()
        }}
      >
        Apply
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
      href={`/signup/student?next=${encodeURIComponent(`/apply/${listingId}`)}`}
      className={buttonClassName}
      onClick={() => {
        void trackApplyClick()
      }}
    >
      Apply
    </a>
  )
}
