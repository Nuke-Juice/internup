'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getUniversityCourseCatalog, hasUniversitySpecificCourses } from '@/lib/coursework/universityCourseCatalog'
import { normalizeCourseworkClient } from '@/lib/coursework/normalizeCourseworkClient'
import { supabaseBrowser } from '@/lib/supabase/client'
import { toUserFacingErrorMessage } from '@/lib/errors/userFacingError'
import type { CanonicalMajor } from '@/components/account/MajorCombobox'
import StudentProgressBar from '@/components/onboarding/StudentProgressBar'
import StudentStep1 from '@/components/onboarding/StudentStep1'
import StudentStep2 from '@/components/onboarding/StudentStep2'
import StudentStep3 from '@/components/onboarding/StudentStep3'
import StudentStep4 from '@/components/onboarding/StudentStep4'

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
const MAX_RESUME_BYTES = 5 * 1024 * 1024
const STUDENT_STEPS = 4
const STUDENT_DRAFT_KEY = 'onboarding:student:details:v2'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

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

type StudentDraft = {
  stepIndex?: number
  firstName?: string
  lastName?: string
  school?: string
  schoolQuery?: string
  year?: string
  gender?: string
  majorId?: string | null
  majorQuery?: string
  secondMajorId?: string | null
  secondMajorQuery?: string
  coursework?: string[]
  courseworkInput?: string
  desiredRoles?: string
  interests?: string
  hoursPerWeek?: string
  preferredLocation?: string
  preferredWorkMode?: string
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

function readStudentDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STUDENT_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StudentDraft
  } catch {
    return null
  }
}

