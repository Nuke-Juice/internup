'use client'

import { useMemo, useState } from 'react'
import { normalizeCatalogToken } from '@/lib/catalog/normalization'

export type CanonicalMajor = {
  id: string
  slug: string
  name: string
}

type Props = {
  inputId?: string
  label?: string
  query: string
  onQueryChange: (value: string) => void
  options: CanonicalMajor[]
  selectedMajor: CanonicalMajor | null
  onSelect: (major: CanonicalMajor) => void
  loading?: boolean
  error?: string | null
  placeholder?: string
}

export default function MajorCombobox({
  inputId,
  label = 'Major',
  query,
  onQueryChange,
  options,
  selectedMajor,
  onSelect,
  loading,
  error,
  placeholder = 'Start typing your major',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const filteredOptions = useMemo(() => {
    const token = normalizeCatalogToken(query)
    if (!token) return options.slice(0, 8)
    return options
      .filter((option) => normalizeCatalogToken(option.name).includes(token) || normalizeCatalogToken(option.slug).includes(token))
      .slice(0, 8)
  }, [options, query])

  const showDropdown = isOpen && query.trim().length > 0 && selectedMajor?.name !== query

  return (
    <div className="relative">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        id={inputId}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        value={query}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 120)
        }}
        onChange={(event) => {
          onQueryChange(event.target.value)
          setIsOpen(true)
          setHighlightedIndex(-1)
        }}
        onKeyDown={(event) => {
          if (!showDropdown || filteredOptions.length === 0) return

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length)
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlightedIndex((prev) => (prev <= 0 ? filteredOptions.length - 1 : prev - 1))
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            const option = filteredOptions[highlightedIndex >= 0 ? highlightedIndex : 0]
            if (option) {
              onSelect(option)
              setHighlightedIndex(-1)
              setIsOpen(false)
            }
            return
          }

          if (event.key === 'Escape') {
            setIsOpen(false)
            setHighlightedIndex(-1)
          }
        }}
        placeholder={placeholder}
      />

      {showDropdown ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-600">Searching...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-600">No results found.</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={() => {
                  onSelect(option)
                  setHighlightedIndex(-1)
                  setIsOpen(false)
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  index === highlightedIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.name}
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedMajor ? <p className="mt-1 text-xs text-emerald-700">Verified major: {selectedMajor.name}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
