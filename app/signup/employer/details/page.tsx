'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { toUserFacingErrorMessage } from '@/lib/errors/userFacingError'
import { normalizeStateCode, US_STATE_OPTIONS } from '@/lib/locations/usLocationCatalog'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  founded_date: string | null
  location: string | null
  location_city: string | null
  location_state: string | null
  location_address_line1: string | null
}

function parseLocation(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) return { city: '', state: '' }
  const [cityRaw, stateRaw] = raw.split(',').map((part) => part.trim())
  return {
    city: cityRaw ?? '',
    state: stateRaw ?? '',
  }
}

function resolveStateCode(value: string) {
  const directCode = normalizeStateCode(value)
  if (directCode) return directCode
  const normalized = value.trim().toLowerCase()
  if (!normalized) return ''
  const byName = US_STATE_OPTIONS.find((option) => option.name.toLowerCase() === normalized)
  return byName?.code ?? ''
}

function extractYear(value: string | null | undefined) {
  if (!value) return ''
  const match = value.match(/^(\d{4})/)
  return match ? match[1] : ''
}

function toFoundedDateValue(year: string) {
  const trimmed = year.trim()
  if (!trimmed) return null
  if (!/^\d{4}$/.test(trimmed)) return null
  return `${trimmed}-01-01`
}

