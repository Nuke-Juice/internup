'use client'

type Props = {
  fieldClassName: string
  gender: string
  interests: string
  resumeFile: File | null
  resumeFileName: string
  hasResumeOnFile: boolean
  onGenderChange: (value: string) => void
  onInterestsChange: (value: string) => void
  onResumeChange: (file: File | null) => void
}

export default function StudentStep3({
  fieldClassName,
  gender,
  interests,
  resumeFile,
  resumeFileName,
  hasResumeOnFile,
  onGenderChange,
  onInterestsChange,
  onResumeChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-700">Gender</label>
        <select className={fieldClassName} value={gender} onChange={(e) => onGenderChange(e.target.value)}>
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Resume (PDF)</label>
        <input
          type="file"
          accept="application/pdf"
          className={fieldClassName}
          onChange={(event) => onResumeChange(event.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-slate-500">
          {resumeFile
            ? `${resumeFile.name} selected.`
            : hasResumeOnFile
              ? `Current: ${resumeFileName || 'Resume on file'}`
              : 'No resume uploaded yet.'}
        </p>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Short bio or summary</label>
        <textarea
          rows={4}
          className={fieldClassName}
          value={interests}
          onChange={(e) => onInterestsChange(e.target.value)}
          placeholder="Share what you enjoy building and the impact you want to make."
        />
      </div>
    </div>
  )
}
