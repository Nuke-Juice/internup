'use client'

import { useState } from 'react'

type Props = {
  listingId: string
  action: (formData: FormData) => void | Promise<void>
  hasSavedResume: boolean
  savedResumeFileName?: string | null
}

export default function ApplyForm({ listingId, action, hasSavedResume, savedResumeFileName }: Props) {
  const [error, setError] = useState<string | null>(null)

  function validate(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const fileInput = form.querySelector<HTMLInputElement>('input[name="resume"]')
    const file = fileInput?.files?.[0]
    if (!file && !hasSavedResume) {
      setError('Please upload a PDF resume.')
      event.preventDefault()
      return
    }
    if (!file) {
      setError(null)
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Resume must be a PDF.')
      event.preventDefault()
      return
    }
    setError(null)
  }

  return (
    <form action={action} onSubmit={validate} className="mt-6 space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />

      <div>
        <label className="text-sm font-medium text-slate-700">Resume (PDF)</label>
        <input
          name="resume"
          type="file"
          accept="application/pdf"
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
        />
        {hasSavedResume && (
          <p className="mt-1 text-xs text-slate-600">
            Saved profile resume on file{savedResumeFileName ? `: ${savedResumeFileName}` : ''}. You can upload a new one to override for this application.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Submit application
      </button>
    </form>
  )
}
