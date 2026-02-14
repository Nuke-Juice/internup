'use client'

import { useMemo, useState } from 'react'
import { US_CITY_OPTIONS, US_STATE_OPTIONS, normalizeStateCode } from '@/lib/locations/usLocationCatalog'

type Props = {
  cityName?: string
  stateName?: string
  defaultCity?: string | null
  defaultState?: string | null
  labelClassName?: string
  selectClassName?: string
  errorMessage?: string | null
}

export default function InternshipLocationFields({
  cityName = 'location_city',
  stateName = 'location_state',
  defaultCity,
  defaultState,
  labelClassName = 'text-xs font-medium text-slate-700',
  selectClassName = 'mt-1 w-full rounded-md border border-slate-300 p-2 text-sm',
  errorMessage,
}: Props) {
  const initialState = normalizeStateCode(defaultState)
  const initialCity = (defaultCity ?? '').trim()
  const [selectedState, setSelectedState] = useState(initialState)
  const [stateQuery, setStateQuery] = useState(initialState)
  const [cityQuery, setCityQuery] = useState(initialCity)
  const [stateMenuOpen, setStateMenuOpen] = useState(false)
  const [cityMenuOpen, setCityMenuOpen] = useState(false)
  const [cityConfirmedCustom, setCityConfirmedCustom] = useState(false)
  const [stateActiveIndex, setStateActiveIndex] = useState(0)
  const [cityActiveIndex, setCityActiveIndex] = useState(0)
  const selectedCity = cityConfirmedCustom || cityQuery.length === 0 ? cityQuery : ''
  const canSearchCities = selectedState.length > 0
  const cityInputTrimmed = cityQuery.trim()

  const filteredStates = useMemo(() => {
    const query = stateQuery.trim().toLowerCase()
    const results = US_STATE_OPTIONS.filter((state) => {
      if (!query) return true
      return state.code.toLowerCase().includes(query) || state.name.toLowerCase().includes(query)
    })
    return results.slice(0, 8)
  }, [stateQuery])
  const cityOptionsByState = useMemo(
    () => US_CITY_OPTIONS.filter((option) => option.state === selectedState).map((option) => option.city),
    [selectedState]
  )
  const citySuggestions = useMemo(() => {
    if (!canSearchCities || cityInputTrimmed.length < 2) return []
    const query = cityInputTrimmed.toLowerCase()
    return cityOptionsByState.filter((city) => city.toLowerCase().includes(query)).slice(0, 8)
  }, [canSearchCities, cityInputTrimmed, cityOptionsByState])
  const hasExactCityMatch = citySuggestions.some((city) => city.toLowerCase() === cityInputTrimmed.toLowerCase())

  function selectState(nextState: string) {
    const normalized = normalizeStateCode(nextState)
    setSelectedState(normalized)
    setStateQuery(normalized)
    setStateMenuOpen(false)
    setStateActiveIndex(0)
    setCityQuery('')
    setCityMenuOpen(false)
    setCityConfirmedCustom(false)
    setCityActiveIndex(0)
  }

  function selectCity(nextCity: string) {
    setCityQuery(nextCity)
    setCityConfirmedCustom(true)
    setCityMenuOpen(false)
    setCityActiveIndex(0)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2" onBlur={() => setTimeout(() => {
      setStateMenuOpen(false)
      setCityMenuOpen(false)
    }, 120)}>
      <div>
        <label className={labelClassName}>Location state</label>
        <div className="relative mt-1">
          <input
            type="text"
            value={stateQuery}
            onFocus={() => setStateMenuOpen(true)}
            onChange={(event) => {
              setStateQuery(event.target.value.toUpperCase())
              setStateMenuOpen(true)
            }}
            onKeyDown={(event) => {
              if (!stateMenuOpen || filteredStates.length === 0) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setStateActiveIndex((prev) => Math.min(prev + 1, filteredStates.length - 1))
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setStateActiveIndex((prev) => Math.max(prev - 1, 0))
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const active = filteredStates[stateActiveIndex]
                if (active) selectState(active.code)
                return
              }
              if (event.key === 'Escape') {
                setStateMenuOpen(false)
              }
            }}
            placeholder="Search state"
            className={selectClassName}
          />
          <input type="hidden" name={stateName} value={selectedState} />
          {stateMenuOpen ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {filteredStates.length > 0 ? filteredStates.map((state, index) => (
                <button
                  key={state.code}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectState(state.code)
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm ${index === stateActiveIndex ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {state.name} ({state.code})
                </button>
              )) : (
                <div className="px-3 py-2 text-sm text-slate-500">No states found</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <label className={labelClassName}>Location city</label>
        <div className="relative mt-1">
          <input
            type="text"
            value={cityQuery}
            onFocus={() => setCityMenuOpen(true)}
            onChange={(event) => {
              setCityQuery(event.target.value)
              setCityConfirmedCustom(false)
              setCityMenuOpen(true)
            }}
            onKeyDown={(event) => {
              if (!canSearchCities || citySuggestions.length === 0) {
                if (event.key === 'Escape') setCityMenuOpen(false)
                return
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setCityActiveIndex((prev) => Math.min(prev + 1, citySuggestions.length - 1))
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setCityActiveIndex((prev) => Math.max(prev - 1, 0))
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const active = citySuggestions[cityActiveIndex]
                if (active) selectCity(active)
                return
              }
              if (event.key === 'Escape') {
                setCityMenuOpen(false)
              }
            }}
            className={selectClassName}
            disabled={!canSearchCities}
            placeholder={!canSearchCities ? 'Select a state first' : 'Type to search cities'}
          />
          <input type="hidden" name={cityName} value={selectedCity} />
          {cityMenuOpen ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {!canSearchCities ? (
                <div className="px-3 py-2 text-sm text-slate-500">Select a state first</div>
              ) : cityInputTrimmed.length < 2 ? (
                <div className="px-3 py-2 text-sm text-slate-500">Type to search cities</div>
              ) : citySuggestions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">No cities found</div>
              ) : (
                citySuggestions.map((city, index) => (
                  <button
                    key={`${selectedState}-${city}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectCity(city)
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm ${index === cityActiveIndex ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {city}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {canSearchCities && cityInputTrimmed.length >= 2 && !hasExactCityMatch && !cityConfirmedCustom ? (
          <button
            type="button"
            onClick={() => setCityConfirmedCustom(true)}
            className="mt-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Use &quot;{cityInputTrimmed}&quot; as entered
          </button>
        ) : null}
        {!canSearchCities ? (
          <p className="mt-1 text-xs text-slate-500">Select a state first</p>
        ) : cityInputTrimmed.length < 2 ? (
          <p className="mt-1 text-xs text-slate-500">Type at least 2 characters to search cities</p>
        ) : null}
        {errorMessage ? <p className="mt-1 text-xs text-red-600">{errorMessage}</p> : null}
      </div>
    </div>
  )
}
