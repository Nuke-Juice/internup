'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Cog, Pencil } from 'lucide-react'
import { useToast } from '@/components/feedback/ToastProvider'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import ConfirmSignOutButton from '@/components/auth/ConfirmSignOutButton'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { EmployerPlanId } from '@/lib/billing/plan'

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  location: string | null
  location_city: string | null
  location_state: string | null
  location_zip: string | null
  location_address_line1: string | null
  location_lat: number | null
  location_lng: number | null
  overview: string | null
  founded_date: string | null
  avatar_url: string | null
  header_image_url: string | null
}

type EmployerPublicProfileRow = {
  employer_id: string
  company_name: string | null
  tagline: string | null
  about_us: string | null
  website: string | null
  industry: string | null
  founded_date: string | null
  location_city: string | null
  location_state: string | null
  avatar_url: string | null
  header_image_url: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  location: string | null
  pay: string | null
  created_at: string | null
}

type Props = {
  userId: string
  userEmail: string | null
  initialFirstName: string
  initialLastName: string
  initialProfile: EmployerProfileRow | null
  initialPublicProfile: EmployerPublicProfileRow | null
  recentInternships: InternshipRow[]
  planId: EmployerPlanId
  isVerifiedEmployer: boolean
  isEmailVerified: boolean
}

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const profilePhotoBuckets = ['avatars', 'profile-photos']

