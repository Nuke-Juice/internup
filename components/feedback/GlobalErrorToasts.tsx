'use client'

import { useEffect } from 'react'
import { toUserFacingUnknownError } from '@/lib/errors/userFacingError'
import { useToast } from '@/components/feedback/ToastProvider'

export default function GlobalErrorToasts() {
  const { showToast } = useToast()

  useEffect(() => {
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const message = toUserFacingUnknownError(event.reason)
      showToast({
        kind: 'error',
        message,
        key: `unhandled-rejection:${message}`,
      })
    }

    function onError(event: ErrorEvent) {
      if (!event.message && !event.error) return
      const message = toUserFacingUnknownError(event.error ?? event.message)
      showToast({
        kind: 'error',
        message,
        key: `window-error:${message}`,
      })
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onError)

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onError)
    }
  }, [showToast])

  return null
}
