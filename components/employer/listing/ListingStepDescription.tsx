'use client'

import type { ListingStep4FieldKey } from './types'

type Props = {
  shortSummary: string
  responsibilities: string[]
  qualifications: string
  screeningQuestion: string
  fieldErrors?: Partial<Record<ListingStep4FieldKey, string>>
  onChange: (patch: Partial<Record<string, string>>) => void
  onResponsibilitiesChange: (items: string[]) => void
}

function splitToResponsibilityLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .flatMap((item) => item.split(/[•;]+/))
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function ListingStepDescription(props: Props) {
  const summaryLength = props.shortSummary.length

  return (
    <div className="space-y-4">
      <div>
        <label className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
          Short summary
          {props.fieldErrors?.short_summary ? <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null}
        </label>
        <textarea
          name="short_summary"
          rows={2}
          maxLength={200}
          value={props.shortSummary}
          onChange={(event) => props.onChange({ shortSummary: event.target.value })}
          className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
            props.fieldErrors?.short_summary ? 'border-red-300' : 'border-slate-300'
          }`}
          placeholder="What makes this internship compelling?"
        />
        <p className="mt-1 text-xs text-slate-500">{summaryLength}/200</p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Responsibilities</label>
        <div className="mt-1 space-y-2">
          {props.responsibilities.map((item, index) => (
            <input
              key={`responsibility-${index}`}
              value={item}
              onChange={(event) => {
                const next = [...props.responsibilities]
                next[index] = event.target.value
                props.onResponsibilitiesChange(next)
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text')
                if (!text.includes('\n') && !text.includes(';') && !text.includes('•')) return
                event.preventDefault()
                const next = [...props.responsibilities]
                const lines = splitToResponsibilityLines(text)
                next[index] = lines[0] ?? ''
                if (lines.length > 1) {
                  next.splice(index + 1, 0, ...lines.slice(1))
                }
                props.onResponsibilitiesChange(next)
              }}
              className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              placeholder="Describe one key responsibility"
            />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => props.onResponsibilitiesChange([...(props.responsibilities.length > 0 ? props.responsibilities : ['']), ''])}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
          >
            + Add responsibility
          </button>
          {props.responsibilities.length > 1 ? (
            <button
              type="button"
              onClick={() => props.onResponsibilitiesChange(props.responsibilities.slice(0, -1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Remove last
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Qualifications (one per line)</label>
        <textarea
          name="qualifications"
          rows={5}
          value={props.qualifications}
          onChange={(event) => props.onChange({ qualifications: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="Pursuing relevant degree\nStrong written communication"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Optional screening question</label>
        <input
          name="screening_question"
          value={props.screeningQuestion}
          onChange={(event) => props.onChange({ screeningQuestion: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="What project are you most proud of and why?"
        />
      </div>
    </div>
  )
}