function parseLegacyBusinessInfo(industryValue: string | null, overviewValue: string | null) {
  if (overviewValue && overviewValue.trim()) {
    return { industry: industryValue ?? '', overview: overviewValue }
  }

  const rawIndustry = industryValue ?? ''
  if (!rawIndustry.trim().startsWith('{')) {
    return { industry: rawIndustry, overview: overviewValue ?? '' }
  }

  try {
    const parsed = JSON.parse(rawIndustry) as { about?: unknown; industry?: unknown }
    return {
      industry: typeof parsed.industry === 'string' ? parsed.industry : '',
      overview: typeof parsed.about === 'string' ? parsed.about : '',
    }
  } catch {
    return { industry: rawIndustry, overview: overviewValue ?? '' }
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Date n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date n/a'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFoundedDate(value: string | null) {
  if (!value) return null
  const yearMatch = value.match(/^(\d{4})/)
  if (yearMatch) return yearMatch[1]
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return String(parsed.getUTCFullYear())
}

function toFoundedDateValue(year: string) {
  const trimmed = year.trim()
  if (!trimmed) return null
  if (!/^\d{4}$/.test(trimmed)) return null
  return `${trimmed}-01-01`
}

export default function EmployerAccount({
  userId,
  userEmail,
  initialFirstName,
  initialLastName,
  initialProfile,
  initialPublicProfile,
  recentInternships,
  planId,
  isVerifiedEmployer,
  isEmailVerified,
}: Props) {
  const canCustomizeHeader = planId === 'starter' || planId === 'pro'
  const headerFileInputRef = useRef<HTMLInputElement | null>(null)
  const legacyBusinessInfo = parseLegacyBusinessInfo(
    initialPublicProfile?.industry ?? initialProfile?.industry ?? null,
    initialPublicProfile?.about_us ?? initialProfile?.overview ?? null
  )

  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [activeTab, setActiveTab] = useState<'settings' | 'brand'>('brand')
  const isEditing = mode === 'edit'
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)

  const [companyName, setCompanyName] = useState(initialPublicProfile?.company_name ?? initialProfile?.company_name ?? '')
  const [tagline, setTagline] = useState(initialPublicProfile?.tagline ?? '')
  const [website, setWebsite] = useState(initialPublicProfile?.website ?? initialProfile?.website ?? '')
  const [locationCity, setLocationCity] = useState(initialPublicProfile?.location_city ?? initialProfile?.location_city ?? '')
  const [locationState, setLocationState] = useState(initialPublicProfile?.location_state ?? initialProfile?.location_state ?? '')
  const [locationZip, setLocationZip] = useState(initialProfile?.location_zip ?? '')
  const [locationAddressLine1, setLocationAddressLine1] = useState(initialProfile?.location_address_line1 ?? '')
  const [industry, setIndustry] = useState(legacyBusinessInfo.industry)
  const [foundedYear, setFoundedYear] = useState(
    formatFoundedDate(initialPublicProfile?.founded_date ?? initialProfile?.founded_date ?? null) ?? ''
  )
  const [overview, setOverview] = useState(legacyBusinessInfo.overview)
  const [contactEmail, setContactEmail] = useState(initialProfile?.contact_email ?? userEmail ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialPublicProfile?.avatar_url ?? initialProfile?.avatar_url ?? '')
  const [headerImageUrl, setHeaderImageUrl] = useState(initialPublicProfile?.header_image_url ?? initialProfile?.header_image_url ?? '')
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null)
  const [savingCompany, setSavingCompany] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { showToast } = useToast()
  const businessLocationLabel = [locationCity.trim(), locationState.trim()].filter(Boolean).join(', ')
  const businessAddressLabel = locationAddressLine1.trim()
  const foundedDateLabel = foundedYear.trim() || null

  async function saveCompanyBasics() {
    setError(null)
    setSuccess(null)

    if (!companyName.trim()) {
      const message = 'Company name is required.'
      setError(message)
      showToast({ kind: 'error', message, key: 'employer-basics-error:missing-name' })
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      const message = 'First and last name are required.'
      setError(message)
      showToast({ kind: 'error', message, key: 'employer-basics-error:missing-owner-name' })
      return
    }

    setSavingCompany(true)
    const supabase = supabaseBrowser()
    let nextAvatarUrl = avatarUrl.trim()
    let nextHeaderImageUrl = headerImageUrl.trim()

    if (profilePhotoFile) {
      const uploadPath = `employers/${userId}/avatar-${Date.now()}-${profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      let uploaded = false
      let uploadMessage = 'Unable to upload profile photo right now. Please try again.'

      for (const bucket of profilePhotoBuckets) {
        const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadPath, profilePhotoFile, {
          contentType: profilePhotoFile.type || 'image/jpeg',
          upsert: true,
        })

        if (uploadError) {
          uploadMessage = uploadError.message
          continue
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
        nextAvatarUrl = urlData.publicUrl
        uploaded = true
        break
      }

      if (!uploaded) {
        setSavingCompany(false)
        setError(uploadMessage)
        showToast({ kind: 'error', message: uploadMessage, key: `employer-basics-error:upload:${uploadMessage}` })
        return
      }
    }

    if (canCustomizeHeader && headerImageFile) {
      const uploadPath = `employers/${userId}/header-${Date.now()}-${headerImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      let uploaded = false
      let uploadMessage = 'Unable to upload company header image right now. Please try again.'

      for (const bucket of profilePhotoBuckets) {
        const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadPath, headerImageFile, {
          contentType: headerImageFile.type || 'image/jpeg',
          upsert: true,
        })

        if (uploadError) {
          uploadMessage = uploadError.message
          continue
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
        nextHeaderImageUrl = urlData.publicUrl
        uploaded = true
        break
      }

      if (!uploaded) {
        setSavingCompany(false)
        setError(uploadMessage)
        showToast({ kind: 'error', message: uploadMessage, key: `employer-basics-error:header-upload:${uploadMessage}` })
        return
      }
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const foundedDateValue = toFoundedDateValue(foundedYear)
    const [{ error: authError }, { error: saveError }, { error: savePublicError }] = await Promise.all([
      supabase.auth.updateUser({
        data: {
          avatar_url: nextAvatarUrl || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName || null,
        },
      }),
      supabase.from('employer_profiles').upsert(
        {
          user_id: userId,
          company_name: companyName.trim(),
          website: website.trim() || null,
          contact_email: contactEmail.trim() || userEmail || null,
          location: locationCity.trim() && locationState.trim() ? `${locationCity.trim()}, ${locationState.trim()}` : null,
          location_city: locationCity.trim() || null,
          location_state: locationState.trim() || null,
          location_zip: locationZip.trim() || null,
          location_address_line1: locationAddressLine1.trim() || null,
          industry: industry.trim() || null,
          overview: overview.trim() || null,
          founded_date: foundedDateValue,
          avatar_url: nextAvatarUrl || null,
          header_image_url: canCustomizeHeader ? nextHeaderImageUrl || null : initialProfile?.header_image_url ?? null,
        },
        { onConflict: 'user_id' }
      ),
      supabase.from('employer_public_profiles').upsert(
        {
          employer_id: userId,
          company_name: companyName.trim() || null,
          tagline: tagline.trim() || null,
          about_us: overview.trim() || null,
          website: website.trim() || null,
          industry: industry.trim() || null,
          founded_date: foundedDateValue,
          location_city: locationCity.trim() || null,
          location_state: locationState.trim() || null,
          avatar_url: nextAvatarUrl || null,
          header_image_url: canCustomizeHeader ? nextHeaderImageUrl || null : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employer_id' }
      ),
    ])

    setSavingCompany(false)

    if (authError) {
      setError(authError.message)
      showToast({ kind: 'error', message: authError.message, key: `employer-basics-error:auth:${authError.message}` })
      return
    }

    if (saveError) {
      setError(saveError.message)
      showToast({ kind: 'error', message: saveError.message, key: `employer-basics-error:save:${saveError.message}` })
      return
    }
    if (savePublicError) {
      setError(savePublicError.message)
      showToast({ kind: 'error', message: savePublicError.message, key: `employer-basics-error:public-save:${savePublicError.message}` })
      return
    }

    setAvatarUrl(nextAvatarUrl)
    if (canCustomizeHeader) {
      setHeaderImageUrl(nextHeaderImageUrl)
      setHeaderImageFile(null)
    }
    setProfilePhotoFile(null)
    const message = 'Company profile saved.'
    setSuccess(message)
    showToast({ kind: 'success', message, key: 'employer-basics-saved' })
    setMode('view')
  }

  function promptHeaderUpload() {
    if (canCustomizeHeader) {
      headerFileInputRef.current?.click()
      return
    }

    showToast({
      kind: 'warning',
      message: 'Company header images are available on Starter and Pro.',
      key: 'employer-header-upgrade-required',
      actionLabel: 'Upgrade to Starter',
      onAction: () => {
        window.location.href = '/upgrade'
      },
    })
  }

  return (
    <section className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('brand')}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === 'brand'
                  ? 'border border-blue-300 bg-blue-50 text-blue-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Brand page
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === 'settings'
                  ? 'border border-blue-300 bg-blue-50 text-blue-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Account settings
            </button>
          </div>
          <Link
            href={`/employers/${encodeURIComponent(userId)}`}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            View public page
          </Link>
        </div>
      </div>

      {!isEditing ? (
        activeTab === 'brand' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-40 w-full overflow-hidden rounded-t-2xl border-b border-slate-200 bg-slate-100">
            {headerImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerImageUrl} alt="Company header" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />
            )}
          </div>

          <div className="relative p-6">
            <button
              type="button"
              aria-label="Edit company profile"
              title="Edit company profile"
              onClick={() => setMode('edit')}
              className="absolute right-6 top-6 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Employer logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-500">Logo</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-3xl font-semibold text-slate-900">
                    {companyName.trim() || 'Company name not set'}
                  </h2>
                  {isVerifiedEmployer ? (
                    <EmployerVerificationBadge tier={planId} />
                  ) : (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        isEmailVerified
                          ? 'border-slate-200 bg-slate-50 text-slate-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isEmailVerified ? 'Email confirmed' : 'Email not verified'}
                    </span>
                  )}
                </div>
                {tagline.trim() ? (
                  <p className="mt-2 text-sm text-slate-600">{tagline}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {firstName.trim() || lastName.trim() ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      Recruiter: {[firstName.trim(), lastName.trim()].filter(Boolean).join(' ')}
                    </span>
                  ) : null}
                  {businessAddressLabel ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {businessAddressLabel}
                    </span>
                  ) : null}
                  {businessLocationLabel ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {businessLocationLabel}
                    </span>
                  ) : null}
                  {industry.trim() ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {industry}
                    </span>
                  ) : null}
                  {foundedDateLabel ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      Founded: {foundedDateLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">About us</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                  {overview.trim() || 'No company bio yet. Click Edit to add one.'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Links</h3>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {website.trim() ? (
                    <a href={website} target="_blank" rel="noreferrer" className="block text-blue-700 hover:underline">
                      {website}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Account settings</h2>
                <p className="mt-1 text-sm text-slate-600">Private owner and contact details.</p>
              </div>
              <button
                type="button"
                aria-label="Edit account settings"
                title="Edit account settings"
                onClick={() => setMode('edit')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Account owner</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {[firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'Not set'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Contact email</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{contactEmail.trim() || 'Not set'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Business address</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{businessAddressLabel || 'Not set'}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">City / state / ZIP</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {[locationCity.trim(), locationState.trim(), locationZip.trim()].filter(Boolean).join(', ') || 'Not set'}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {activeTab === 'brand' ? (
            <>
              <button
                type="button"
                onClick={promptHeaderUpload}
                className="group relative block h-36 w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                aria-label="Add company header image"
              >
                {headerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headerImageUrl} alt="Company header" className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 group-hover:bg-slate-900/5">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white/95 text-2xl font-semibold leading-none text-slate-600">
                    +
                  </span>
                </div>
              </button>
              <input
                ref={headerFileInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setHeaderImageFile(event.target.files?.[0] ?? null)}
                className="hidden"
              />
            </>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {activeTab === 'settings' ? (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700">First name</label>
                  <input className={FIELD} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Last name</label>
                  <input className={FIELD} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </>
            ) : null}

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Profile photo / logo</label>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Employer profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-500">Logo</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setProfilePhotoFile(event.target.files?.[0] ?? null)}
                  className="block text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Company name</label>
              <input className={FIELD} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Ventures" />
            </div>

            {activeTab === 'brand' ? (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Tagline</label>
                <input className={FIELD} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short value statement for students." />
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-slate-700">Industry</label>
              <input className={FIELD} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Financial Services" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Website (optional)</label>
              <input className={FIELD} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" />
            </div>

            {activeTab === 'brand' ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Founded year (optional)</label>
                <input
                  className={FIELD}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={foundedYear}
                  onChange={(e) => setFoundedYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="2018"
                />
              </div>
            ) : null}

            {activeTab === 'settings' ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Business address line 1 (optional)</label>
                <input className={FIELD} value={locationAddressLine1} onChange={(e) => setLocationAddressLine1(e.target.value)} placeholder="123 Main St" />
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-slate-700">Business city</label>
              <input className={FIELD} value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="Salt Lake City" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Business state</label>
              <input className={FIELD} value={locationState} onChange={(e) => setLocationState(e.target.value.toUpperCase())} placeholder="UT" maxLength={2} />
            </div>

            {activeTab === 'settings' ? (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700">Business ZIP (optional)</label>
                  <input className={FIELD} value={locationZip} onChange={(e) => setLocationZip(e.target.value)} placeholder="84101" />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Contact email</label>
                  <input className={FIELD} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hiring@company.com" />
                </div>
              </>
            ) : null}

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Overview</label>
              <textarea
                className={FIELD}
                rows={4}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="Describe what your business does and who thrives on your team."
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveCompanyBasics}
                disabled={savingCompany}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {savingCompany ? 'Saving...' : 'Save profile'}
              </button>
              <button
                type="button"
                onClick={() => setMode('view')}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent internships</h2>
            <p className="mt-1 text-sm text-slate-600">Use the employer dashboard to create and manage postings.</p>
          </div>
          <Link
            href="/dashboard/employer?create=1"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New internship
          </Link>
        </div>

        {recentInternships.length === 0 ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No internships yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {recentInternships.map((listing) => (
              <div key={listing.id} className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">{listing.title || 'Internship'}</div>
                <div className="mt-1 text-xs text-slate-500">{listing.location || 'Location TBD'} · {formatDate(listing.created_at)}</div>
                {listing.pay ? <div className="mt-1 text-xs text-slate-600">Compensation: {listing.pay}</div> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/jobs/${listing.id}`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View details
                  </Link>
                  <Link
                    href={`/inbox?internship_id=${encodeURIComponent(listing.id)}`}
                    className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Applicants
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Account controls</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/account/security"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Cog className="h-4 w-4" />
            Security settings
          </Link>
          <ConfirmSignOutButton className="inline-flex h-10 items-center justify-center rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100" />
        </div>
      </div>
    </section>
  )
}
