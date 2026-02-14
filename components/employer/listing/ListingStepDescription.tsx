'use client'

type Props = {
  shortSummary: string
  responsibilities: string
  qualifications: string
  screeningQuestion: string
  onChange: (patch: Partial<Record<string, string>>) => void
}

export default function ListingStepDescription(props: Props) {
  const summaryLength = props.shortSummary.length

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Short summary</label>
        <textarea
          name="short_summary"
          rows={2}
          maxLength={200}
          value={props.shortSummary}
          onChange={(event) => props.onChange({ shortSummary: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="What makes this internship compelling?"
        />
        <p className="mt-1 text-xs text-slate-500">{summaryLength}/200</p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Responsibilities (one per line)</label>
        <textarea
          name="responsibilities"
          rows={5}
          value={props.responsibilities}
          onChange={(event) => props.onChange({ responsibilities: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="- Support weekly reporting\n- Prepare stakeholder updates"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Qualifications (one per line)</label>
        <textarea
          name="qualifications"
          rows={5}
          value={props.qualifications}
          onChange={(event) => props.onChange({ qualifications: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="- Pursuing a relevant degree\n- Strong written communication"
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
