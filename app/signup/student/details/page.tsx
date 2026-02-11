'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { getUniversityCourseCatalog, hasUniversitySpecificCourses } from '@/lib/coursework/universityCourseCatalog'
import { normalizeCourseworkClient } from '@/lib/coursework/normalizeCourseworkClient'
import { supabaseBrowser } from '@/lib/supabase/client'
import { toUserFacingErrorMessage } from '@/lib/errors/userFacingError'
import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'

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

const YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior']

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

type StudentProfileRow = {
  school: string | null
  gender: string | null
  major_id: string | null
  majors: string[] | string | null
  year: string | null
  coursework: string[] | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
  interests: string | null
}

function parseMajors(value: StudentProfileRow['majors']) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((valuePart) => valuePart.trim())
      .filter(Boolean)
  }

  return []
}

export default function StudentSignupDetailsPage() {
  const [initializing, setInitializing] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [school, setSchool] = useState('')
  const [schoolQuery, setSchoolQuery] = useState('')
  const [schoolOpen, setSchoolOpen] = useState(false)
  const [year, setYear] = useState('')
  const [yearOpen, setYearOpen] = useState(false)
  const [gender, setGender] = useState('')
  const [majorQuery, setMajorQuery] = useState('')
  const [selectedMajor, setSelectedMajor] = useState<CanonicalMajor | null>(null)
  const [secondMajorQuery, setSecondMajorQuery] = useState('')
  const [selectedSecondMajor, setSelectedSecondMajor] = useState<CanonicalMajor | null>(null)
  const [coursework, setCoursework] = useState<string[]>([])
  const [courseworkInput, setCourseworkInput] = useState('')
  const [hoursPerWeek, setHoursPerWeek] = useState('15')
  const [interests, setInterests] = useState('')

  const [majorCatalog, setMajorCatalog] = useState<CanonicalMajor[]>([])
  const [majorsLoading, setMajorsLoading] = useState(true)
  const [majorError, setMajorError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedSchoolForCatalog = school || schoolQuery
  const courseworkCatalog = useMemo(
    () => getUniversityCourseCatalog(selectedSchoolForCatalog),
    [selectedSchoolForCatalog]
  )
  const hasSchoolSpecificCoursework = useMemo(
    () => hasUniversitySpecificCourses(selectedSchoolForCatalog),
    [selectedSchoolForCatalog]
  )

  function addCoursework(course: string) {
    const normalized = course.trim().replace(/\s+/g, ' ')
    if (!normalized) return
    setCoursework((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
    setCourseworkInput('')
  }

  function removeCoursework(course: string) {
    setCoursework((prev) => prev.filter((item) => item !== course))
  }

  const filteredCourseworkOptions = useMemo(() => {
    const query = courseworkInput.trim().toLowerCase()
    const available = courseworkCatalog.filter((item) => !coursework.includes(item))
    if (!query) return available.slice(0, 8)
    return available.filter((item) => item.toLowerCase().includes(query)).slice(0, 8)
  }, [coursework, courseworkCatalog, courseworkInput])

  const filteredSchoolOptions = useMemo(() => {
    const query = schoolQuery.trim().toLowerCase()
    if (!query) return SCHOOL_OPTIONS.slice(0, 10)
    return SCHOOL_OPTIONS.filter((option) => option.toLowerCase().includes(query)).slice(0, 10)
  }, [schoolQuery])

  const showSchoolDropdown = schoolOpen && schoolQuery.trim().length > 0 && school !== schoolQuery

  useEffect(() => {
    const supabase = supabaseBrowser()

    async function initializePage() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/signup/student?error=Sign+in+to+continue+signup.'
        return
      }

      if (!user.email_confirmed_at) {
        window.location.href =
          '/verify-required?next=%2Fsignup%2Fstudent%2Fdetails&action=signup_profile_completion'
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

      const [{ data: userRow }, { data: catalogData, error: catalogError }] = await Promise.all([
        supabase.from('users').select('role, verified').eq('id', user.id).maybeSingle(),
        supabase.from('canonical_majors').select('id, slug, name').order('name', { ascending: true }).limit(500),
      ])

      if (userRow?.verified !== true) {
        window.location.href =
          '/verify-required?next=%2Fsignup%2Fstudent%2Fdetails&action=signup_profile_completion'
        return
      }

      const role = userRow?.role
      if (role === 'employer') {
        window.location.href = '/signup/employer/details'
        return
      }

      if (!role || role === 'student') {
        await supabase.from('users').upsert(
          {
            id: user.id,
            role: 'student',
          },
          { onConflict: 'id' }
        )
      }

      if (catalogError) {
        setMajorError('Could not load majors right now.')
        setMajorsLoading(false)
      } else {
        const catalog = (catalogData ?? []).filter(
          (row): row is CanonicalMajor =>
            typeof row.id === 'string' && typeof row.slug === 'string' && typeof row.name === 'string'
        )
        setMajorCatalog(catalog)
        setMajorsLoading(false)

        const { data: profile } = await supabase
          .from('student_profiles')
          .select('school, gender, major_id, majors, year, coursework, availability_start_month, availability_hours_per_week, interests')
          .eq('user_id', user.id)
          .maybeSingle<StudentProfileRow>()

        if (profile) {
          const profileMajors = parseMajors(profile.majors)
          const hasExistingMajor = Boolean(profile.major_id) || profileMajors.length > 0
          const profileSchool = (profile.school ?? '').trim()
          const profileYear = (profile.year ?? '').trim()

          if (hasExistingMajor && SCHOOL_OPTIONS.includes(profileSchool)) {
            setSchool(profileSchool)
            setSchoolQuery(profileSchool)
          }
          if (hasExistingMajor && YEAR_OPTIONS.includes(profileYear)) {
            setYear(profileYear)
          }
          setGender(profile.gender || '')
          setCoursework(Array.isArray(profile.coursework) ? profile.coursework : [])
          setHoursPerWeek(profile.availability_hours_per_week ? String(profile.availability_hours_per_week) : '15')
          setInterests(profile.interests || '')

          const primaryMajor =
            profile.major_id && catalog.length > 0 ? catalog.find((item) => item.id === profile.major_id) || null : null
          if (primaryMajor) {
            setSelectedMajor(primaryMajor)
            setMajorQuery(primaryMajor.name)
          }

          const majorNames = parseMajors(profile.majors)
          const secondaryName = majorNames.find((name) => primaryMajor?.name !== name)
          if (secondaryName) {
            const secondaryMajor = catalog.find((item) => item.name === secondaryName) || null
            if (secondaryMajor) {
              setSelectedSecondMajor(secondaryMajor)
              setSecondMajorQuery(secondaryMajor.name)
            } else {
              setSecondMajorQuery(secondaryName)
            }
          }
        }
      }

      setInitializing(false)
    }

    void initializePage()
  }, [])

  async function saveProfileDetails() {
    setError(null)

    if (!firstName.trim()) return setError('First name is required.')
    if (!lastName.trim()) return setError('Last name is required.')
    if (!school.trim()) return setError('Please select your school.')
    if (!year.trim()) return setError('Please select your year.')
    if (!selectedMajor) return setError('Please select a verified major.')
    if (selectedSecondMajor && selectedSecondMajor.id === selectedMajor.id) {
      return setError('Choose a different second major or leave it blank.')
    }

    const parsedHours = Number(hoursPerWeek)
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      return setError('Availability hours per week must be a number greater than 0.')
    }

    setSaving(true)
    const supabase = supabaseBrowser()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      window.location.href = '/signup/student?error=Sign+in+to+continue+signup.'
      return
    }

    if (!user.email_confirmed_at) {
      setSaving(false)
      window.location.href =
        '/verify-required?next=%2Fsignup%2Fstudent%2Fdetails&action=signup_profile_completion'
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
        '/verify-required?next=%2Fsignup%2Fstudent%2Fdetails&action=signup_profile_completion'
      return
    }

    const majorNames = Array.from(
      new Set(
        [selectedMajor.name, selectedSecondMajor?.name ?? null].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      )
    )
    const normalizedCourseworkList = coursework
      .map((course) => course.trim().replace(/\s+/g, ' '))
      .filter(Boolean)
    let courseworkItemIds: string[] = []
    let mappedCategoryIdsFromText: string[] = []
    try {
      const normalized = await normalizeCourseworkClient(normalizedCourseworkList)
      courseworkItemIds = normalized.courseworkItemIds
      const response = await fetch('/api/coursework/map-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: normalizedCourseworkList }),
      })
      if (response.ok) {
        const payload = (await response.json()) as { categoryIds?: string[] }
        mappedCategoryIdsFromText = Array.isArray(payload.categoryIds)
          ? payload.categoryIds.filter((item): item is string => typeof item === 'string')
          : []
      }
    } catch (normalizeError) {
      setSaving(false)
      const message = normalizeError instanceof Error ? normalizeError.message : 'Failed to process coursework.'
      setError(toUserFacingErrorMessage(message))
      return
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const [{ error: userError }, { error: profileError }, { error: authError }] = await Promise.all([
      supabase.from('users').upsert(
        {
          id: user.id,
          role: 'student',
        },
        { onConflict: 'id' }
      ),
      supabase.from('student_profiles').upsert(
        {
          user_id: user.id,
          school,
          gender: gender || null,
          major_id: selectedMajor.id,
          majors: majorNames,
          year,
          coursework,
          experience_level: 'none',
          availability_start_month: 'May',
          availability_hours_per_week: parsedHours,
          interests: interests || null,
        },
        { onConflict: 'user_id' }
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
    if (authError) return setError(toUserFacingErrorMessage(authError.message))

    const { error: clearCourseworkItemsError } = await supabase
      .from('student_coursework_items')
      .delete()
      .eq('student_id', user.id)
    if (clearCourseworkItemsError) return setError(toUserFacingErrorMessage(clearCourseworkItemsError.message))

    if (courseworkItemIds.length > 0) {
      const { error: insertCourseworkItemsError } = await supabase.from('student_coursework_items').insert(
        courseworkItemIds.map((courseworkItemId) => ({
          student_id: user.id,
          coursework_item_id: courseworkItemId,
        }))
      )
      if (insertCourseworkItemsError) return setError(toUserFacingErrorMessage(insertCourseworkItemsError.message))
    }

    const [{ data: itemCategoryRows }, { error: clearCategoryLinksError }] = await Promise.all([
      courseworkItemIds.length > 0
        ? supabase
            .from('coursework_item_category_map')
            .select('category_id')
            .in('coursework_item_id', courseworkItemIds)
        : Promise.resolve({ data: [] as Array<{ category_id: string }> }),
      supabase.from('student_coursework_category_links').delete().eq('student_id', user.id),
    ])

    if (clearCategoryLinksError) return setError(toUserFacingErrorMessage(clearCategoryLinksError.message))

    const derivedCategoryIds = Array.from(
      new Set([
        ...((itemCategoryRows ?? []).map((row) => row.category_id).filter((value): value is string => typeof value === 'string')),
        ...mappedCategoryIdsFromText,
      ])
    )

    if (derivedCategoryIds.length > 0) {
      const { error: insertCategoryLinksError } = await supabase.from('student_coursework_category_links').insert(
        derivedCategoryIds.map((categoryId) => ({
          student_id: user.id,
          category_id: categoryId,
        }))
      )
      if (insertCategoryLinksError) return setError(toUserFacingErrorMessage(insertCategoryLinksError.message))
    }

    window.location.href = '/'
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
          href="/signup/student"
          aria-label="Back to account step"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Student profile details</h1>
        <p className="mt-2 text-slate-600">Step 2 of 2: complete your profile.</p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
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

            <div>
              <label className="text-sm font-medium text-slate-700">School</label>
              <div className="relative">
                <input
                  className={FIELD}
                  value={schoolQuery}
                  onFocus={() => setSchoolOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setSchoolOpen(false), 120)
                  }}
                  onChange={(event) => {
                    const value = event.target.value
                    setSchoolQuery(value)
                    if (school && value.trim() !== school) {
                      setSchool('')
                    }
                    setSchoolOpen(true)
                  }}
                  placeholder="Type to search school"
                />
                {showSchoolDropdown ? (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredSchoolOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-600">No results found.</div>
                    ) : (
                      filteredSchoolOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onMouseDown={() => {
                            setSchool(option)
                            setSchoolQuery(option)
                            setSchoolOpen(false)
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {option}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {!school && schoolQuery.trim().length > 0 ? (
                <p className="mt-1 text-xs text-amber-700">Choose a school from the dropdown list.</p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Year</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setYearOpen((open) => !open)}
                  onBlur={() => setTimeout(() => setYearOpen(false), 120)}
                  className={`${FIELD} flex items-center justify-between text-left`}
                >
                  <span className={year ? 'text-slate-900' : 'text-slate-400'}>{year || 'Select your year'}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
                {yearOpen ? (
                  <div className="absolute z-20 mt-1 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {YEAR_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onMouseDown={() => {
                          setYear(option)
                          setYearOpen(false)
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Gender</label>
              <select className={FIELD} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Availability hours per week</label>
              <input
                type="number"
                min={1}
                className={FIELD}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="15"
              />
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
              <p className="mt-1 text-xs text-slate-500">
                {hasSchoolSpecificCoursework
                  ? 'Suggestions are tuned to your selected university.'
                  : 'Suggestions are broad until a listed university is selected.'}
              </p>
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

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Interests (optional)</label>
              <textarea
                rows={3}
                className={FIELD}
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="What kinds of internships are you looking for?"
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
