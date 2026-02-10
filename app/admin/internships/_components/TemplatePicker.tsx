'use client'

import { useMemo, useState } from 'react'

type TemplateOption = {
  key: string
  label: string
  category?: string
}

type Props = {
  options: readonly TemplateOption[]
  selectedTemplateKey: string
}

export default function TemplatePicker({ options, selectedTemplateKey }: Props) {
  const [query, setQuery] = useState(() => {
    if (!selectedTemplateKey) return ''
    const selected = options.find((template) => template.key === selectedTemplateKey)
    return selected?.label ?? ''
  })

  const labelToKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const option of options) {
      map.set(option.label.toLowerCase(), option.key)
    }
    return map
  }, [options])

  const selectedKey = useMemo(() => labelToKey.get(query.trim().toLowerCase()) ?? '', [labelToKey, query])

  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 text-xs font-medium text-slate-700" htmlFor="template-picker-search">
        Template library
      </label>
      <input
        id="template-picker-search"
        list="template-picker-options"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search verified templates"
        className="h-10 min-w-[18rem] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
      />
      <datalist id="template-picker-options">
        {options.map((template) => (
          <option key={template.key} value={template.label}>
            {template.category ? `${template.category}` : ''}
          </option>
        ))}
      </datalist>
      <input type="hidden" name="template" value={selectedKey} />
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.form?.requestSubmit()
        }}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Apply
      </button>
    </div>
  )
}
