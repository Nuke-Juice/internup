'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { toUserFacingErrorMessage } from '@/lib/errors/userFacingError'
import { normalizeStateCode, US_STATE_OPTIONS } from '@/lib/locations/usLocationCatalog'
import EmployerProgressBar from '@/components/onboarding/EmployerProgressBar'
import EmployerStep1 from '@/components/onboarding/EmployerStep1'
import EmployerStep2 from '@/components/onboarding/EmployerStep2'
import EmployerStep3 from '@/components/onboarding/EmployerStep3'

const EMPLOYER_STEPS = 3
const EMPLOYER_DRAFT_KEY = 'onboarding:employer:details:v2'
const profilePhotoBuckets = ['avatars', 'profile-photos']

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

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
  overview: string | null
  avatar_url: string | null
}

type EmployerPublicProfileRow = {
  avatar_url: string | null
  about_us: string | null
}

type EmployerDraft = {
  stepIndex?: number
  firstName?: string
  lastName?: string
  companyName?: string
  website?: string
  contactEmail?: string
  industry?: string
  foundedYear?: string
  locationCity?: string
  locationStateInput?: string
  address?: string
  description?: string
  companySize?: string
  internshipTypes?: string
  typicalDuration?: string
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

function readEmployerDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(EMPLOYER_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EmployerDraft
  } catch {
    return null
  }
}

