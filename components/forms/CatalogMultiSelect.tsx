'use client'

import { useMemo, useState } from 'react'
import { normalizeCatalogLabel, normalizeCatalogToken } from '@/lib/catalog/normalization'

type CatalogOption = {
  id: string
  name: string
}

type SelectedItem = {
  id: string | null
  label: string
}

type Props = {
  label: string
  fieldName: string
  idsFieldName: string
  customFieldName: string
  inputId: string
  options: CatalogOption[]
  initialLabels: string[]
  helperText?: string
  allowCustom?: boolean
  required?: boolean
}

function sameToken(left: string, right: string) {
  return normalizeCatalogToken(left) === normalizeCatalogToken(right)
}

function isCustomOptionId(id: string | null | undefined) {
  return typeof id === 'string' && id.startsWith('custom:')
}

export default function CatalogMultiSelect({
  label,
  fieldName,
  idsFieldName,
  customFieldName,
  inputId,
  options,
  initialLabels,
  helperText,
  allowCustom = true,
  required = false,
}: Props) {
  const optionsByToken = useMemo(() => {
    const map = new Map<string, CatalogOption>()
    for (const option of options) {
      map.set(normalizeCatalogToken(option.name), option)
    }
    return map
  }, [options])

  const [selected, setSelected] = useState<SelectedItem[]>(() => {
    const initial: SelectedItem[] = []
    for (const labelValue of initialLabels.map(normalizeCatalogLabel).filter(Boolean)) {
      const maybeOption = optionsByToken.get(normalizeCatalogToken(labelValue))
      if (maybeOption) {
        initial.push({ id: maybeOption.id, label: maybeOption.name })
      } else {
        initial.push({ id: null, label: labelValue })
      }
    }
    return initial
  })
  const [query, setQuery] = useState('')
  const [showMenu, setShowMenu] = useState(false)

  const filteredOptions = useMemo(() => {
    const queryToken = normalizeCatalogToken(query)
    const selectedIds = new Set(selected.map((item) => item.id).filter((value): value is string => Boolean(value)))
    return options
      .filter((option) => {
        if (selectedIds.has(option.id)) return false
        if (!queryToken) return true
        return normalizeCatalogToken(option.name).includes(queryToken)
      })
      .slice(0, 8)
  }, [options, query, selected])

  const canonicalIds = selected
    .map((item) => item.id)
    .filter((value): value is string => Boolean(value))
  const customLabels = selected
    .filter((item) => !item.id)
    .map((item) => item.label)

  function addFromText(value: string) {
    const labelValue = normalizeCatalogLabel(value)
    if (!labelValue) return
    if (selected.some((item) => sameToken(item.label, labelValue))) {
      setQuery('')
      return
    }
    const matched = optionsByToken.get(normalizeCatalogToken(labelValue))
    if (matched) {
      setSelected((prev) => [...prev, { id: matched.id, label: matched.name }])
    } else {
      setSelected((prev) => [...prev, { id: null, label: labelValue }])
    }
    setQuery('')
  }

  function addOption(option: CatalogOption) {
    if (selected.some((item) => item.id === option.id || sameToken(item.label, option.name))) return
    setSelected((prev) => [...prev, { id: isCustomOptionId(option.id) ? null : option.id, label: option.name }])
    setQuery('')
    setShowMenu(false)
  }

  function removeItem(labelValue: string) {
    setSelected((prev) => prev.filter((item) => !sameToken(item.label, labelValue)))
  }

  return (
    <div>
      <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative mt-1 rounded-md border border-slate-300 bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <button
              key={`${item.id ?? 'custom'}:${item.label}`}
              type="button"
              onClick={() => removeItem(item.label)}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800 hover:border-blue-300 hover:bg-blue-100"
            >
              {item.label} ×
            </button>
          ))}
          <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setShowMenu(true)
            }}
            onFocus={() => setShowMenu(true)}
            onBlur={() => {
              setTimeout(() => setShowMenu(false), 120)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (filteredOptions.length > 0 && normalizeCatalogToken(query)) {
                  const exact = filteredOptions.find(
                    (option) => normalizeCatalogToken(option.name) === normalizeCatalogToken(query)
                  )
                  if (exact) {
                    addOption(exact)
                    return
                  }
                }
                if (allowCustom) {
                  addFromText(query)
                }
              }
            }}
            className="min-w-[12rem] flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder={allowCustom ? 'Type to search, Enter to add' : 'Type to search skills'}
          />
        </div>
        {showMenu && filteredOptions.length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  addOption(option)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {option.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <input type="hidden" name={fieldName} value={selected.map((item) => item.label).join(', ')} />
      <input type="hidden" name={idsFieldName} value={JSON.stringify(canonicalIds)} />
      <input type="hidden" name={customFieldName} value={JSON.stringify(customLabels)} />
      {required ? <input type="hidden" name={`${idsFieldName}_required`} value={canonicalIds.length > 0 ? '1' : ''} /> : null}
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  )
}
