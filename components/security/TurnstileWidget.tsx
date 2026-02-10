'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

type TurnstileWidgetProps = {
  action?: string
  className?: string
  fieldName?: string
  appearance?: 'always' | 'interaction-only' | 'execute'
  onTokenChange?: (token: string) => void
  onError?: (message: string) => void
}

export default function TurnstileWidget({
  action,
  className,
  fieldName = 'turnstile_token',
  appearance = 'interaction-only',
  onTokenChange,
  onError,
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [token, setToken] = useState('')

  useEffect(() => {
    if (siteKey) return
    onError?.('Turnstile site key is missing.')
  }, [onError, siteKey])

  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      appearance,
      callback: (value: string) => {
        setToken(value)
        onTokenChange?.(value)
      },
      'expired-callback': () => {
        setToken('')
        onTokenChange?.('')
      },
      'error-callback': () => {
        setToken('')
        onTokenChange?.('')
        onError?.('Turnstile verification could not be completed.')
      },
    })

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, appearance, onError, onTokenChange, scriptReady, siteKey])

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => onError?.('Turnstile script failed to load.')}
      />
      <div ref={containerRef} />
      <input type="hidden" name={fieldName} value={token} />
    </div>
  )
}
