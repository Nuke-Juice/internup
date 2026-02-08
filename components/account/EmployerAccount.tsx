'use client'

import { useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { normalizeSkillsClient } from '@/lib/skills/normalizeSkillsClient'

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  location: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  location: string | null
  pay: string | null
  created_at: string | null
}

type CompanyMeta = {
  logoUrl?: string
  about?: string
}

type Props = {
  userId: string
  userEmail: string | null
  initialProfile: EmployerProfileRow | null
  recentInternships: InternshipRow[]
}

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const categories = ['Finance', 'Accounting', 'Data', 'Marketing', 'Operations', 'Engineering']
const workModes = [
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'on-site' },
] as const
const seasonOptions = ['Summer 2026', 'Fall 2026', 'Spring 2027']
const durationOptions = ['8-10 weeks', '10-12 weeks', 'Part-time (semester)']

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function includesTag(tags: string[], value: string) {
  const normalized = normalizeTag(value).toLowerCase()
  return tags.some((tag) => normalizeTag(tag).toLowerCase() === normalized)
}

function addTag(tags: string[], value: string) {
  const normalized = normalizeTag(value)
  if (!normalized || includesTag(tags, normalized)) return tags
  return [...tags, normalized]
}

function parseCompanyMeta(value: string | null): CompanyMeta {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as CompanyMeta
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function buildDescription(details: {
  description: string
  roleCategory: string
  term: string
  duration: string
  applyLink: string
  applyEmail: string
}) {
  const applyLine = details.applyLink.trim()
    ? `Apply link: ${details.applyLink.trim()}`
    : `Apply email: ${details.applyEmail.trim()}`

  return [
    details.description.trim(),
    '',
    `Category: ${details.roleCategory}`,
    `Season: ${details.term}`,
    `Duration: ${details.duration}`,
    applyLine,
  ].join('\n')
}

export default function EmployerAccount({
  userId,
  userEmail,
  initialProfile,
  recentInternships,
}: Props) {
  const meta = useMemo(() => parseCompanyMeta(initialProfile?.industry ?? null), [initialProfile?.industry])

  const [companyName, setCompanyName] = useState(initialProfile?.company_name ?? '')
  const [website, setWebsite] = useState(initialProfile?.website ?? '')
  const [logoUrl, setLogoUrl] = useState(meta.logoUrl ?? '')
  const [about, setAbout] = useState(meta.about ?? '')
  const [contactEmail, setContactEmail] = useState(initialProfile?.contact_email ?? userEmail ?? '')

  const [title, setTitle] = useState('')
  const [roleCategory, setRoleCategory] = useState(categories[0])
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [workMode, setWorkMode] = useState<(typeof workModes)[number]['value']>('hybrid')
  const [isPaid, setIsPaid] = useState(true)
  const [payRange, setPayRange] = useState('$20-$28/hr')
  const [term, setTerm] = useState(seasonOptions[0])
  const [duration, setDuration] = useState(durationOptions[1])
  const [hoursMin, setHoursMin] = useState('10')
  const [hoursMax, setHoursMax] = useState('20')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [preferredSkills, setPreferredSkills] = useState<string[]>([])
  const [requiredSkillInput, setRequiredSkillInput] = useState('')
  const [preferredSkillInput, setPreferredSkillInput] = useState('')
  const [resumeRequired, setResumeRequired] = useState(true)
  const [applicationDeadline, setApplicationDeadline] = useState('')
  const [applyLink, setApplyLink] = useState('')
  const [applyEmail, setApplyEmail] = useState(initialProfile?.contact_email ?? userEmail ?? '')
  const [description, setDescription] = useState(
    'You will support day-to-day projects, collaborate with the team, and present a final recommendation.'
  )

  const [savingCompany, setSavingCompany] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const titleError = title.trim() ? null : 'Title is required.'
  const categoryError = roleCategory.trim() ? null : 'Role category is required.'
  const locationCityError = locationCity.trim() ? null : 'City is required.'
  const locationStateError = locationState.trim() ? null : 'State is required.'
  const minHours = Number(hoursMin)
  const maxHours = Number(hoursMax)
  const hoursError =
    Number.isFinite(minHours) && Number.isFinite(maxHours) && minHours > 0 && maxHours >= minHours
      ? null
      : 'Enter a valid weekly hours range.'
  const requiredSkillsError = requiredSkills.length > 0 ? null : 'Add at least one required skill.'
  const deadlineError = applicationDeadline.trim() ? null : 'Application deadline is required.'
  const applyError = applyLink.trim() || applyEmail.trim() ? null : 'Add apply link or email.'
  const descriptionError = description.trim() ? null : 'Description is required.'

  async function saveCompanyBasics() {
    setError(null)
    setSuccess(null)

    if (!companyName.trim()) {
      setError('Company name is required.')
      return
    }

    setSavingCompany(true)
    const supabase = supabaseBrowser()

    const companyMeta = logoUrl.trim() || about.trim() ? JSON.stringify({ logoUrl: logoUrl.trim() || undefined, about: about.trim() || undefined }) : null

    const { error: saveError } = await supabase.from('employer_profiles').upsert(
      {
        user_id: userId,
        company_name: companyName.trim(),
        website: website.trim() || null,
        contact_email: contactEmail.trim() || userEmail || null,
        industry: companyMeta,
        location: initialProfile?.location ?? null,
      },
      { onConflict: 'user_id' }
    )

    setSavingCompany(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setSuccess('Company basics saved.')
  }

  async function createInternship() {
    setError(null)
    setSuccess(null)

    if (!companyName.trim()) {
      setError('Set company name first in Company Basics.')
      return
    }

    if (
      titleError ||
      categoryError ||
      locationCityError ||
      locationStateError ||
      hoursError ||
      requiredSkillsError ||
      deadlineError ||
      applyError ||
      descriptionError
    ) {
      setError('Please complete the required fields in Create Internship.')
      return
    }

    setPosting(true)
    const supabase = supabaseBrowser()

    const normalizedLocation = `${locationCity.trim()}, ${locationState.trim()} (${workMode})`
    const normalizedRequiredSkills = requiredSkills.map(normalizeTag).filter(Boolean)
    const normalizedPreferredSkills = preferredSkills.map(normalizeTag).filter(Boolean)
    const [{ skillIds: requiredSkillIds, unknown: requiredUnknown }, { skillIds: preferredSkillIds, unknown: preferredUnknown }] =
      await Promise.all([
        normalizeSkillsClient(normalizedRequiredSkills),
        normalizeSkillsClient(normalizedPreferredSkills),
      ])

    const combinedDescription = buildDescription({
      description,
      roleCategory,
      term,
      duration,
      applyLink,
      applyEmail,
    })

    const { data: insertedInternship, error: insertError } = await supabase
      .from('internships')
      .insert({
      employer_id: userId,
      title: title.trim(),
      company_name: companyName.trim(),
      location: normalizedLocation,
      location_city: locationCity.trim(),
      location_state: locationState.trim().toUpperCase(),
      description: combinedDescription,
      experience_level: 'entry',
      role_category: roleCategory.trim(),
      work_mode: workMode,
      term: term.trim(),
      hours_min: minHours,
      hours_max: maxHours,
      required_skills: normalizedRequiredSkills,
      preferred_skills: normalizedPreferredSkills,
      resume_required: resumeRequired,
      application_deadline: applicationDeadline || null,
      majors: roleCategory,
      hours_per_week: maxHours,
      pay: isPaid ? payRange.trim() || 'Paid (details on apply)' : 'Unpaid',
      })
      .select('id')
      .single()

    if (insertError) {
      setPosting(false)
      setError(insertError.message)
      return
    }

    if (insertedInternship?.id) {
      if (requiredSkillIds.length > 0) {
        const { error: requiredJoinError } = await supabase.from('internship_required_skill_items').insert(
          requiredSkillIds.map((skillId) => ({
            internship_id: insertedInternship.id,
            skill_id: skillId,
          }))
        )
        if (requiredJoinError) {
          setError(`Internship created, but required canonical skills could not be linked: ${requiredJoinError.message}`)
        }
      }

      if (preferredSkillIds.length > 0) {
        const { error: preferredJoinError } = await supabase.from('internship_preferred_skill_items').insert(
          preferredSkillIds.map((skillId) => ({
            internship_id: insertedInternship.id,
            skill_id: skillId,
          }))
        )
        if (preferredJoinError) {
          setError(`Internship created, but preferred canonical skills could not be linked: ${preferredJoinError.message}`)
        }
      }
    }

    setTitle('')
    setLocationCity('')
    setLocationState('')
    setRequiredSkills([])
    setPreferredSkills([])
    setRequiredSkillInput('')
    setPreferredSkillInput('')
    setApplyLink('')
    setApplicationDeadline('')
    setDescription(
      'You will support day-to-day projects, collaborate with the team, and present a final recommendation.'
    )

    const unknownSkills = [...requiredUnknown, ...preferredUnknown]
    if (unknownSkills.length > 0) {
      setPosting(false)
      setSuccess(`Internship created. Saved fallback text for unrecognized skills: ${unknownSkills.join(', ')}`)
      return
    }
    setPosting(false)
    setSuccess('Internship created.')
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Employer account</h1>
        <p className="mt-1 text-sm text-slate-600">Save company basics once, then post internships fast.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Company basics</h2>
        <p className="mt-1 text-sm text-slate-600">One-time setup for your posting profile.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Company name</label>
            <input
              className={FIELD}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Ventures"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Website (optional)</label>
            <input
              className={FIELD}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://company.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Logo URL (optional)</label>
            <input
              className={FIELD}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://.../logo.png"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">About (optional)</label>
            <textarea
              className={FIELD}
              rows={3}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="What your team works on and who this role is best for."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Contact email</label>
            <input
              className={FIELD}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="hiring@company.com"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={saveCompanyBasics}
            disabled={savingCompany}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {savingCompany ? 'Saving...' : 'Save company basics'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
          <p className="mt-1 text-sm text-slate-600">Light form with sensible defaults.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                className={FIELD}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Business Operations Intern"
              />
              {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Role category</label>
              <select className={FIELD} value={roleCategory} onChange={(e) => setRoleCategory(e.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {categoryError && <p className="mt-1 text-xs text-red-600">{categoryError}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">City</label>
              <input
                className={FIELD}
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="Salt Lake City"
              />
              {locationCityError && <p className="mt-1 text-xs text-red-600">{locationCityError}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">State</label>
              <input
                className={FIELD}
                value={locationState}
                onChange={(e) => setLocationState(e.target.value)}
                placeholder="UT"
                maxLength={2}
              />
              {locationStateError && <p className="mt-1 text-xs text-red-600">{locationStateError}</p>}
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-medium text-slate-700">Work mode</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {workModes.map((mode) => {
                  const active = workMode === mode.value
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setWorkMode(mode.value)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Term</label>
              <select className={FIELD} value={term} onChange={(e) => setTerm(e.target.value)}>
                {seasonOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Duration</label>
              <select className={FIELD} value={duration} onChange={(e) => setDuration(e.target.value)}>
                {durationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Hours min/week</label>
              <input
                className={FIELD}
                value={hoursMin}
                onChange={(e) => setHoursMin(e.target.value)}
                inputMode="numeric"
                placeholder="10"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Hours max/week</label>
              <input
                className={FIELD}
                value={hoursMax}
                onChange={(e) => setHoursMax(e.target.value)}
                inputMode="numeric"
                placeholder="20"
              />
              {hoursError && <p className="mt-1 text-xs text-red-600">{hoursError}</p>}
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                />
                Paid
              </label>
              {isPaid && (
                <input
                  className={FIELD}
                  value={payRange}
                  onChange={(e) => setPayRange(e.target.value)}
                  placeholder="$20-$28/hr"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Application deadline</label>
              <input
                className={FIELD}
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                type="date"
              />
              {deadlineError && <p className="mt-1 text-xs text-red-600">{deadlineError}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Apply link</label>
              <input
                className={FIELD}
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                placeholder="https://jobs.company.com/role"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Apply email</label>
              <input
                className={FIELD}
                value={applyEmail}
                onChange={(e) => setApplyEmail(e.target.value)}
                placeholder="hiring@company.com"
              />
              {applyError && <p className="mt-1 text-xs text-red-600">{applyError}</p>}
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  checked={resumeRequired}
                  onChange={(e) => setResumeRequired(e.target.checked)}
                />
                Resume required
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Required skills</label>
              <div className="mt-2 flex gap-2">
                <input
                  className={FIELD}
                  value={requiredSkillInput}
                  onChange={(e) => setRequiredSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setRequiredSkills((prev) => addTag(prev, requiredSkillInput))
                      setRequiredSkillInput('')
                    }
                  }}
                  placeholder="Add required skill"
                />
                <button
                  type="button"
                  onClick={() => {
                    setRequiredSkills((prev) => addTag(prev, requiredSkillInput))
                    setRequiredSkillInput('')
                  }}
                  className="mt-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {requiredSkills.length === 0 ? (
                  <span className="text-xs text-slate-500">No required skills yet.</span>
                ) : (
                  requiredSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() =>
                        setRequiredSkills((prev) =>
                          prev.filter((item) => normalizeTag(item).toLowerCase() !== normalizeTag(skill).toLowerCase())
                        )
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {skill} ×
                    </button>
                  ))
                )}
              </div>
              {requiredSkillsError && <p className="mt-1 text-xs text-red-600">{requiredSkillsError}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Preferred skills</label>
              <div className="mt-2 flex gap-2">
                <input
                  className={FIELD}
                  value={preferredSkillInput}
                  onChange={(e) => setPreferredSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setPreferredSkills((prev) => addTag(prev, preferredSkillInput))
                      setPreferredSkillInput('')
                    }
                  }}
                  placeholder="Add preferred skill"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreferredSkills((prev) => addTag(prev, preferredSkillInput))
                    setPreferredSkillInput('')
                  }}
                  className="mt-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {preferredSkills.length === 0 ? (
                  <span className="text-xs text-slate-500">No preferred skills yet.</span>
                ) : (
                  preferredSkills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() =>
                        setPreferredSkills((prev) =>
                          prev.filter((item) => normalizeTag(item).toLowerCase() !== normalizeTag(skill).toLowerCase())
                        )
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {skill} ×
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                className={FIELD}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="You will support day-to-day projects, collaborate with the team, and present a final recommendation."
              />
              {descriptionError && <p className="mt-1 text-xs text-red-600">{descriptionError}</p>}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={createInternship}
              disabled={posting}
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {posting ? 'Creating...' : 'Create internship'}
            </button>
          </div>
        </div>

        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
          <h3 className="text-sm font-semibold text-slate-900">Live preview</h3>
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900">{title.trim() || 'Internship title'}</div>
            <div className="mt-1 text-xs text-slate-500">{companyName.trim() || 'Company name'}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">
                {(locationCity.trim() && locationState.trim()
                  ? `${locationCity.trim()}, ${locationState.trim().toUpperCase()}`
                  : 'Location')}{' '}
                ({workMode})
              </span>
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">{roleCategory}</span>
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">
                {hoursMin}-{hoursMax} hrs/wk
              </span>
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">
                {isPaid ? payRange || 'Paid' : 'Unpaid'}
              </span>
            </div>
            <p className="mt-3 line-clamp-4 text-xs text-slate-600">{description || 'Description preview'}</p>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent listings</h4>
            {recentInternships.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No listings yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {recentInternships.map((listing) => (
                  <div key={listing.id} className="rounded-lg border border-slate-200 p-2">
                    <div className="text-xs font-medium text-slate-900">{listing.title || 'Internship'}</div>
                    <div className="text-xs text-slate-500">{listing.location || 'TBD'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
