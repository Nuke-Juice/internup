'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

type Props = {
  fallbackHref: string
}

export default function BackWithFallbackButton({ fallbackHref }: Props) {
  const router = useRouter()

  return (
    <button
      type="button"
      aria-label="Go back"
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
      onClick={() => {
        if (window.history.length > 1) {
          router.back()
          return
        }
        router.push(fallbackHref)
      }}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  )
}
