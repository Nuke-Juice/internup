'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'

const COURSEWORK = [
  'Accounting 101',
  'Finance 201',
  'Intro to CS',
  'Data Structures',
  'Statistics',
  'Marketing',
]

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function StudentSignupPage() {
  const friendlyCaptchaError = 'Please verify you’re human and try again.'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)

  const [school, setSchool] = useState('University of Utah')
  const [year, setYear] = useState('Freshman')
  const [gender, setGender] = useState('')
  const [majorQuery, setMajorQuery] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<CanonicalMajor | null>(null)
  const [majorCatalog, setMajorCatalog] = useState<CanonicalMajor[]>([])
  const [majorsLoading, setMajorsLoading] = useState(true)
  const [majorError, setMajorError] = useState<string | null>(null)
  const [coursework, setCoursework] = useState<string[]>([])
  const experience: 'none' | 'projects' | 'internship' = 'none'
  const startMonth = 'May'
  const hoursPerWeek = '15'
  const interests = ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCourse(c: string) {
    setCoursework((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
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

  async function createAccount() {
    setError(null)
    if (!email || !password) return setError('Email and password are required.')
    if (!selectedMajor) return setError('Please select a verified major.')
    if (!turnstileToken) return setError(friendlyCaptchaError)

    setLoading(true)
    const supabase = supabaseBrowser()
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
        setLoading(false)
        setTurnstileToken('')
        setTurnstileKey((value) => value + 1)
        return setError(friendlyCaptchaError)
      }
    } catch {
      setLoading(false)
      setTurnstileToken('')
      setTurnstileKey((value) => value + 1)
      return setError(friendlyCaptchaError)
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setLoading(false)
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
      setLoading(false)
      return setError('Signup succeeded but no user returned.')
    }

    await supabase.from('users').insert({
      id: userId,
      role: 'student',
      verified: false,
    })

    await supabase.from('student_profiles').insert({
      user_id: userId,
      school,
      gender: gender || null,
      major_id: selectedMajor.id,
      majors: [selectedMajor.name],
      year,
      coursework,
      experience_level: experience,
      availability_start_month: startMonth,
      availability_hours_per_week: Number(hoursPerWeek),
      interests: interests || null,
    })

    setLoading(false)
    window.location.href = '/jobs'
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

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input type="password" className={FIELD} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-sm font-semibold text-slate-900">Profile</h2>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">School</label>
                <select className={FIELD} value={school} onChange={(e) => setSchool(e.target.value)}>
                  <option>University of Utah</option>
                  <option>Other</option>
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
                <label className="text-sm font-medium text-slate-700">Coursework</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {COURSEWORK.map((c) => (
                    <label key={c} className="flex items-center gap-2 rounded-md border p-2 text-sm text-slate-700">
                      <input type="checkbox" className="accent-blue-600" checked={coursework.includes(c)} onChange={() => toggleCourse(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <TurnstileWidget
              key={turnstileKey}
              action="student_signup"
              className="mt-4"
              onTokenChange={setTurnstileToken}
            />

            <button
              onClick={createAccount}
              disabled={loading}
              className="mt-6 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