export default function EmployerSignupDetailsPage() {
  const [initializing, setInitializing] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [industry, setIndustry] = useState('')
  const [foundedYear, setFoundedYear] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationStateInput, setLocationStateInput] = useState('')
  const [address, setAddress] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()

    async function initializePage() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/signup/employer?error=Sign+in+to+continue+signup.'
        return
      }

      if (!user.email_confirmed_at) {
        window.location.href =
          '/verify-required?next=%2Fsignup%2Femployer%2Fdetails&action=signup_profile_completion'
        return
      }

      const metadata = (user.user_metadata ?? {}) as {
        first_name?: string
        last_name?: string
        full_name?: string
      }
      const fullNameTokens =
        typeof metadata.full_name === 'string'
          ? metadata.full_name
              .split(/\s+/)
              .map((part) => part.trim())
              .filter(Boolean)
          : []
      setFirstName(typeof metadata.first_name === 'string' ? metadata.first_name : fullNameTokens[0] ?? '')
      setLastName(
        typeof metadata.last_name === 'string' ? metadata.last_name : fullNameTokens.slice(1).join(' ')
      )

      const { data: userRow } = await supabase.from('users').select('role, verified').eq('id', user.id).maybeSingle()
      if (userRow?.verified !== true) {
        window.location.href =
          '/verify-required?next=%2Fsignup%2Femployer%2Fdetails&action=signup_profile_completion'
        return
      }
      const role = userRow?.role

      if (role === 'student') {
        window.location.href = '/signup/student/details'
        return
      }

      if (!role || role === 'employer') {
        await supabase.from('users').upsert(
          {
            id: user.id,
            role: 'employer',
          },
          { onConflict: 'id' }
        )
      }

      const { data: profile } = await supabase
        .from('employer_profiles')
        .select('company_name, website, contact_email, industry, founded_date, location, location_city, location_state, location_address_line1')
        .eq('user_id', user.id)
        .maybeSingle<EmployerProfileRow>()

      if (profile) {
        const parsedLocation = parseLocation(profile.location)
        setCompanyName(profile.company_name ?? '')
        setWebsite(profile.website ?? '')
        setContactEmail(profile.contact_email ?? user.email ?? '')
        setIndustry(profile.industry ?? '')
        setFoundedYear(extractYear(profile.founded_date))
        setLocationCity(profile.location_city ?? parsedLocation.city)
        setLocationStateInput(profile.location_state ?? parsedLocation.state)
        setAddress(profile.location_address_line1 ?? '')
      } else {
        setContactEmail(user.email ?? '')
      }

      setInitializing(false)
    }

    void initializePage()
  }, [])

  async function saveProfileDetails() {
    setError(null)

    if (!firstName.trim()) return setError('First name is required.')
    if (!lastName.trim()) return setError('Last name is required.')
    if (!companyName.trim()) return setError('Company name is required.')
    if (!address.trim()) return setError('Address is required.')
    if (!locationCity.trim()) return setError('City is required.')
    const resolvedStateCode = resolveStateCode(locationStateInput)
    if (!resolvedStateCode) return setError('State is required. Enter a valid state code or name.')

    setSaving(true)
    const supabase = supabaseBrowser()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      window.location.href = '/signup/employer?error=Sign+in+to+continue+signup.'
      return
    }

    if (!user.email_confirmed_at) {
      setSaving(false)
      window.location.href =
        '/verify-required?next=%2Fsignup%2Femployer%2Fdetails&action=signup_profile_completion'
      return
    }

    const { data: usersRow } = await supabase
      .from('users')
      .select('verified')
      .eq('id', user.id)
      .maybeSingle<{ verified: boolean | null }>()

    if (usersRow?.verified !== true) {
      setSaving(false)
      window.location.href =
        '/verify-required?next=%2Fsignup%2Femployer%2Fdetails&action=signup_profile_completion'
      return
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const foundedDateValue = toFoundedDateValue(foundedYear)
    const [{ error: userError }, { error: profileError }, { error: publicProfileError }, { error: authError }] = await Promise.all([
      supabase.from('users').upsert(
        {
          id: user.id,
          role: 'employer',
        },
        { onConflict: 'id' }
      ),
      supabase.from('employer_profiles').upsert(
        {
          user_id: user.id,
          company_name: companyName.trim(),
          website: website.trim() || null,
          contact_email: contactEmail.trim() || user.email || null,
          industry: industry.trim() || null,
          founded_date: foundedDateValue,
          location: `${locationCity.trim()}, ${resolvedStateCode}`,
          location_city: locationCity.trim(),
          location_state: resolvedStateCode,
          location_address_line1: address.trim(),
        },
        { onConflict: 'user_id' }
      ),
      supabase.from('employer_public_profiles').upsert(
        {
          employer_id: user.id,
          company_name: companyName.trim(),
          website: website.trim() || null,
          industry: industry.trim() || null,
          founded_date: foundedDateValue,
          location_city: locationCity.trim(),
          location_state: resolvedStateCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employer_id' }
      ),
      supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName || null,
        },
      }),
    ])

    setSaving(false)

    if (userError) return setError(toUserFacingErrorMessage(userError.message))
    if (profileError) return setError(toUserFacingErrorMessage(profileError.message))
    if (publicProfileError) return setError(toUserFacingErrorMessage(publicProfileError.message))
    if (authError) return setError(toUserFacingErrorMessage(authError.message))

    window.location.href = '/dashboard/employer'
  }

  if (initializing) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading profile details...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/signup/employer"
          aria-label="Back to account step"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Employer profile details</h1>
        <p className="mt-2 text-slate-600">Step 2 of 2: complete your company profile.</p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">First name</label>
              <input
                className={FIELD}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Last name</label>
              <input
                className={FIELD}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Company name</label>
              <input
                className={FIELD}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Canyon Capital"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Address</label>
              <input
                className={FIELD}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">City</label>
              <input
                className={FIELD}
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g., Salt Lake City"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">State</label>
              <input
                className={FIELD}
                value={locationStateInput}
                onChange={(e) => setLocationStateInput(e.target.value)}
                placeholder="UT or Utah"
                list="state-options"
              />
              <datalist id="state-options">
                {US_STATE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Website</label>
              <input
                className={FIELD}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Contact email</label>
              <input
                type="email"
                className={FIELD}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Industry</label>
              <input
                className={FIELD}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Finance"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Founded year (optional)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                className={FIELD}
                value={foundedYear}
                onChange={(e) => setFoundedYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="2018"
              />
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={saveProfileDetails}
            disabled={saving}
            className="mt-6 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Finish signup'}
          </button>
        </div>
      </div>
    </main>
  )
}
