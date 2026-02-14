'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import CenteredModal from '@/app/dashboard/employer/_components/CenteredModal'

export type ActiveInternshipListItem = {
  id: string
  title: string | null
  location: string | null
  stateLabel: string
  workMode: string | null
  createdAtLabel: string
  targetYearsLabel: string
  majorsLabel: string | null
}

type ActiveInternshipsListProps = {
  internships: ActiveInternshipListItem[]
  toggleInternshipActiveAction: (formData: FormData) => void | Promise<void>
  deletePublishedInternshipAction: (formData: FormData) => void | Promise<void>
}

function shouldShowWorkModeSuffix(location: string | null, workMode: string | null) {
  if (!workMode) return false
  const normalizedMode = workMode.trim().toLowerCase()
  if (!normalizedMode) return false
  const normalizedLocation = (location ?? '').trim().toLowerCase()
  if (!normalizedLocation) return true
  return !normalizedLocation.includes(`(${normalizedMode})`)
}

export default function ActiveInternshipsList({
  internships,
  toggleInternshipActiveAction,
  deletePublishedInternshipAction,
}: ActiveInternshipsListProps) {
  const [openDeleteModalForId, setOpenDeleteModalForId] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmationPhrase, setConfirmationPhrase] = useState('')
  const confirmationInputRef = useRef<HTMLInputElement | null>(null)
  const selected = useMemo(
    () => internships.find((item) => item.id === openDeleteModalForId) ?? null,
    [internships, openDeleteModalForId]
  )

  const closeDeleteModal = () => {
    setOpenDeleteModalForId(null)
    setAcknowledged(false)
    setConfirmationPhrase('')
  }

  if (internships.length === 0) {
    return <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No active listings.</div>
  }

  const canDelete = acknowledged && confirmationPhrase.trim().toUpperCase() === 'DELETE'

  return (
    <>
      <div className="mt-2 grid gap-3">
        {internships.map((internship) => (
          <div key={internship.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">{internship.title || 'Untitled listing'}</div>
                <div className="text-xs text-slate-500">
                  {internship.location} • {internship.stateLabel}
                  {shouldShowWorkModeSuffix(internship.location, internship.workMode) ? ` • ${internship.workMode}` : ''}
                </div>
                <div className="text-xs text-slate-500">Created: {internship.createdAtLabel}</div>
              </div>
              <div className="text-xs text-slate-500">Target years: {internship.targetYearsLabel}</div>
            </div>
            {internship.majorsLabel ? <div className="mt-2 text-xs text-slate-500">Majors: {internship.majorsLabel}</div> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/jobs/${internship.id}`}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View details
              </Link>
              <Link
                href={`/inbox?internship_id=${encodeURIComponent(internship.id)}`}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Applicants
              </Link>
              <Link
                href={`/dashboard/employer/new?edit=${encodeURIComponent(internship.id)}`}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </Link>
              <form action={toggleInternshipActiveAction}>
                <input type="hidden" name="internship_id" value={internship.id} />
                <input type="hidden" name="next_active" value="0" />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Deactivate
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setAcknowledged(false)
                  setConfirmationPhrase('')
                  setOpenDeleteModalForId(internship.id)
                }}
                className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Delete listing
              </button>
            </div>
          </div>
        ))}
      </div>

      <CenteredModal
        open={Boolean(openDeleteModalForId)}
        onClose={closeDeleteModal}
        title="Delete listing?"
        description="This permanently deletes this listing and its applicants. This cannot be undone."
        initialFocusRef={confirmationInputRef}
      >
        <form action={deletePublishedInternshipAction} className="space-y-3">
          <input type="hidden" name="internship_id" value={selected?.id ?? ''} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="acknowledge_delete"
              value="1"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.currentTarget.checked)}
            />
            I understand this action cannot be undone.
          </label>
          <input
            ref={confirmationInputRef}
            name="confirmation_phrase"
            placeholder="Type DELETE"
            autoComplete="off"
            value={confirmationPhrase}
            onChange={(event) => setConfirmationPhrase(event.currentTarget.value)}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canDelete}
              className="rounded-md border border-red-400 bg-red-600 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Permanently delete
            </button>
          </div>
        </form>
      </CenteredModal>
    </>
  )
}