export default function EmployerSignupDetailsPage() {
  const [initializing, setInitializing] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)

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
  const [description, setDescription] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [internshipTypes, setInternshipTypes] = useState('')
  const [typicalDuration, setTypicalDuration] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canContinue = useMemo(() => {
    if (stepIndex === 0) {
      return Boolean(firstName.trim() && lastName.trim() && companyName.trim())
    }
    if (stepIndex === 2) {
      return Boolean(address.trim() && locationCity.trim() && resolveStateCode(locationStateInput))
    }
    return true
  }, [stepIndex, firstName, lastName, companyName, address, locationCity, locationStateInput])

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
        window.location.href = '/verify-required?next=%2Fsignup%2Femployer%2Fdetails&action=signup_profile_completion'
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
      setLastName(typeof metadata.last_name === 'string' ? metadata.last_name : fullNameTokens.slice(1).join(' '))

      const { data: userRow } = await supabase.from('users').select('role, verified').eq('id', user.id).maybeSingle()
      if (userRow?.verified !== true) {
        await supabase.from('users').update({ verified: true }).eq('id', user.id).eq('verified', false)
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

      const [{ data: profile }, { data: publicProfile }] = await Promise.all([
        supabase
          .from('employer_profiles')
          .select(
            'company_name, website, contact_email, industry, founded_date, location, location_city, location_state, location_address_line1, overview, avatar_url'
          )
          .eq('user_id', user.id)
          .maybeSingle<EmployerProfileRow>(),
        supabase.from('employer_public_profiles').select('avatar_url, about_us').eq('employer_id', user.id).maybeSingle<EmployerPublicProfileRow>(),
      ])

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
        setDescription(profile.overview ?? publicProfile?.about_us ?? '')
        setLogoUrl(profile.avatar_url ?? publicProfile?.avatar_url ?? '')
      } else {
        setContactEmail(user.email ?? '')
      }

      const draft = readEmployerDraft()
      if (draft) {
        if (typeof draft.firstName === 'string') setFirstName(draft.firstName)
        if (typeof draft.lastName === 'string') setLastName(draft.lastName)
        if (typeof draft.companyName === 'string') setCompanyName(draft.companyName)
        if (typeof draft.website === 'string') setWebsite(draft.website)
        if (typeof draft.contactEmail === 'string') setContactEmail(draft.contactEmail)
        if (typeof draft.industry === 'string') setIndustry(draft.industry)
        if (typeof draft.foundedYear === 'string') setFoundedYear(draft.foundedYear)
        if (typeof draft.locationCity === 'string') setLocationCity(draft.locationCity)
        if (typeof draft.locationStateInput === 'string') setLocationStateInput(draft.locationStateInput)
        if (typeof draft.address === 'string') setAddress(draft.address)
        if (typeof draft.description === 'string') setDescription(draft.description)
        if (typeof draft.companySize === 'string') setCompanySize(draft.companySize)
        if (typeof draft.internshipTypes === 'string') setInternshipTypes(draft.internshipTypes)
        if (typeof draft.typicalDuration === 'string') setTypicalDuration(draft.typicalDuration)
        if (typeof draft.stepIndex === 'number') setStepIndex(Math.min(Math.max(draft.stepIndex, 0), EMPLOYER_STEPS - 1))
      }

      setInitializing(false)
    }

    void initializePage()
  }, [])

  useEffect(() => {
    if (initializing || typeof window === 'undefined') return

    const draft: EmployerDraft = {
      stepIndex,
      firstName,
      lastName,
      companyName,
      website,
      contactEmail,
      industry,
      foundedYear,
      locationCity,
      locationStateInput,
      address,
      description,
      companySize,
      internshipTypes,
      typicalDuration,
    }

    window.localStorage.setItem(EMPLOYER_DRAFT_KEY, JSON.stringify(draft))
  }, [
    initializing,
    stepIndex,
    firstName,
    lastName,
    companyName,
    website,
    contactEmail,
    industry,
    foundedYear,
    locationCity,
    locationStateInput,
    address,
    description,
    companySize,
    internshipTypes,
    typicalDuration,
  ])

  function validateStep(index: number) {
    if (index === 0) {
      if (!firstName.trim()) return 'First name is required.'
      if (!lastName.trim()) return 'Last name is required.'
      if (!companyName.trim()) return 'Company name is required.'
    }

    if (index === 2) {
      if (!address.trim()) return 'Address is required.'
      if (!locationCity.trim()) return 'City is required.'
      const resolvedStateCode = resolveStateCode(locationStateInput)
      if (!resolvedStateCode) return 'State is required. Enter a valid state code or name.'
    }

    return null
  }

  async function saveProfileDetails() {
    setError(null)

    const validationError = validateStep(0) ?? validateStep(2)
    if (validationError) {
      setError(validationError)
      return
    }

    const resolvedStateCode = resolveStateCode(locationStateInput)
    if (!resolvedStateCode) {
      setError('State is required. Enter a valid state code or name.')
      return
    }

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
      window.location.href = '/verify-required?next=%2Fsignup%2Femployer%2Fdetails&action=signup_profile_completion'
      return
    }

    const { data: usersRow } = await supabase
      .from('users')
      .select('verified')
      .eq('id', user.id)
      .maybeSingle<{ verified: boolean | null }>()

    if (usersRow?.verified !== true) {
      await supabase.from('users').update({ verified: true }).eq('id', user.id).eq('verified', false)
    }

    let avatarUrl = logoUrl.trim()
    if (logoFile) {
      const uploadPath = `employers/${user.id}/avatar-${Date.now()}-${logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      let uploaded = false
      let uploadMessage = 'Unable to upload logo right now. Please try again.'

      for (const bucket of profilePhotoBuckets) {
        const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadPath, logoFile, {
          contentType: logoFile.type || 'image/jpeg',
          upsert: true,
        })

        if (uploadError) {
          uploadMessage = uploadError.message
          continue
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
        avatarUrl = urlData.publicUrl
        uploaded = true
        break
      }

      if (!uploaded) {
        setSaving(false)
        setError(toUserFacingErrorMessage(uploadMessage))
        return
      }
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
          overview: description.trim() || null,
          avatar_url: avatarUrl || null,
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
          about_us: description.trim() || null,
          avatar_url: avatarUrl || null,
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

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(EMPLOYER_DRAFT_KEY)
    }

    window.location.href = '/dashboard/employer'
  }

  function handleNext() {
    setError(null)
    const validationError = validateStep(stepIndex)
    if (validationError) {
      setError(validationError)
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, EMPLOYER_STEPS - 1))
  }

  function handleBack() {
    setError(null)
    setStepIndex((prev) => Math.max(prev - 1, 0))
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
        <p className="mt-2 text-slate-600">You&apos;re 2 minutes away from publishing trusted internship opportunities.</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmployerProgressBar currentStep={stepIndex + 1} totalSteps={EMPLOYER_STEPS} />

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {stepIndex === 0 ? 'Company basics' : stepIndex === 1 ? 'Hiring context' : 'Profile details'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {stepIndex === 0
                ? 'This helps students quickly understand who you are.'
                : stepIndex === 1
                  ? 'A bit of context improves candidate quality.'
                  : 'Finish your profile so candidates can trust and engage.'}
            </p>
          </div>

          <div key={stepIndex} className="mt-6 transition-all duration-300 ease-out">
            {stepIndex === 0 ? (
              <EmployerStep1
                fieldClassName={FIELD}
                firstName={firstName}
                lastName={lastName}
                companyName={companyName}
                industry={industry}
                website={website}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onCompanyNameChange={setCompanyName}
                onIndustryChange={setIndustry}
                onWebsiteChange={setWebsite}
              />
            ) : stepIndex === 1 ? (
              <EmployerStep2
                fieldClassName={FIELD}
                companySize={companySize}
                internshipTypes={internshipTypes}
                typicalDuration={typicalDuration}
                contactEmail={contactEmail}
                foundedYear={foundedYear}
                onCompanySizeChange={setCompanySize}
                onInternshipTypesChange={setInternshipTypes}
                onTypicalDurationChange={setTypicalDuration}
                onContactEmailChange={setContactEmail}
                onFoundedYearChange={setFoundedYear}
              />
            ) : (
              <EmployerStep3
                fieldClassName={FIELD}
                address={address}
                locationCity={locationCity}
                locationStateInput={locationStateInput}
                description={description}
                logoFile={logoFile}
                existingLogoUrl={logoUrl}
                onAddressChange={setAddress}
                onLocationCityChange={setLocationCity}
                onLocationStateInputChange={setLocationStateInput}
                onDescriptionChange={setDescription}
                onLogoChange={setLogoFile}
              />
            )}
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={stepIndex === 0 || saving}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            {stepIndex < EMPLOYER_STEPS - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canContinue || saving}
                className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={saveProfileDetails}
                disabled={!canContinue || saving}
                className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Finish signup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
