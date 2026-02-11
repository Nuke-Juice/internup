'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { normalizeStateCode, US_CITY_OPTIONS, US_STATE_OPTIONS } from '@/lib/locations/usLocationCatalog'

type FilterState = {
  sort: 'best_match' | 'newest'
  searchQuery: string
  category: string
  payMin: string
  remoteOnly: boolean
  experience: string
  hoursMin: string
  hoursMax: string
  locationCity: string
  locationState: string
  radius: string
}

type NoMatchesHint = {
  labels: string[]
  clearSuggestedHref: string
  resetAllHref: string
}

type Props = {
  categories: string[]
  state: FilterState
  noMatchesHint?: NoMatchesHint | null
  basePath?: string
  anchorId?: string
}

const SLIDER_MIN = 0
const SLIDER_MAX = 80

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseIntOrFallback(value: string, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(parsed)
}

function normalizeCityKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCityStateInput(value: string) {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const city = parts[0]
  const stateCandidate = normalizeStateCode(parts[1])
  if (!city || !stateCandidate) return null
  return { city, state: stateCandidate }
}

export default function FiltersPanel({ categories, state, noMatchesHint, basePath = '/jobs', anchorId }: Props) {
  const initialMin = clamp(parseIntOrFallback(state.hoursMin, 10), SLIDER_MIN, SLIDER_MAX)
  const initialMax = clamp(parseIntOrFallback(state.hoursMax, 40), SLIDER_MIN, SLIDER_MAX)

  const [hoursMinValue, setHoursMinValue] = useState(Math.min(initialMin, initialMax))
  const [hoursMaxValue, setHoursMaxValue] = useState(Math.max(initialMin, initialMax))
  const [hoursMinInput, setHoursMinInput] = useState(state.hoursMin || String(Math.min(initialMin, initialMax)))
  const [hoursMaxInput, setHoursMaxInput] = useState(state.hoursMax || String(Math.max(initialMin, initialMax)))
  const [cityInput, setCityInput] = useState(state.locationCity)
  const [stateInput, setStateInput] = useState(state.locationState)
  const [stateTouched, setStateTouched] = useState(Boolean(state.locationState))
  const [autoFilledState, setAutoFilledState] = useState<string | null>(null)

  const normalizedStateInput = normalizeStateCode(stateInput)

  const citySuggestions = useMemo(
    () => Array.from(new Set(US_CITY_OPTIONS.map((option) => option.city))).sort((a, b) => a.localeCompare(b)),
    []
  )

  const cityToStateMap = useMemo(() => {
    const bucket = new Map<string, Set<string>>()
    for (const option of US_CITY_OPTIONS) {
      const key = normalizeCityKey(option.city)
      const existing = bucket.get(key) ?? new Set<string>()
      existing.add(option.state)
      bucket.set(key, existing)
    }

    const resolved = new Map<string, string>()
    for (const [key, states] of bucket.entries()) {
      if (states.size === 1) {
        const [singleState] = Array.from(states)
        if (singleState) resolved.set(key, singleState)
      }
    }
    return resolved
  }, [])

  function href(overrides: Partial<FilterState>) {
    const merged: FilterState = { ...state, ...overrides }
    const params = new URLSearchParams()

    if (merged.sort) params.set('sort', merged.sort)
    if (merged.searchQuery) params.set('q', merged.searchQuery)
    if (merged.category) params.set('category', merged.category)
    if (merged.payMin) params.set('paymin', merged.payMin)
    if (merged.remoteOnly) params.set('remote', '1')
    if (merged.experience) params.set('exp', merged.experience)
    if (merged.hoursMin) params.set('hmin', merged.hoursMin)
    if (merged.hoursMax) params.set('hmax', merged.hoursMax)
    if (merged.locationCity) params.set('city', merged.locationCity)
    if (merged.locationState) params.set('state', normalizeStateCode(merged.locationState))
    if (merged.radius) params.set('radius', merged.radius)

    const query = params.toString()
    const hash = anchorId ? `#${anchorId}` : ''
    return query ? `${basePath}?${query}${hash}` : `${basePath}${hash}`
  }

  function chipClass(active: boolean) {
    return `inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
      active
        ? 'border-blue-300 bg-blue-50 text-blue-700'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
    }`
  }

  function setMinFromSlider(next: number) {
    const bounded = clamp(next, SLIDER_MIN, hoursMaxValue)
    setHoursMinValue(bounded)
    setHoursMinInput(String(bounded))
  }

  function setMaxFromSlider(next: number) {
    const bounded = clamp(next, hoursMinValue, SLIDER_MAX)
    setHoursMaxValue(bounded)
    setHoursMaxInput(String(bounded))
  }

  function setMinFromInput(raw: string) {
    setHoursMinInput(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const bounded = clamp(Math.round(parsed), SLIDER_MIN, hoursMaxValue)
    setHoursMinValue(bounded)
  }

  function setMaxFromInput(raw: string) {
    setHoursMaxInput(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const bounded = clamp(Math.round(parsed), hoursMinValue, SLIDER_MAX)
    setHoursMaxValue(bounded)
  }

  function onCityChange(rawValue: string) {
    setCityInput(rawValue)

    const parsed = parseCityStateInput(rawValue)
    if (parsed) {
      setCityInput(parsed.city)
      if (!stateTouched || !normalizedStateInput) {
        setStateInput(parsed.state)
        setAutoFilledState(parsed.state)
      }
      return
    }

    if (stateTouched || normalizedStateInput) return
    const inferredState = cityToStateMap.get(normalizeCityKey(rawValue))
    if (inferredState) {
      setStateInput(inferredState)
      setAutoFilledState(inferredState)
    }
  }

  function onStateChange(rawValue: string) {
    setStateTouched(true)
    setStateInput(rawValue.toUpperCase())
    setAutoFilledState(null)
  }

  const submitAction = anchorId ? `${basePath}#${anchorId}` : basePath

  const sliderFillStyle = useMemo(() => {
    const minPercent = ((hoursMinValue - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100
    const maxPercent = ((hoursMaxValue - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100
    return {
      background: `linear-gradient(to right, #d7dee8 ${minPercent}%, #3b82f6 ${minPercent}%, #1d4ed8 ${maxPercent}%, #d7dee8 ${maxPercent}%)`,
    }
  }, [hoursMinValue, hoursMaxValue])

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <Link
          href={href({
            sort: state.sort,
            searchQuery: '',
            category: '',
            payMin: '',
            remoteOnly: false,
            experience: '',
            hoursMin: '',
            hoursMax: '',
            locationCity: '',
            locationState: '',
            radius: '',
          })}
          className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          Clear
        </Link>
      </div>

      {noMatchesHint ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">No matches with current filters</p>
          <p className="mt-1">Try clearing: {noMatchesHint.labels.join(', ')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={noMatchesHint.clearSuggestedHref} className="font-medium text-amber-900 underline underline-offset-2">
              Clear suggested filter(s)
            </Link>
            <Link href={noMatchesHint.resetAllHref} className="text-amber-800/90 hover:underline">
              Reset all filters
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categories.map((category) => {
              const active = state.category === category
              return (
                <Link key={category} href={href({ category: active ? '' : category })} className={chipClass(active)}>
                  {category}
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: 'Any', value: '' },
              { label: 'Entry', value: 'entry' },
              { label: 'Mid', value: 'mid' },
              { label: 'Senior', value: 'senior' },
            ].map((option) => {
              const active = state.experience === option.value
              return (
                <Link key={option.label} href={href({ experience: option.value })} className={chipClass(active)}>
                  {option.label}
                </Link>
              )
            })}
            <Link href={href({ remoteOnly: !state.remoteOnly })} className={chipClass(state.remoteOnly)}>
              Remote only
            </Link>
          </div>
        </section>

        <form action={submitAction} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {state.sort ? <input type="hidden" name="sort" value={state.sort} /> : null}
          {state.searchQuery ? <input type="hidden" name="q" value={state.searchQuery} /> : null}
          {state.category ? <input type="hidden" name="category" value={state.category} /> : null}
          {state.remoteOnly ? <input type="hidden" name="remote" value="1" /> : null}
          {state.experience ? <input type="hidden" name="exp" value={state.experience} /> : null}

          <div>
            <label htmlFor="paymin" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Minimum pay ($/hour)
            </label>
            <input
              id="paymin"
              name="paymin"
              type="number"
              min={0}
              step={1}
              defaultValue={state.payMin}
              placeholder="20"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours per week</label>
            <div className="mt-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-inner">
              <div className="relative h-6 rounded-full" style={sliderFillStyle}>
                <input
                  type="range"
                  min={SLIDER_MIN}
                  max={SLIDER_MAX}
                  step={1}
                  value={hoursMinValue}
                  onChange={(event) => setMinFromSlider(Number(event.target.value))}
                  className="pointer-events-none absolute inset-0 z-20 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(37,99,235,0.45)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(37,99,235,0.45)]"
                />
                <input
                  type="range"
                  min={SLIDER_MIN}
                  max={SLIDER_MAX}
                  step={1}
                  value={hoursMaxValue}
                  onChange={(event) => setMaxFromSlider(Number(event.target.value))}
                  className="pointer-events-none absolute inset-0 z-30 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-700 [&::-moz-range-thumb]:shadow-[0_2px_10px_rgba(29,78,216,0.5)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-700 [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(29,78,216,0.5)]"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span>{hoursMinValue}h</span>
                <span>{hoursMaxValue}h</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">Drag both dots to set min/max hours.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="hmin" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hours min
              </label>
              <input
                id="hmin"
                name="hmin"
                type="number"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={1}
                value={hoursMinInput}
                onChange={(event) => setMinFromInput(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="hmax" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hours max
              </label>
              <input
                id="hmax"
                name="hmax"
                type="number"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={1}
                value={hoursMaxInput}
                onChange={(event) => setMaxFromInput(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</label>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={cityInput}
                  onChange={(event) => onCityChange(event.target.value)}
                  placeholder="City"
                  list="city-options"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
                <datalist id="city-options">
                  {citySuggestions.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>

              <div>
                <input
                  id="state-input"
                  type="text"
                  value={stateInput}
                  onChange={(event) => onStateChange(event.target.value)}
                  placeholder="State"
                  list="state-options"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 placeholder:text-slate-400"
                />
                <input type="hidden" name="state" value={normalizedStateInput} />
                <datalist id="state-options">
                  {US_STATE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>{`${option.code} - ${option.name}`}</option>
                  ))}
                </datalist>
                {autoFilledState ? <p className="mt-1 text-[11px] text-slate-500">Auto-filled {autoFilledState}</p> : null}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="radius" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Radius
            </label>
            <select
              id="radius"
              name="radius"
              defaultValue={state.radius}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Any distance</option>
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
              <option value="50">50 miles</option>
              <option value="100">100 miles</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply filters
          </button>
        </form>
      </div>
    </aside>
  )
}
