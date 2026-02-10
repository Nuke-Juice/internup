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
  const selectedTemplate = useMemo(
    () => options.find((template) => template.key === selectedTemplateKey) ?? null,
    [options, selectedTemplateKey]
  )

  const [query, setQuery] = useState(() => {
    return selectedTemplate?.label ?? ''
  })
  const [isFocused, setIsFocused] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!normalizedQuery) return []
    return options
      .filter((option) => {
        const labelMatch = option.label.toLowerCase().includes(normalizedQuery)
        const categoryMatch = (option.category ?? '').toLowerCase().includes(normalizedQuery)
        return labelMatch || categoryMatch
      })
      .slice(0, 10)
  }, [normalizedQuery, options])

  const selectedKey = useMemo(() => {
    const exact = options.find((option) => option.label.toLowerCase() === normalizedQuery)
    return exact?.key ?? ''
  }, [normalizedQuery, options])
  const showDropdown = isFocused && normalizedQuery.length > 0
  const hasResults = filtered.length > 0

  return (
    <div className="flex items-end gap-2">
      <label className="shrink-0 text-xs font-medium text-slate-700" htmlFor="template-picker-search">
        Template library
      </label>
      <div className="relative min-w-[22rem]">
        <input
          id="template-picker-search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Let option click fire before hiding.
            setTimeout(() => setIsFocused(false), 120)
          }}
          placeholder="Search verified templates"
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
        />
        {showDropdown ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {hasResults ? (
              <ul className="py-1">
                {filtered.map((template) => (
                  <li key={template.key}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(template.label)
                        setIsFocused(false)
                      }}
                      className="flex w-full items-start justify-between px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-800">{template.label}</span>
                      <span className="ml-2 text-xs text-slate-500">{template.category ?? ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500">No template matches.</div>
            )}
          </div>
        ) : null}
      </div>
      <input type="hidden" name="template" value={selectedKey} />
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.form?.requestSubmit()
        }}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={query.trim().length > 0 && !selectedKey}
      >
        Apply
      </button>
    </div>
  )
}
