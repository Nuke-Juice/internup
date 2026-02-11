'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toUserFacingErrorMessage } from '@/lib/errors/userFacingError'

export type ToastKind = 'success' | 'warning' | 'error'

export type ToastInput = {
  key?: string
  kind: ToastKind
  message: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
  durationMs?: number
}

type ToastRecord = ToastInput & {
  id: string
  expiresAt: number
  leaving?: boolean
}

type ToastContextValue = {
  showToast: (toast: ToastInput) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 3
const DEFAULT_DURATION = 4200
const EXIT_DURATION = 240

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function kindClasses(kind: ToastKind) {
  if (kind === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (kind === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-red-200 bg-red-50 text-red-800'
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const [recentKeys, setRecentKeys] = useState<Record<string, number>>({})

  useEffect(() => {
    setToasts([])
  }, [pathname])

  useEffect(() => {
    if (Object.keys(recentKeys).length === 0) return
    const now = Date.now()
    const next = Object.fromEntries(Object.entries(recentKeys).filter(([, timestamp]) => now - timestamp < 2500))
    if (Object.keys(next).length !== Object.keys(recentKeys).length) {
      setRecentKeys(next)
    }
  }, [recentKeys])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, EXIT_DURATION)
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const normalizedMessage =
      input.kind === 'error' ? toUserFacingErrorMessage(input.message) : input.message
    const key = input.key ?? `${input.kind}:${normalizedMessage}`
    const now = Date.now()
    if (recentKeys[key] && now - recentKeys[key] < 1200) return

    setRecentKeys((prev) => ({ ...prev, [key]: now }))

    const durationMs = input.durationMs ?? DEFAULT_DURATION
    const record: ToastRecord = {
      ...input,
      message: normalizedMessage,
      id: makeId(),
      expiresAt: now + durationMs,
    }

    setToasts((prev) => [record, ...prev].slice(0, MAX_TOASTS))
    setTimeout(() => {
      dismissToast(record.id)
    }, durationMs)
  }, [dismissToast, recentKeys])

  const value = useMemo<ToastContextValue>(() => ({ showToast, dismissToast }), [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 shadow transition-all duration-200 ${kindClasses(
              toast.kind
            )} ${toast.leaving ? 'translate-x-4 opacity-0' : 'translate-x-0 opacity-100'}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 text-sm">{toast.message}</div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded px-1 text-xs hover:bg-black/10"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                onClick={() => {
                  void toast.onAction?.()
                  dismissToast(toast.id)
                }}
                className="mt-2 rounded border border-current/25 bg-white/70 px-2 py-1 text-xs font-medium hover:bg-white"
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
