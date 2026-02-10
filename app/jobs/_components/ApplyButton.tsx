'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { APPLY_ERROR } from '@/lib/applyErrors'
import { buildAccountRecoveryHref } from '@/lib/applyRecovery'
import { applyFromMicroOnboardingAction } from './applyActions'
import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'

type Props = {
  listingId: string
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  className?: string
}

const availabilityOptions = [10, 20, 30]

function parseAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) {
    return 'Email/password did not match an existing account. A new account will be created with these credentials.'
  }
  if (normalized.includes('email rate limit exceeded') || normalized.includes('rate limit')) {
    return 'Signup rate limit reached. Try again in a minute or log in with an existing account.'
  }
  return message
}

export default function ApplyButton({ listingId, isAuthenticated, userRole = null, className }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [school, setSchool] = useState('')
  const [majorQuery, setMajorQuery] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<CanonicalMajor | null>(null)
  const [majorCatalog, setMajorCatalog] = useState<CanonicalMajor[]>([])
  const [majorsLoading, setMajorsLoading] = useState(false)
  const [majorCatalogError, setMajorCatalogError] = useState<string | null>(null)
  const [availability, setAvailability] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  const buttonClassName = useMemo(
    () =>
      className ||
      'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700',
    [className]
  )

  useEffect(() => {
    const supabase = supabaseBrowser()
    let active = true

    async function loadMajorCatalog() {
      setMajorsLoading(true)
      const { data, error: catalogError } = await supabase
        .from('canonical_majors')
        .select('id, slug, name')
        .order('name', { ascending: true })
        .limit(500)

      if (!active) return
      if (catalogError) {
        setMajorCatalogError('Could not load majors right now.')
        setMajorsLoading(false)
        return
      }

      setMajorCatalog(
        (data ?? []).filter(
          (row): row is CanonicalMajor =>
            typeof row.id === 'string' &&
            typeof row.slug === 'string' &&
            typeof row.name === 'string'
        )
      )
      setMajorsLoading(false)
    }

    void loadMajorCatalog()
    return () => {
      active = false
    }
  }, [])

  async function trackApplyClick() {
    try {
      await fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'click_apply',
          properties: { listing_id: listingId, is_authenticated: isAuthenticated, user_role: userRole ?? null },
        }),
        keepalive: true,
      })
    } catch {
      // no-op
    }
  }

  async function submitMicroOnboarding() {
    setError(null)

    if (!school.trim() || !selectedMajor) {
      return setError('School and major are required.')
    }
    if (!email.trim() || !password.trim()) {
      return setError('Email and password are required to continue.')
    }

    setLoading(true)
    const supabase = supabaseBrowser()

    let {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          setLoading(false)
          return setError(parseAuthError(signUpError.message))
        }

        user = signUpData.user
      } else {
        user = signInData.user
      }
    }

    if (!user) {
      setLoading(false)
      return setError('Could not start a session. Please verify your email or try logging in first.')
    }

    const { data: userRow, error: userRowError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (userRowError) {
      setLoading(false)
      return setError(userRowError.message)
    }

    if (!userRow) {
      const { error: createUserError } = await supabase.from('users').insert({
        id: user.id,
        role: 'student',
        verified: false,
      })

      if (createUserError) {
        setLoading(false)
        return setError(createUserError.message)
      }
    }

    if (userRow?.role && userRow.role !== 'student') {
      setLoading(false)
      return setError('This account is not a student account. Use a student account to apply.')
    }

    const { error: profileError } = await supabase.from('student_profiles').upsert(
      {
        user_id: user.id,
        school: school.trim(),
        major_id: selectedMajor.id,
        majors: [selectedMajor.name],
        year: 'Freshman',
        coursework: [],
        experience_level: 'none',
        availability_start_month: 'May',
        availability_hours_per_week: availability,
        interests: null,
      },
      { onConflict: 'user_id' }
    )

    if (profileError) {
      setLoading(false)
      return setError(profileError.message)
    }

    const applicationResult = await applyFromMicroOnboardingAction({ listingId })
    if (!applicationResult.ok) {
      setLoading(false)

      if (applicationResult.code === APPLY_ERROR.RESUME_REQUIRED) {
        setOpen(false)
        router.push(
          buildAccountRecoveryHref({
            returnTo: `/apply/${listingId}`,
            code: APPLY_ERROR.RESUME_REQUIRED,
          })
        )
        router.refresh()
        return
      }

      if (applicationResult.code === APPLY_ERROR.PROFILE_INCOMPLETE) {
        setOpen(false)
        router.push(
          buildAccountRecoveryHref({
            returnTo: `/apply/${listingId}`,
            code: APPLY_ERROR.PROFILE_INCOMPLETE,
          })
        )
        router.refresh()
        return
      }

      if (applicationResult.code === APPLY_ERROR.ROLE_NOT_STUDENT) {
        return setError('This account is not a student account. Use a student account to apply.')
      }

      if (applicationResult.code === APPLY_ERROR.DUPLICATE_APPLICATION) {
        return setError('You already applied to this internship.')
      }

      if (applicationResult.code === APPLY_ERROR.AUTH_REQUIRED) {
        return setError('Please sign in to continue.')
      }

      if (applicationResult.code === APPLY_ERROR.EMAIL_NOT_VERIFIED) {
        setOpen(false)
        router.push(`/verify-required?next=${encodeURIComponent(`/apply/${listingId}`)}&action=application_submit`)
        router.refresh()
        return
      }

      return setError('Could not submit application right now. Please try again.')
    }

    setOpen(false)
    setLoading(false)
    router.push('/applications')
    router.refresh()
  }

  if (userRole === 'employer') {
    return (
      <button
        type="button"
        disabled
        title="Employer accounts cannot apply. Switch to a student account to apply."
        className={`${buttonClassName} cursor-not-allowed opacity-60`}
      >
        Switch to student account to apply
      </button>
    )
  }

  if (isAuthenticated && userRole === 'student') {
    return (
      <a
        href={`/apply/${listingId}`}
        className={buttonClassName}
        onClick={() => {
          void trackApplyClick()
        }}
      >
        Apply
      </a>
    )
  }

  if (isAuthenticated) {
    return (
      <a
        href="/account"
        className={buttonClassName}
        onClick={() => {
          void trackApplyClick()
        }}
      >
        Choose account type to apply
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => {
          void trackApplyClick()
          setOpen(true)
        }}
      >
        Apply
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Quick onboarding</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Tell us your school, major, and availability to apply.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">School</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  placeholder="e.g., University of Utah"
                />
              </div>

              <div>
                <MajorCombobox
                  inputId="apply-major-input"
                  label="Major"
                  query={majorQuery}
                  onQueryChange={(value) => {
                    setMajorQuery(value)
                    if (selectedMajor && value.trim() !== selectedMajor.name) {
                      setSelectedMajor(null)
                    }
                  }}
                  options={majorCatalog}
                  selectedMajor={selectedMajor}
                  onSelect={(majorOption) => {
                    setSelectedMajor(majorOption)
                    setMajorQuery(majorOption.name)
                    setMajorCatalogError(null)
                  }}
                  loading={majorsLoading}
                  error={majorCatalogError}
                  placeholder="Start typing your major"
                />
                {!selectedMajor && majorQuery.trim().length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700">Select a verified major from the dropdown.</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Availability (hrs/week)</label>
                <div className="mt-2 flex gap-2">
                  {availabilityOptions.map((option) => {
                    const selected = availability === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAvailability(option)}
                        className={`rounded-md border px-3 py-2 text-sm ${
                          selected
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={submitMicroOnboarding}
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Submitting...' : 'Continue and apply'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