export default function StudentSignupDetailsPage() {
  const [initializing, setInitializing] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)

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
  const [desiredRoles, setDesiredRoles] = useState('')
  const [interests, setInterests] = useState('')
  const [preferredLocation, setPreferredLocation] = useState('')
  const [preferredWorkMode, setPreferredWorkMode] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeStoragePath, setResumeStoragePath] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')

  const [majorCatalog, setMajorCatalog] = useState<CanonicalMajor[]>([])
  const [majorsLoading, setMajorsLoading] = useState(true)
  const [majorError, setMajorError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSchoolForCatalog = school || schoolQuery
  const courseworkCatalog = useMemo(() => getUniversityCourseCatalog(selectedSchoolForCatalog), [selectedSchoolForCatalog])
  const hasSchoolSpecificCoursework = useMemo(
    () => hasUniversitySpecificCourses(selectedSchoolForCatalog),
    [selectedSchoolForCatalog]
  )

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

  const currentStepNumber = stepIndex + 1

  function addCoursework(course: string) {
    const normalized = course.trim().replace(/\s+/g, ' ')
    if (!normalized) return
    if (!courseworkCatalog.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      return
    }
    setCoursework((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
    setCourseworkInput('')
  }

  function removeCoursework(course: string) {
    setCoursework((prev) => prev.filter((item) => item !== course))
  }

  function validateStep(index: number) {
    if (index === 0) {
      if (!firstName.trim()) return 'First name is required.'
      if (!lastName.trim()) return 'Last name is required.'
      if (!school.trim()) return 'Please select your school.'
      if (!year.trim()) return 'Please select your graduation year.'
      if (!selectedMajor) return 'Please select a verified major.'
      if (selectedSecondMajor && selectedSecondMajor.id === selectedMajor.id) {
        return 'Choose a different second major or leave it blank.'
      }
      return null
    }

    if (index === 1) {
      if (selectedSecondMajor && selectedMajor && selectedSecondMajor.id === selectedMajor.id) {
        return 'Choose a different second major or leave it blank.'
      }
      return null
    }

    if (index === 3) {
      const parsedHours = Number(hoursPerWeek)
      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        return 'Availability hours per week must be a number greater than 0.'
      }
    }

    return null
  }

  const canContinue = useMemo(() => {
    if (stepIndex === 0) {
      return Boolean(firstName.trim() && lastName.trim() && school.trim() && year.trim() && selectedMajor)
    }
    if (stepIndex === 3) {
      const parsedHours = Number(hoursPerWeek)
      return Number.isFinite(parsedHours) && parsedHours > 0
    }
    return true
  }, [firstName, lastName, school, year, selectedMajor, stepIndex, hoursPerWeek])

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
        window.location.href = '/verify-required?next=%2Fsignup%2Fstudent%2Fdetails&action=signup_profile_completion'
        return
      }

      const metadata = (user.user_metadata ?? {}) as {
        first_name?: string
        last_name?: string
        full_name?: string
        resume_path?: string
        resume_file_name?: string
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
      setResumeStoragePath(typeof metadata.resume_path === 'string' ? metadata.resume_path : '')
      setResumeFileName(typeof metadata.resume_file_name === 'string' ? metadata.resume_file_name : '')

      const [{ data: userRow }, { data: catalogData, error: catalogError }] = await Promise.all([
        supabase.from('users').select('role, verified').eq('id', user.id).maybeSingle(),
        supabase.from('canonical_majors').select('id, slug, name').order('name', { ascending: true }).limit(500),
      ])

      if (userRow?.verified !== true) {
        await supabase.from('users').update({ verified: true }).eq('id', user.id).eq('verified', false)
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

      let catalog: CanonicalMajor[] = []
      if (catalogError) {
        setMajorError('Could not load majors right now.')
        setMajorsLoading(false)
      } else {
        catalog = (catalogData ?? []).filter(
          (row): row is CanonicalMajor =>
            typeof row.id === 'string' && typeof row.slug === 'string' && typeof row.name === 'string'
        )
        setMajorCatalog(catalog)
        setMajorsLoading(false)
      }

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

      const draft = readStudentDraft()
      if (draft) {
        if (typeof draft.firstName === 'string') setFirstName(draft.firstName)
        if (typeof draft.lastName === 'string') setLastName(draft.lastName)
        if (typeof draft.school === 'string') setSchool(draft.school)
        if (typeof draft.schoolQuery === 'string') setSchoolQuery(draft.schoolQuery)
        if (typeof draft.year === 'string') setYear(draft.year)
        if (typeof draft.gender === 'string') setGender(draft.gender)
        if (typeof draft.majorQuery === 'string') setMajorQuery(draft.majorQuery)
        if (typeof draft.secondMajorQuery === 'string') setSecondMajorQuery(draft.secondMajorQuery)
        if (Array.isArray(draft.coursework)) setCoursework(draft.coursework)
        if (typeof draft.courseworkInput === 'string') setCourseworkInput(draft.courseworkInput)
        if (typeof draft.desiredRoles === 'string') setDesiredRoles(draft.desiredRoles)
        if (typeof draft.interests === 'string') setInterests(draft.interests)
        if (typeof draft.hoursPerWeek === 'string') setHoursPerWeek(draft.hoursPerWeek)
        if (typeof draft.preferredLocation === 'string') setPreferredLocation(draft.preferredLocation)
        if (typeof draft.preferredWorkMode === 'string') setPreferredWorkMode(draft.preferredWorkMode)
        if (typeof draft.stepIndex === 'number') setStepIndex(Math.min(Math.max(draft.stepIndex, 0), STUDENT_STEPS - 1))

        if (draft.majorId && catalog.length > 0) {
          const draftedPrimary = catalog.find((item) => item.id === draft.majorId) || null
          if (draftedPrimary) {
            setSelectedMajor(draftedPrimary)
            setMajorQuery(draftedPrimary.name)
          }
        }

        if (draft.secondMajorId && catalog.length > 0) {
          const draftedSecondary = catalog.find((item) => item.id === draft.secondMajorId) || null
          if (draftedSecondary) {
            setSelectedSecondMajor(draftedSecondary)
            setSecondMajorQuery(draftedSecondary.name)
          }
        }
      }

      setInitializing(false)
    }

    void initializePage()
  }, [])

  useEffect(() => {
    if (initializing || typeof window === 'undefined') return

    const draft: StudentDraft = {
      stepIndex,
      firstName,
      lastName,
      school,
      schoolQuery,
      year,
      gender,
      majorId: selectedMajor?.id ?? null,
      majorQuery,
      secondMajorId: selectedSecondMajor?.id ?? null,
      secondMajorQuery,
      coursework,
      courseworkInput,
      desiredRoles,
      interests,
      hoursPerWeek,
      preferredLocation,
      preferredWorkMode,
    }

    window.localStorage.setItem(STUDENT_DRAFT_KEY, JSON.stringify(draft))
  }, [
    initializing,
    stepIndex,
    firstName,
    lastName,
    school,
    schoolQuery,
    year,
    gender,
    selectedMajor,
    majorQuery,
    selectedSecondMajor,
    secondMajorQuery,
    coursework,
    courseworkInput,
    desiredRoles,
    interests,
    hoursPerWeek,
    preferredLocation,
    preferredWorkMode,
  ])

  async function saveProfileDetails() {
    setError(null)

    const baseValidationError = validateStep(0) ?? validateStep(1) ?? validateStep(3)
    if (baseValidationError) {
      setError(baseValidationError)
      return
    }

    if (!selectedMajor) {
      setError('Please select a verified major.')
      return
    }

    let nextResumePath = resumeStoragePath.trim()
    let nextResumeName = resumeFileName.trim()

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
      window.location.href = '/verify-required?next=%2Fsignup%2Fstudent%2Fdetails&action=signup_profile_completion'
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

    if (resumeFile) {
      if (resumeFile.type !== 'application/pdf') {
        setSaving(false)
        setError('Resume must be a PDF.')
        return
      }
      if (resumeFile.size > MAX_RESUME_BYTES) {
        setSaving(false)
        setError('Resume must be 5MB or smaller.')
        return
      }

      const sanitizedFileName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const resumePathForStorage = `profiles/${user.id}/resume-${Date.now()}-${sanitizedFileName}`
      const { error: resumeUploadError } = await supabase.storage
        .from('resumes')
        .upload(resumePathForStorage, resumeFile, { contentType: 'application/pdf', upsert: true })

      if (resumeUploadError) {
        setSaving(false)
        setError(toUserFacingErrorMessage(resumeUploadError.message))
        return
      }

      nextResumePath = resumePathForStorage
      nextResumeName = resumeFile.name
    }

    const majorNames = Array.from(
      new Set(
        [selectedMajor.name, selectedSecondMajor?.name ?? null].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      )
    )
    const normalizedCourseworkList = coursework.map((course) => course.trim().replace(/\s+/g, ' ')).filter(Boolean)

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

    const parsedHours = Number(hoursPerWeek)
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
          resume_path: nextResumePath || null,
          resume_file_name: nextResumeName || null,
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

    const { error: clearStudentCoursesError } = await supabase
      .from('student_courses')
      .delete()
      .eq('student_profile_id', user.id)
    if (clearStudentCoursesError) return setError(toUserFacingErrorMessage(clearStudentCoursesError.message))

    const canonicalCourseTokens = normalizedCourseworkList.map((course) => course.toLowerCase())
    if (canonicalCourseTokens.length > 0) {
      const { data: canonicalCourseRows } = await supabase
        .from('canonical_courses')
        .select('id, code, name')
        .in('name', normalizedCourseworkList)
        .limit(200)

      const matchedCanonicalIds = (canonicalCourseRows ?? [])
        .filter((row) => {
          const code = typeof row.code === 'string' ? row.code.toLowerCase() : ''
          const name = typeof row.name === 'string' ? row.name.toLowerCase() : ''
          return canonicalCourseTokens.includes(code) || canonicalCourseTokens.includes(name)
        })
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string')

      if (matchedCanonicalIds.length > 0) {
        const { error: insertStudentCoursesError } = await supabase.from('student_courses').insert(
          matchedCanonicalIds.map((courseId) => ({
            student_profile_id: user.id,
            course_id: courseId,
          }))
        )
        if (insertStudentCoursesError) return setError(toUserFacingErrorMessage(insertStudentCoursesError.message))
      }
    }

    const [{ data: itemCategoryRows }, { error: clearCategoryLinksError }] = await Promise.all([
      courseworkItemIds.length > 0
        ? supabase.from('coursework_item_category_map').select('category_id').in('coursework_item_id', courseworkItemIds)
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

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STUDENT_DRAFT_KEY)
    }

    window.location.href = '/'
  }

  function handleNext() {
    setError(null)
    const validationError = validateStep(stepIndex)
    if (validationError) {
      setError(validationError)
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, STUDENT_STEPS - 1))
  }

  function handleBack() {
    setError(null)
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  function handleResumeChange(file: File | null) {
    if (!file) {
      setResumeFile(null)
      return
    }
    if (file.type !== 'application/pdf') {
      setError('Resume must be a PDF.')
      return
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError('Resume must be 5MB or smaller.')
      return
    }
    setError(null)
    setResumeFile(file)
  }

  function renderStep() {
    if (stepIndex === 0) {
      return (
        <StudentStep1
          fieldClassName={FIELD}
          firstName={firstName}
          lastName={lastName}
          school={school}
          schoolQuery={schoolQuery}
          schoolOpen={schoolOpen}
          year={year}
          yearOpen={yearOpen}
          selectedMajor={selectedMajor}
          majorQuery={majorQuery}
          majorCatalog={majorCatalog}
          majorsLoading={majorsLoading}
          majorError={majorError}
          schoolOptions={SCHOOL_OPTIONS}
          yearOptions={YEAR_OPTIONS}
          filteredSchoolOptions={filteredSchoolOptions}
          showSchoolDropdown={showSchoolDropdown}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onSchoolQueryChange={(value) => {
            setSchoolQuery(value)
            if (school && value.trim() !== school) {
              setSchool('')
            }
          }}
          onSchoolSelect={(value) => {
            setSchool(value)
            setSchoolQuery(value)
          }}
          onSchoolOpenChange={setSchoolOpen}
          onYearSelect={setYear}
          onYearOpenChange={setYearOpen}
          onMajorQueryChange={(value) => {
            setMajorQuery(value)
            if (selectedMajor && value.trim() !== selectedMajor.name) {
              setSelectedMajor(null)
            }
          }}
          onMajorSelect={(major) => {
            setSelectedMajor(major)
            setMajorQuery(major.name)
          }}
          onMajorErrorClear={() => setMajorError(null)}
        />
      )
    }

    if (stepIndex === 1) {
      return (
        <StudentStep2
          fieldClassName={FIELD}
          secondMajorQuery={secondMajorQuery}
          selectedSecondMajor={selectedSecondMajor}
          majorCatalog={majorCatalog}
          majorsLoading={majorsLoading}
          majorError={majorError}
          hasSchoolSpecificCoursework={hasSchoolSpecificCoursework}
          courseworkInput={courseworkInput}
          coursework={coursework}
          filteredCourseworkOptions={filteredCourseworkOptions}
          desiredRoles={desiredRoles}
          onSecondMajorQueryChange={(value) => {
            setSecondMajorQuery(value)
            if (selectedSecondMajor && value.trim() !== selectedSecondMajor.name) {
              setSelectedSecondMajor(null)
            }
          }}
          onSecondMajorSelect={(major) => {
            setSelectedSecondMajor(major)
            setSecondMajorQuery(major.name)
          }}
          onMajorErrorClear={() => setMajorError(null)}
          onCourseworkInputChange={setCourseworkInput}
          onAddCoursework={addCoursework}
          onRemoveCoursework={removeCoursework}
          onDesiredRolesChange={setDesiredRoles}
        />
      )
    }

    if (stepIndex === 2) {
      return (
        <StudentStep3
          fieldClassName={FIELD}
          gender={gender}
          interests={interests}
          resumeFile={resumeFile}
          resumeFileName={resumeFileName}
          hasResumeOnFile={Boolean(resumeStoragePath)}
          onGenderChange={setGender}
          onInterestsChange={setInterests}
          onResumeChange={handleResumeChange}
        />
      )
    }

    return (
      <StudentStep4
        fieldClassName={FIELD}
        hoursPerWeek={hoursPerWeek}
        preferredLocation={preferredLocation}
        preferredWorkMode={preferredWorkMode}
        onHoursPerWeekChange={setHoursPerWeek}
        onPreferredLocationChange={setPreferredLocation}
        onPreferredWorkModeChange={setPreferredWorkMode}
      />
    )
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
        <p className="mt-2 text-slate-600">You&apos;re 2 minutes away from matching with internships.</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <StudentProgressBar currentStep={currentStepNumber} totalSteps={STUDENT_STEPS} />

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {stepIndex === 0
                ? 'Basics'
                : stepIndex === 1
                  ? 'Skills and interests'
                  : stepIndex === 2
                    ? 'Experience'
                    : 'Preferences'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {stepIndex === 0
                ? 'Start with core profile details so we can personalize matches.'
                : stepIndex === 1
                  ? 'Add context about what you want to work on.'
                  : stepIndex === 2
                    ? 'A complete profile gets stronger responses from employers.'
                    : 'Set how and where you want to intern.'}
            </p>
          </div>

          <div key={stepIndex} className="mt-6 transition-all duration-300 ease-out">
            {renderStep()}
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

            {stepIndex < STUDENT_STEPS - 1 ? (
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
