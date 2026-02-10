'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  location: string | null
  location_address_line1: string | null
}

export default function EmployerSignupDetailsPage() {
  const [initializing, setInitializing] = useState(true)

  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
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
          '/signup/employer?error=Verify+your+email+before+completing+your+profile+details.'
        return
      }

      const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
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
            verified: false,
          },
          { onConflict: 'id' }
        )
      }

      const { data: profile } = await supabase
        .from('employer_profiles')
        .select('company_name, website, contact_email, industry, location, location_address_line1')
        .eq('user_id', user.id)
        .maybeSingle<EmployerProfileRow>()

      if (profile) {
        setCompanyName(profile.company_name ?? '')
        setWebsite(profile.website ?? '')
        setContactEmail(profile.contact_email ?? user.email ?? '')
        setIndustry(profile.industry ?? '')
        setLocation(profile.location ?? '')
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

    if (!companyName.trim()) return setError('Company name is required.')
    if (!address.trim()) return setError('Address is required.')

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
        '/signup/employer?error=Verify+your+email+before+completing+your+profile+details.'
      return
    }

    const [{ error: userError }, { error: profileError }] = await Promise.all([
      supabase.from('users').upsert(
        {
          id: user.id,
          role: 'employer',
          verified: false,
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
          location: location.trim() || null,
          location_address_line1: address.trim(),
        },
        { onConflict: 'user_id' }
      ),
    ])

    setSaving(false)

    if (userError) return setError(userError.message)
    if (profileError) return setError(profileError.message)

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

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input
                className={FIELD}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Salt Lake City, UT"
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
