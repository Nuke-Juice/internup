'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [school, setSchool] = useState('University of Utah')
  const [year, setYear] = useState('Freshman')
  const [majorsText, setMajorsText] = useState('')
  const [coursework, setCoursework] = useState<string[]>([])
  const [experience, setExperience] = useState<'none' | 'projects' | 'internship'>('none')
  const [startMonth, setStartMonth] = useState('May')
  const [hoursPerWeek, setHoursPerWeek] = useState('15')
  const [interests, setInterests] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCourse(c: string) {
    setCoursework((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function createAccount() {
    setError(null)

    const majors = majorsText.split(',').map((m) => m.trim()).filter(Boolean)
    if (!email || !password) return setError('Email and password are required.')
    if (majors.length === 0) return setError('Please enter at least one major.')

    setLoading(true)
    const supabase = supabaseBrowser()

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
      majors,
      year,
      coursework,
      experience_level: experience,
      availability_start_month: startMonth,
      availability_hours_per_week: Number(hoursPerWeek),
      interests: interests || null,
    })

    setLoading(false)
    window.location.href = '/dashboard'
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back
        </a>

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

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Majors</label>
                <input className={FIELD} value={majorsText} onChange={(e) => setMajorsText(e.target.value)} />
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
