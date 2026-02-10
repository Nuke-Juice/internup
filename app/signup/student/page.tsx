'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'
import OAuthButtons from '@/components/auth/OAuthButtons'

const SCHOOL_OPTIONS = [
  'University of Utah',
  'Utah State University',
  'Brigham Young University',
  'Weber State University',
  'Salt Lake Community College',
  'Westminster University',
  'Utah Valley University',
  'Southern Utah University',
  'University of Southern California',
  'University of California, Los Angeles',
  'University of California, Berkeley',
  'Stanford University',
  'Arizona State University',
  'University of Arizona',
  'University of Washington',
  'Oregon State University',
  'University of Colorado Boulder',
  'University of Texas at Austin',
  'Texas A&M University',
  'University of Michigan',
  'University of Illinois Urbana-Champaign',
  'New York University',
  'University of Florida',
  'University of North Carolina at Chapel Hill',
]

const COURSEWORK_CATALOG = [
  'Accounting 101',
  'Financial Accounting',
  'Managerial Accounting',
  'Corporate Finance',
  'Investments',
  'Financial Modeling',
  'Intro to CS',
  'Object-Oriented Programming',
  'Data Structures',
  'Algorithms',
  'Database Systems',
  'Operating Systems',
  'Computer Networks',
  'Machine Learning',
  'Data Science',
  'Statistics',
  'Probability',
  'Linear Algebra',
  'Calculus I',
  'Calculus II',
  'Economics',
  'Microeconomics',
  'Macroeconomics',
  'Marketing',
  'Consumer Behavior',
  'Operations Management',
  'Business Analytics',
  'Product Management',
  'Technical Writing',
  'Business Communication',
]

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function StudentSignupPage() {
  const friendlyCaptchaError = 'Please verify you’re human and try again.'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileLoadError, setTurnstileLoadError] = useState<string | null>(null)

  const [school, setSchool] = useState('University of Utah')
  const [year, setYear] = useState('Freshman')
  const [gender, setGender] = useState('')
  const [majorQuery, setMajorQuery] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<CanonicalMajor | null>(null)
  const [secondMajorQuery, setSecondMajorQuery] = useState('')
  const [selectedSecondMajor, setSelectedSecondMajor] = useState<CanonicalMajor | null>(null)
  const [majorCatalog, setMajorCatalog] = useState<CanonicalMajor[]>([])
  const [majorsLoading, setMajorsLoading] = useState(true)
  const [majorError, setMajorError] = useState<string | null>(null)
  const [coursework, setCoursework] = useState<string[]>([])
  const [courseworkInput, setCourseworkInput] = useState('')
  const experience: 'none' | 'projects' | 'internship' = 'none'
  const startMonth = 'May'
  const hoursPerWeek = '15'
  const interests = ''

  const [loading, setLoading] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showVerificationStep, setShowVerificationStep] = useState(false)

  function addCoursework(course: string) {
    const normalized = course.trim().replace(/\s+/g, ' ')
    if (!normalized) return
    setCoursework((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
    setCourseworkInput('')
  }

  function removeCoursework(course: string) {
    setCoursework((prev) => prev.filter((item) => item !== course))
  }

  useEffect(() => {
    const supabase = supabaseBrowser()

    async function loadMajorCatalog() {
      setMajorsLoading(true)
      const { data, error: catalogError } = await supabase
        .from('canonical_majors')
        .select('id, slug, name')
        .order('name', { ascending: true })
        .limit(500)

      if (catalogError) {
        setMajorError('Could not load majors right now.')
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
  }, [])

  const filteredCourseworkOptions = useMemo(() => {
    const query = courseworkInput.trim().toLowerCase()
    const available = COURSEWORK_CATALOG.filter((item) => !coursework.includes(item))
    if (!query) return available.slice(0, 8)
    return available.filter((item) => item.toLowerCase().includes(query)).slice(0, 8)
  }, [coursework, courseworkInput])

  function createAccount() {
    setError(null)
    setSuccess(null)
    if (!email || !password) return setError('Email and password are required.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    if (!selectedMajor) return setError('Please select a verified major.')
    if (selectedSecondMajor && selectedSecondMajor.id === selectedMajor.id) {
      return setError('Choose a different second major or leave it blank.')
    }
    if (!turnstileToken) return setError(friendlyCaptchaError)
    setShowVerificationStep(true)
  }

  async function sendVerificationEmail() {
    setError(null)
    setSuccess(null)
    if (!turnstileToken) return setError(friendlyCaptchaError)
    if (!selectedMajor) return setError('Please select a verified major.')
    setSendingVerification(true)
    const supabase = supabaseBrowser()
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
    const appOrigin = configuredAppUrl || window.location.origin
    const majorNames = Array.from(
      new Set(
        [selectedMajor.name, selectedSecondMajor?.name ?? null].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      )
    )
    const signupProfile = {
      school,
      gender: gender || null,
      major_id: selectedMajor.id,
      majors: majorNames,
      year,
      coursework,
      experience_level: experience,
      availability_start_month: startMonth,
      availability_hours_per_week: Number(hoursPerWeek),
      interests: interests || null,
    }
    try {
      const captchaResponse = await fetch('/api/turnstile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: turnstileToken,
          action: 'student_signup',
        }),
      })

      if (!captchaResponse.ok) {
        setSendingVerification(false)
        setTurnstileToken('')
        setTurnstileKey((value) => value + 1)
        return setError(friendlyCaptchaError)
      }
    } catch {
      setSendingVerification(false)
      setTurnstileToken('')
      setTurnstileKey((value) => value + 1)
      return setError(friendlyCaptchaError)
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appOrigin}/auth/callback?next=${encodeURIComponent('/account?role=student')}`,
        data: {
          role_hint: 'student',
          signup_profile: signupProfile,
        },
      },
    })

    if (signUpError) {
      setSendingVerification(false)
      const message = signUpError.message.toLowerCase()
      if (message.includes('rate limit') || message.includes('email rate limit exceeded')) {
        return setError(
          'Supabase email rate limit hit. For local dev, disable email confirmations in Supabase Auth settings or use an existing account.'
        )
      }
      return setError(signUpError.message)
    }

    const userId = data.user?.id
    if (!userId) {
      setSendingVerification(false)
      return setError('Signup succeeded but no user returned.')
    }

    if (!data.session) {
      setSendingVerification(false)
      setSuccess('Verification email sent. Open your email and click the verification link to finish signup.')
      return
    }

    const { error: userInsertError } = await supabase.from('users').upsert(
      {
        id: userId,
        role: 'student',
        verified: false,
      },
      { onConflict: 'id' }
    )
    if (userInsertError) {
      setSendingVerification(false)
      return setError(userInsertError.message)
    }

    const { error: profileInsertError } = await supabase.from('student_profiles').upsert(
      {
        user_id: userId,
        ...signupProfile,
      },
      { onConflict: 'user_id' }
    )
    if (profileInsertError) {
      setSendingVerification(false)
      return setError(profileInsertError.message)
    }

    setSendingVerification(false)
    window.location.href = '/account?welcome=1'
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Student signup</h1>
        <p className="mt-2 text-slate-600">Create your account to see curated internships.</p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Account</h2>
          <OAuthButtons roleHint="student" className="mt-4" />
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Or continue with email and password.</p>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input type="password" className={FIELD} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <input
                type="password"
                className={FIELD}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-sm font-semibold text-slate-900">Profile</h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">School</label>
                <select className={FIELD} value={school} onChange={(e) => setSchool(e.target.value)}>
                  {SCHOOL_OPTIONS.map((schoolOption) => (
                    <option key={schoolOption} value={schoolOption}>
                      {schoolOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Year</label>
                <select className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
                  <option>Freshman</option>
                  <option>Sophomore</option>
                  <option>Junior</option>
                  <option>Senior</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Gender</label>
                <select className={FIELD} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <MajorCombobox
                  inputId="student-signup-major"
                  label="Major (primary)"
                  query={majorQuery}
                  onQueryChange={(value) => {
                    setMajorQuery(value)
                    if (selectedMajor && value.trim() !== selectedMajor.name) {
                      setSelectedMajor(null)
                    }
                  }}
                  options={majorCatalog}
                  selectedMajor={selectedMajor}
                  onSelect={(major) => {
                    setSelectedMajor(major)
                    setMajorQuery(major.name)
                    setMajorError(null)
                  }}
                  loading={majorsLoading}
                  error={majorError}
                  placeholder="Start typing your major"
                />
                {!selectedMajor && majorQuery.trim().length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700">Select a verified major from the dropdown.</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <MajorCombobox
                  inputId="student-signup-second-major"
                  label="Second major (optional)"
                  query={secondMajorQuery}
                  onQueryChange={(value) => {
                    setSecondMajorQuery(value)
                    if (selectedSecondMajor && value.trim() !== selectedSecondMajor.name) {
                      setSelectedSecondMajor(null)
                    }
                  }}
                  options={majorCatalog}
                  selectedMajor={selectedSecondMajor}
                  onSelect={(major) => {
                    setSelectedSecondMajor(major)
                    setSecondMajorQuery(major.name)
                    setMajorError(null)
                  }}
                  loading={majorsLoading}
                  error={majorError}
                  placeholder="Add a second major (optional)"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Coursework</label>
                <div className="mt-2 rounded-md border border-slate-300 p-2">
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                      value={courseworkInput}
                      onChange={(e) => setCourseworkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const first = filteredCourseworkOptions[0]
                          if (first) addCoursework(first)
                        }
                      }}
                      placeholder="Search coursework and press Enter to add"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const first = filteredCourseworkOptions[0]
                        if (first) addCoursework(first)
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200">
                    {filteredCourseworkOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">No results found.</p>
                    ) : (
                      filteredCourseworkOptions.map((course) => (
                        <button
                          key={course}
                          type="button"
                          onClick={() => addCoursework(course)}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {course}
                        </button>
                      ))
                    )}
                  </div>
                  {coursework.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {coursework.map((course) => (
                        <button
                          key={course}
                          type="button"
                          onClick={() => removeCoursework(course)}
                          className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {course} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {showVerificationStep ? (
              <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-900">Verify your email</h3>
                <p className="mt-1 text-sm text-blue-900">
                  Click send to email a verification link to <span className="font-medium">{email}</span>. You can only finish signup
                  after opening that link.
                </p>
                {turnstileLoadError ? <p className="mt-3 text-sm text-red-600">{turnstileLoadError}</p> : null}
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}
                <TurnstileWidget
                  key={turnstileKey}
                  action="student_signup"
                  className="mt-4"
                  appearance="always"
                  onTokenChange={setTurnstileToken}
                  onError={(message) => {
                    if (window.location.hostname === 'localhost') {
                      setTurnstileLoadError('Turnstile blocked on localhost host config. Test on deployed domain or add localhost hostname in Turnstile.')
                      return
                    }
                    setTurnstileLoadError(message)
                  }}
                />
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowVerificationStep(false)}
                    disabled={sendingVerification}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={sendVerificationEmail}
                    disabled={sendingVerification}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {sendingVerification ? 'Sending…' : 'Send verification email'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {turnstileLoadError ? <p className="mt-4 text-sm text-red-600">{turnstileLoadError}</p> : null}
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                {success && <p className="mt-4 text-sm text-emerald-700">{success}</p>}

                <TurnstileWidget
                  key={turnstileKey}
                  action="student_signup"
                  className="mt-4"
                  appearance="always"
                  onTokenChange={setTurnstileToken}
                  onError={(message) => {
                    if (window.location.hostname === 'localhost') {
                      setTurnstileLoadError('Turnstile blocked on localhost host config. Test on deployed domain or add localhost hostname in Turnstile.')
                      return
                    }
                    setTurnstileLoadError(message)
                  }}
                />

                <button
                  onClick={createAccount}
                  disabled={loading}
                  className="mt-6 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
