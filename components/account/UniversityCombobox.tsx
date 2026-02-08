'use client'

type University = {
  id: string | number
  name: string
}

type Props = {
  inputId?: string
  query: string
  onQueryChange: (value: string) => void
  options: University[]
  selectedUniversity: University | null
  onSelect: (university: University) => void
  loading?: boolean
  error?: string | null
}

export default function UniversityCombobox({
  inputId,
  query,
  onQueryChange,
  options,
  selectedUniversity,
  onSelect,
  loading,
  error,
}: Props) {
  const showDropdown = query.trim().length > 0 && selectedUniversity?.name !== query

  return (
    <div className="relative">
      <label className="text-sm font-medium text-slate-700">University</label>
      <input
        id={inputId}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Start typing your university"
      />

      {showDropdown && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-600">Searching...</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-600">No matches found.</div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {option.name}
              </button>
            ))
          )}
        </div>
      )}

      {selectedUniversity && (
        <p className="mt-1 text-xs text-emerald-700">Verified selection: {selectedUniversity.name}</p>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
