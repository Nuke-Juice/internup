'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function EmployerSignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createAccount() {
    setError(null)

    if (!email || !password) return setError('Email and password are required.')
    if (!companyName) return setError('Company name is required.')

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
      role: 'employer',
      verified: false,
    })

    await supabase.from('employer_profiles').insert({
      user_id: userId,
      company_name: companyName,
      website: website || null,
      contact_email: contactEmail || email,
      industry: industry || null,
      location: location || null,
    })

    setLoading(false)
    window.location.href = '/employer'
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/" className="text-sm font-medium text-blue-700 hover:underline">
              ← Back
            </a>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              Employer profile
            </h1>
            <p className="mt-2 text-slate-600">
              Post internships and review applicants with clearer signals.
            </p>
          </div>

          <div className="hidden sm:block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-medium text-slate-900">Goal</div>
            <div className="mt-1">Fewer applications. Better fit. Faster review.</div>
          </div>
        </div>

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
                <label className="text-sm font-medium text-slate-700">Location</label>
                <input
                  className={FIELD}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Salt Lake City, UT"
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                This is an MVP. You can edit these details later.
              </p>

              <div className="flex gap-3">
                <a
                  href="/"
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </a>
                <button
                  type="button"
                  onClick={createAccount}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? 'Creatingâ€¦' : 'Create account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
