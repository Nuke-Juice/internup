'use client'

import { useMemo, useState } from 'react'
import { US_STATE_OPTIONS, normalizeStateCode } from '@/lib/locations/usLocationCatalog'

type Props = {
  defaultState: string
  initialState?: string
  initialRegion?: string | null
}

function getStateName(stateCode: string) {
  const code = normalizeStateCode(stateCode)
  const match = US_STATE_OPTIONS.find((state) => state.code === code)
  return match ? `${match.name} (${match.code})` : code
}

export default function RemoteEligibilityCompactField({
  defaultState,
  initialState = '',
  initialRegion = 'state',
}: Props) {
  const initialStateCode = normalizeStateCode(initialState) || normalizeStateCode(defaultState)
  const [remoteState, setRemoteState] = useState(initialStateCode)
  const [region, setRegion] = useState(initialRegion === 'us-wide' ? 'us-wide' : 'state')
  const [isOpen, setIsOpen] = useState(false)

  const stateOptions = useMemo(() => [...US_STATE_OPTIONS], [])
  const selectedLabel = region === 'us-wide' ? 'US-wide' : getStateName(remoteState || defaultState)

  return (
    <div className="sm:col-span-2" data-remote-eligibility-section="1">
      <label className="text-sm font-medium text-slate-700">Eligible location</label>
      <div className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        Eligible location: <span className="font-medium">{selectedLabel || 'Select a state'}</span>{' '}
        <button type="button" className="text-blue-700 hover:underline" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? 'close' : 'change'}
        </button>
      </div>

      {isOpen ? (
        <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRegion('state')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                region === 'state'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Single state
            </button>
            <button
              type="button"
              onClick={() => setRegion('us-wide')}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                region === 'us-wide'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              US-wide
            </button>
          </div>

          {region === 'state' ? (
            <select
              value={remoteState}
              onChange={(event) => setRemoteState(normalizeStateCode(event.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
            >
              <option value="">Select state</option>
              {stateOptions.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      <input type="hidden" name="remote_eligible_region" value={region} />
      <input type="hidden" name="remote_eligible_state" value={region === 'us-wide' ? '' : remoteState} />
    </div>
  )
}
