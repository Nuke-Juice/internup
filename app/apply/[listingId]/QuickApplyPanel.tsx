'use client'

import { useState } from 'react'

type Props = {
  listingId: string
  action: (formData: FormData) => void | Promise<void>
  hasSavedResume: boolean
  savedResumeFileName?: string | null
  showNoteField?: boolean
  submitLabel?: string
}

export default function QuickApplyPanel({
  listingId,
  action,
  hasSavedResume,
  savedResumeFileName,
  showNoteField = true,
  submitLabel = 'Submit quick apply',
}: Props) {
  const [error, setError] = useState<string | null>(null)

  function validate(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const fileInput = form.querySelector<HTMLInputElement>('input[name="resume"]')
    const noteInput = form.querySelector<HTMLTextAreaElement>('textarea[name="quick_apply_note"]')
    const file = fileInput?.files?.[0]
    if (!file && !hasSavedResume) {
      setError('Please upload a PDF resume.')
      event.preventDefault()
      return
    }
    if (file) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        setError('Resume must be a PDF.')
        event.preventDefault()
        return
      }
    }
    if (showNoteField && noteInput && noteInput.value.length > 280) {
      setError('Quick note must be 280 characters or less.')
      event.preventDefault()
      return
    }
    setError(null)
  }

  return (
    <form action={action} onSubmit={validate} className="mt-5 space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />

      <div>
        <label className="text-sm font-medium text-slate-700">Resume (PDF)</label>
        <input
          name="resume"
          type="file"
          accept="application/pdf"
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
        />
        {hasSavedResume ? (
          <p className="mt-1 text-xs text-slate-600">
            Saved resume on file{savedResumeFileName ? `: ${savedResumeFileName}` : ''}. Upload a new one only if you want to override.
          </p>
        ) : null}
      </div>

      {showNoteField ? (
        <div>
          <label className="text-sm font-medium text-slate-700">Why are you interested? (optional)</label>
          <textarea
            name="quick_apply_note"
            maxLength={280}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
            placeholder="Optional 1-2 sentence note"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {submitLabel}
      </button>
    </form>
  )
}
