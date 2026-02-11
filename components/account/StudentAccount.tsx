'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pencil } from 'lucide-react'
import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'
import UniversityCombobox from '@/components/account/UniversityCombobox'
import { useToast } from '@/components/feedback/ToastProvider'
import { normalizeCatalogLabel, normalizeCatalogToken } from '@/lib/catalog/normalization'
import { getUniversityCourseCatalog, hasUniversitySpecificCourses } from '@/lib/coursework/universityCourseCatalog'
import { normalizeCourseworkClient } from '@/lib/coursework/normalizeCourseworkClient'
import {
  addRecoverySuccessParam,
  clearStoredReturnTo,
  getStoredReturnTo,
  normalizeReturnTo,
  setStoredReturnTo,
} from '@/lib/applyRecovery'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { supabaseBrowser } from '@/lib/supabase/client'
import { normalizeSkillsClient } from '@/lib/skills/normalizeSkillsClient'

type StudentProfileRow = {
  university_id: string | number | null
  school: string | null
  major_id: string | null
  major?: { id?: string | null; slug?: string | null; name?: string | null } | null
  majors: string[] | string | null
  year: string | null
  coursework: string[] | string | null
  experience_level: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | string | null
  interests: string | null
  preferred_city: string | null
  preferred_state: string | null
  preferred_zip: string | null
  max_commute_minutes: number | null
  transport_mode: string | null
  exact_address_line1: string | null
  location_lat: number | null
  location_lng: number | null
}

type University = {
  id: string | number
  name: string
  state?: string | null
  country?: string | null
  verified?: boolean | null
}

type ExperienceLevel = 'none' | 'projects' | 'internship'

type Props = {
  userId: string
  initialProfile: StudentProfileRow | null
}

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const graduationYears = ['2026', '2027', '2028', '2029', '2030']
const experienceLevels: Array<{ label: string; value: ExperienceLevel }> = [
  { label: "I'm new to this (no relevant experience yet)", value: 'none' },
  { label: "I've taken classes / built projects related to it", value: 'projects' },
  { label: "I've had an internship or role in the field", value: 'internship' },
]
const seasons = ['Summer', 'Fall', 'Spring'] as const
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const hoursPerWeekOptions = [5, 10, 15, 20, 25, 30, 35, 40]
const transportModes = ['driving', 'transit', 'walking', 'cycling'] as const
const maxProfilePhotoBytes = 2 * 1024 * 1024
const maxResumeBytes = 5 * 1024 * 1024
const profilePhotoBuckets = ['avatars', 'profile-photos']

function normalizeExperienceLevel(value: string | null | undefined): ExperienceLevel {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) return 'none'
  if (normalized === 'none' || normalized === 'projects' || normalized === 'internship') {
    return normalized
  }
  if (normalized.includes('project')) return 'projects'
  if (normalized.includes('intern') || normalized.includes('work')) return 'internship'
  return 'none'
}

function getExperienceLabel(value: ExperienceLevel) {
  if (value === 'projects') return "I've done projects"
  if (value === 'internship') return "I've had an internship"
  return "I'm new to this"
}

function getPrimaryMajor(value: StudentProfileRow['majors']) {
  if (Array.isArray(value)) return value[0] ?? ''
  if (typeof value === 'string') return value
  return ''
}

function getMajorLabelFromProfile(row: Record<string, unknown>) {
  const joined = row.major as { name?: string | null } | null
  if (joined?.name && typeof joined.name === 'string') return joined.name.trim()
  return getPrimaryMajor((row.majors as StudentProfileRow['majors']) ?? null)
}

function getCourseworkText(value: StudentProfileRow['coursework']) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((course) => course.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeHoursPerWeek(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 20
}

function defaultSeasonFromMonth(value: string | null) {
  if (!value) return ['Summer']
  const normalized = value.toLowerCase()
  if (normalized.startsWith('jan') || normalized.startsWith('feb') || normalized.startsWith('mar')) {
    return ['Spring']
  }
  if (normalized.startsWith('sep') || normalized.startsWith('oct') || normalized.startsWith('nov')) {
    return ['Fall']
  }
  return ['Summer']
}

function parsePreferences(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const maybeObject = value as {
    remoteOk?: unknown
    seasons?: unknown
    availability?: unknown
    profileHeadline?: unknown
  }

  const rawSeasons = Array.isArray(maybeObject.seasons)
    ? maybeObject.seasons
    : Array.isArray(maybeObject.availability)
      ? maybeObject.availability
      : []
  const parsedSeasons = rawSeasons.filter(
    (item): item is string => typeof item === 'string' && seasons.includes(item as (typeof seasons)[number])
  )
  const parsedSkills = Array.isArray((maybeObject as { skills?: unknown }).skills)
    ? (maybeObject as { skills: unknown[] }).skills.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
    : []

  return {
    remoteOk: Boolean(maybeObject.remoteOk),
    seasons: parsedSeasons,
    profileHeadline: typeof maybeObject.profileHeadline === 'string' ? maybeObject.profileHeadline : '',
    skills: parsedSkills,
  }
}

function parseLegacyInterests(value: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsePreferences(parsed)
  } catch {
    return null
  }
}

function normalizeCourseworkName(value: string) {
  return normalizeCatalogLabel(value)
}

function normalizeSkillName(value: string) {
  return normalizeCatalogLabel(value)
}

function initialsForName(firstName: string, lastName: string) {
  const first = firstName.trim().slice(0, 1)
  const last = lastName.trim().slice(0, 1)
  if (first || last) return `${first}${last}`.toUpperCase()
  return 'S'
}

function includesCoursework(list: string[], value: string) {
  const normalized = normalizeCourseworkName(value).toLowerCase()
  return list.some((item) => normalizeCourseworkName(item).toLowerCase() === normalized)
}

function includesSkill(list: string[], value: string) {
  const normalized = normalizeSkillName(value).toLowerCase()
  return list.some((item) => normalizeSkillName(item).toLowerCase() === normalized)
}

function includesCourseworkCategory(list: string[], value: string) {
  const normalized = normalizeCourseworkName(value).toLowerCase()
  return list.some((item) => normalizeCourseworkName(item).toLowerCase() === normalized)
}

export default function StudentAccount({ userId, initialProfile }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null)
  const [universityQuery, setUniversityQuery] = useState(initialProfile?.school ?? '')
  const [universityOptions, setUniversityOptions] = useState<University[]>([])
  const [universityLoading, setUniversityLoading] = useState(false)
  const [universityError, setUniversityError] = useState<string | null>(null)
  const [universitySearchError, setUniversitySearchError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [resumeStoragePath, setResumeStoragePath] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [profileHeadline, setProfileHeadline] = useState('')

  const [major, setMajor] = useState(getPrimaryMajor(initialProfile?.majors ?? null) || '')
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(initialProfile?.major_id ?? null)
  const [majorQuery, setMajorQuery] = useState(getPrimaryMajor(initialProfile?.majors ?? null) || '')
  const [majorCatalog, setMajorCatalog] = useState<CanonicalMajor[]>([])
  const [majorError, setMajorError] = useState<string | null>(null)
  const [graduationYear, setGraduationYear] = useState(initialProfile?.year ?? '2028')
  const [coursework, setCoursework] = useState<string[]>(getCourseworkText(initialProfile?.coursework ?? null))
  const [courseworkInput, setCourseworkInput] = useState('')
  const [courseworkCategories, setCourseworkCategories] = useState<string[]>([])
  const [courseworkCategoryInput, setCourseworkCategoryInput] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [canonicalSkillOptions, setCanonicalSkillOptions] = useState<string[]>([])
  const [canonicalCourseworkOptions, setCanonicalCourseworkOptions] = useState<string[]>([])
  const [canonicalCourseworkCategoryOptions, setCanonicalCourseworkCategoryOptions] = useState<string[]>([])
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    normalizeExperienceLevel(initialProfile?.experience_level)
  )
  const [availabilityStartMonth, setAvailabilityStartMonth] = useState(
    initialProfile?.availability_start_month ?? 'May'
  )
  const [availabilityHoursPerWeek, setAvailabilityHoursPerWeek] = useState(
    normalizeHoursPerWeek(initialProfile?.availability_hours_per_week)
  )
  const [preferredCity, setPreferredCity] = useState(initialProfile?.preferred_city ?? '')
  const [preferredState, setPreferredState] = useState(initialProfile?.preferred_state ?? '')
  const [preferredZip, setPreferredZip] = useState(initialProfile?.preferred_zip ?? '')
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState(initialProfile?.max_commute_minutes ?? 30)
  const [transportMode, setTransportMode] = useState(
    initialProfile?.transport_mode && transportModes.includes(initialProfile.transport_mode as (typeof transportModes)[number])
      ? (initialProfile.transport_mode as (typeof transportModes)[number])
      : 'driving'
  )
  const [exactAddressLine1, setExactAddressLine1] = useState(initialProfile?.exact_address_line1 ?? '')
  const [availability, setAvailability] = useState<string[]>(
    defaultSeasonFromMonth(initialProfile?.availability_start_month ?? null)
  )
  const [remoteOk, setRemoteOk] = useState(false)
  const [suggestedCoursework, setSuggestedCoursework] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isProfileLoaded, setIsProfileLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const selectedUniversityName = selectedUniversity?.name ?? universityQuery
  const universityCourseworkCatalog = useMemo(
    () => getUniversityCourseCatalog(selectedUniversityName),
    [selectedUniversityName]
  )
  const hasScopedUniversityCatalog = useMemo(
    () => hasUniversitySpecificCourses(selectedUniversityName),
    [selectedUniversityName]
  )

  const hasSavedProfile = useMemo(() => {
    return Boolean(
      universityQuery.trim() ||
        major.trim() ||
        graduationYear.trim() ||
        coursework.length > 0 ||
        skills.length > 0 ||
        availabilityStartMonth.trim() ||
        availabilityHoursPerWeek
    )
  }, [availabilityHoursPerWeek, availabilityStartMonth, coursework, graduationYear, major, skills, universityQuery])

  const [mode, setMode] = useState<'view' | 'edit'>(hasSavedProfile ? 'view' : 'edit')
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const showIncompleteGuide = searchParams.get('complete') === '1'
  const recoveryCode = searchParams.get('recoveryCode')
  const returnTo = useMemo(() => {
    const fromQuery = normalizeReturnTo(searchParams.get('returnTo'))
    if (fromQuery) return fromQuery
    return getStoredReturnTo()
  }, [searchParams])

  const completionFlags = useMemo(() => {
    const validExperience =
      experienceLevel === 'none' || experienceLevel === 'projects' || experienceLevel === 'internship'

    return {
      identity: Boolean(firstName.trim() && lastName.trim()),
      university: Boolean(selectedUniversity || universityQuery.trim()),
      major: Boolean(selectedMajorId),
      graduationYear: Boolean(graduationYear.trim() && graduationYear !== 'Not set'),
      experience: validExperience,
      startMonth: Boolean(availabilityStartMonth.trim()),
      hours: Number(availabilityHoursPerWeek) > 0,
      coursework: coursework.length > 0,
      seasons: availability.length > 0,
    }
  }, [
    availability,
    availabilityHoursPerWeek,
    availabilityStartMonth,
    coursework.length,
    experienceLevel,
    firstName,
    graduationYear,
    lastName,
    major,
    selectedMajorId,
    selectedUniversity,
    universityQuery,
  ])

  const missingCount = useMemo(() => {
    return Object.values(completionFlags).filter((done) => !done).length
  }, [completionFlags])

  const minimumProfileReady = useMemo(() => {
    return getMinimumProfileCompleteness({
      school: selectedUniversity?.name ?? universityQuery ?? null,
      majors: selectedMajorId && major ? [major] : [],
      availability_start_month: availabilityStartMonth,
      availability_hours_per_week: availabilityHoursPerWeek,
    }).ok
  }, [availabilityHoursPerWeek, availabilityStartMonth, major, selectedMajorId, selectedUniversity?.name, universityQuery])

  const hasResumeForApply = useMemo(() => {
    return Boolean(resumeStoragePath.trim() || resumeFile)
  }, [resumeFile, resumeStoragePath])

  const recoveryReady = minimumProfileReady && hasResumeForApply
  const selectedMajor = useMemo(() => {
    if (selectedMajorId) {
      const byId = majorCatalog.find((item) => item.id === selectedMajorId)
      if (byId) return byId
    }
    if (major.trim()) {
      const byName = majorCatalog.find((item) => item.name.toLowerCase() === major.trim().toLowerCase())
      if (byName) return byName
    }
    return null
  }, [major, majorCatalog, selectedMajorId])

  const showCardHints = mode === 'view' && isProfileLoaded && showIncompleteGuide && missingCount > 0

  function cardClass(isMissing: boolean) {
    return `relative rounded-xl border p-4 ${
      isProfileLoaded && isMissing ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-slate-50'
    }`
  }

  useEffect(() => {
    const fromQuery = normalizeReturnTo(searchParams.get('returnTo'))
    if (fromQuery) {
      setStoredReturnTo(fromQuery)
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = supabaseBrowser()

    async function loadLatestProfile() {
      setIsProfileLoaded(false)
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (loadError || !data) {
        const [{ data: skillCatalogRows }, { data: courseworkCatalogRows }, { data: courseworkCategoryRows }, { data: majorCatalogRows }] =
          await Promise.all([
            supabase.from('skills').select('label').order('label', { ascending: true }).limit(1200),
            supabase.from('coursework_items').select('name').order('name', { ascending: true }).limit(1200),
            supabase.from('coursework_categories').select('name').order('name', { ascending: true }).limit(500),
            supabase.from('canonical_majors').select('id, slug, name').order('name', { ascending: true }).limit(500),
          ])
        setCanonicalSkillOptions(
          (skillCatalogRows ?? [])
            .map((item) => (typeof item.label === 'string' ? item.label.trim() : ''))
            .filter(Boolean)
        )
        setCanonicalCourseworkOptions(
          (courseworkCatalogRows ?? [])
            .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
            .filter(Boolean)
        )
        setCanonicalCourseworkCategoryOptions(
          (courseworkCategoryRows ?? [])
            .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
            .filter(Boolean)
        )
        setMajorCatalog(
          (majorCatalogRows ?? []).filter(
            (item): item is CanonicalMajor =>
              typeof item.id === 'string' && typeof item.slug === 'string' && typeof item.name === 'string'
          )
        )
        setLoading(false)
        setIsProfileLoaded(true)
        return
      }

      const row = data as Record<string, unknown>
      const dbMajor = getMajorLabelFromProfile(row)
      const dbMajorId = typeof row.major_id === 'string' ? row.major_id : null
      const dbCoursework = getCourseworkText((row.coursework as StudentProfileRow['coursework']) ?? null)
      const dbStartMonth =
        typeof row.availability_start_month === 'string' && row.availability_start_month.trim()
          ? row.availability_start_month
          : 'May'
      const parsedPreferences =
        parsePreferences(row.preferences) ?? parseLegacyInterests((row.interests as string) ?? null)
      const [
        { data: canonicalSkillRows },
        { data: canonicalCourseworkRows },
        { data: canonicalCourseworkCategoryRows },
        { data: skillCatalogRows },
        { data: courseworkCatalogRows },
        { data: courseworkCategoryRows },
        { data: majorCatalogRows },
      ] =
        await Promise.all([
          supabase
            .from('student_skill_items')
            .select('skill_id, skill:skills(label)')
            .eq('student_id', userId),
          supabase
            .from('student_coursework_items')
            .select('coursework_item_id, coursework:coursework_items(name)')
            .eq('student_id', userId),
          supabase
            .from('student_coursework_category_links')
            .select('category_id, category:coursework_categories(name)')
            .eq('student_id', userId),
          supabase.from('skills').select('label').order('label', { ascending: true }).limit(1200),
          supabase.from('coursework_items').select('name').order('name', { ascending: true }).limit(1200),
          supabase.from('coursework_categories').select('name').order('name', { ascending: true }).limit(500),
          supabase.from('canonical_majors').select('id, slug, name').order('name', { ascending: true }).limit(500),
        ])
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData.user
      const authMetadata = (authUser?.user_metadata ?? {}) as {
        first_name?: string
        last_name?: string
        full_name?: string
        avatar_url?: string
        resume_path?: string
        resume_file_name?: string
      }
      const nameTokens = (authMetadata.full_name ?? '')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
      const firstNameValue =
        typeof authMetadata.first_name === 'string' && authMetadata.first_name.trim()
          ? authMetadata.first_name
          : nameTokens[0] ?? ''
      const lastNameValue =
        typeof authMetadata.last_name === 'string' && authMetadata.last_name.trim()
          ? authMetadata.last_name
          : nameTokens.slice(1).join(' ')

      setMajor(dbMajor || '')
      setMajorQuery(dbMajor || '')
      setSelectedMajorId(dbMajorId)
      setGraduationYear((row.year as string) ?? '2028')
      const canonicalSkillLabels = (canonicalSkillRows ?? [])
        .map((rowItem) => {
          const skill = rowItem.skill as { label?: string | null } | null
          return typeof skill?.label === 'string' ? skill.label.trim() : ''
        })
        .filter(Boolean)
      const canonicalCourseworkLabels = (canonicalCourseworkRows ?? [])
        .map((rowItem) => {
          const courseworkItem = rowItem.coursework as { name?: string | null } | null
          return typeof courseworkItem?.name === 'string' ? courseworkItem.name.trim() : ''
        })
        .filter(Boolean)
      const canonicalCourseworkCategoryLabels = (canonicalCourseworkCategoryRows ?? [])
        .map((rowItem) => {
          const categoryItem = rowItem.category as { name?: string | null } | null
          return typeof categoryItem?.name === 'string' ? categoryItem.name.trim() : ''
        })
        .filter(Boolean)
      setCanonicalSkillOptions(
        (skillCatalogRows ?? [])
          .map((item) => (typeof item.label === 'string' ? item.label.trim() : ''))
          .filter(Boolean)
      )
      setCanonicalCourseworkOptions(
        (courseworkCatalogRows ?? [])
          .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
          .filter(Boolean)
      )
      setCanonicalCourseworkCategoryOptions(
        (courseworkCategoryRows ?? [])
          .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
          .filter(Boolean)
      )
      const majorsCatalog = (majorCatalogRows ?? []).filter(
        (item): item is CanonicalMajor =>
          typeof item.id === 'string' && typeof item.slug === 'string' && typeof item.name === 'string'
      )
      setMajorCatalog(majorsCatalog)
      if (!dbMajorId && dbMajor) {
        const matchedByName = majorsCatalog.find((item) => item.name.toLowerCase() === dbMajor.toLowerCase())
        if (matchedByName) {
          setSelectedMajorId(matchedByName.id)
          setMajor(matchedByName.name)
          setMajorQuery(matchedByName.name)
        }
      }
      setCoursework(canonicalCourseworkLabels.length > 0 ? canonicalCourseworkLabels : dbCoursework)
      setCourseworkCategories(canonicalCourseworkCategoryLabels)
      setSkills(canonicalSkillLabels.length > 0 ? canonicalSkillLabels : (parsedPreferences?.skills ?? []))
      setExperienceLevel(normalizeExperienceLevel((row.experience_level as string) ?? null))
      setAvailabilityStartMonth(dbStartMonth)
      setAvailabilityHoursPerWeek(
        normalizeHoursPerWeek((row.availability_hours_per_week as number | string | null) ?? null)
      )
      setAvailability(
        parsedPreferences?.seasons && parsedPreferences.seasons.length > 0
          ? parsedPreferences.seasons
          : defaultSeasonFromMonth(dbStartMonth)
      )
      setPreferredCity(typeof row.preferred_city === 'string' ? row.preferred_city : '')
      setPreferredState(typeof row.preferred_state === 'string' ? row.preferred_state : '')
      setPreferredZip(typeof row.preferred_zip === 'string' ? row.preferred_zip : '')
      setMaxCommuteMinutes(typeof row.max_commute_minutes === 'number' ? row.max_commute_minutes : 30)
      setTransportMode(
        typeof row.transport_mode === 'string' && transportModes.includes(row.transport_mode as (typeof transportModes)[number])
          ? (row.transport_mode as (typeof transportModes)[number])
          : 'driving'
      )
      setExactAddressLine1(typeof row.exact_address_line1 === 'string' ? row.exact_address_line1 : '')
      setRemoteOk(Boolean(parsedPreferences?.remoteOk))
      setProfileHeadline(parsedPreferences?.profileHeadline ?? '')
      setFirstName(firstNameValue)
      setLastName(lastNameValue)
      setProfilePhotoUrl(typeof authMetadata.avatar_url === 'string' ? authMetadata.avatar_url : '')
      setResumeStoragePath(typeof authMetadata.resume_path === 'string' ? authMetadata.resume_path : '')
      setResumeFileName(typeof authMetadata.resume_file_name === 'string' ? authMetadata.resume_file_name : '')
      setEmail(authUser?.email ?? '')

      const universityId =
        typeof row.university_id === 'string' || typeof row.university_id === 'number'
          ? row.university_id
          : null
      const schoolText = typeof row.school === 'string' ? row.school : ''

      if (universityId) {
        const { data: university } = await supabase
          .from('universities')
          .select('id, name, verified')
          .eq('id', universityId)
          .maybeSingle()

        if (university?.id && university?.name) {
          const selected = { id: university.id as string | number, name: String(university.name) }
          setSelectedUniversity(selected)
          setUniversityQuery(selected.name)
        } else {
          setSelectedUniversity(null)
          setUniversityQuery(schoolText)
        }
      } else {
        if (schoolText.trim()) {
          const { data: matchedUniversity } = await supabase
            .from('universities')
            .select('id, name, verified')
            .ilike('name', schoolText.trim())
            .maybeSingle()

          if (matchedUniversity?.id && matchedUniversity?.name) {
            const selected = {
              id: matchedUniversity.id as string | number,
              name: String(matchedUniversity.name),
              verified: typeof matchedUniversity.verified === 'boolean' ? matchedUniversity.verified : null,
            }
            setSelectedUniversity(selected)
            setUniversityQuery(selected.name)
          } else {
            setSelectedUniversity(null)
            setUniversityQuery(schoolText)
          }
        } else {
          setSelectedUniversity(null)
          setUniversityQuery(schoolText)
        }
      }

      setLoading(false)
      setIsProfileLoaded(true)
    }

    void loadLatestProfile()
  }, [userId])

  useEffect(() => {
    return () => {
      if (profilePhotoPreviewUrl) {
        URL.revokeObjectURL(profilePhotoPreviewUrl)
      }
    }
  }, [profilePhotoPreviewUrl])

  useEffect(() => {
    if (mode !== 'edit' || !pendingFocusId) return

    const timer = setTimeout(() => {
      const target = document.getElementById(pendingFocusId)
      if (target instanceof HTMLElement) {
        target.focus()
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setPendingFocusId(null)
    }, 60)

    return () => clearTimeout(timer)
  }, [mode, pendingFocusId])

  useEffect(() => {
    const query = universityQuery.trim()
    if (query.length < 2 || (selectedUniversity && selectedUniversity.name === universityQuery)) {
      return
    }

    const supabase = supabaseBrowser()
    let active = true

    const timer = setTimeout(() => {
      void (async () => {
        if (!active) return
        setUniversityLoading(true)

        const urlPrefix =
          process.env.NODE_ENV !== 'production'
            ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').slice(0, 10)
            : ''
        if (process.env.NODE_ENV !== 'production') {
          console.log('[UniversitySearch] supabase url prefix:', urlPrefix)
          console.log('[UniversitySearch] query:', query)
        }

        const { data, error: searchError } = await supabase
          .from('universities')
          .select('id,name,state,country,verified')
          .ilike('name', `%${query}%`)
          .order('name', { ascending: true })
          .limit(10)

        if (!active) return

        if (searchError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[UniversitySearch] error:', searchError.message)
          }
          setUniversitySearchError(searchError.message)
          setUniversityOptions([])
        } else {
          setUniversitySearchError(null)
          const nextOptions = (data ?? []).reduce<University[]>((acc, item) => {
            if (
              !item ||
              (typeof item.id !== 'string' && typeof item.id !== 'number') ||
              typeof item.name !== 'string'
            ) {
              return acc
            }

            acc.push({
              id: item.id,
              name: item.name,
              state: typeof item.state === 'string' ? item.state : null,
              country: typeof item.country === 'string' ? item.country : null,
              verified: typeof item.verified === 'boolean' ? item.verified : null,
            })
            return acc
          }, [])

          if (process.env.NODE_ENV !== 'production') {
            console.log('[UniversitySearch] row count:', nextOptions.length)
          }
          setUniversityOptions(nextOptions)
        }

        setUniversityLoading(false)
      })()
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [selectedUniversity, universityQuery])

  const addCourseworkOptions = useMemo(() => {
    return [...new Set([...universityCourseworkCatalog, ...canonicalCourseworkOptions, ...suggestedCoursework])].filter(
      (course) => !includesCoursework(coursework, course)
    )
  }, [canonicalCourseworkOptions, coursework, suggestedCoursework, universityCourseworkCatalog])

  const filteredCourseworkOptions = useMemo(() => {
    const query = normalizeCatalogToken(courseworkInput)
    if (!query) return addCourseworkOptions.slice(0, 8)
    return addCourseworkOptions.filter((course) => normalizeCatalogToken(course).includes(query)).slice(0, 8)
  }, [addCourseworkOptions, courseworkInput])

  const filteredSkillOptions = useMemo(() => {
    const query = normalizeCatalogToken(skillInput)
    const available = canonicalSkillOptions.filter((skill) => !includesSkill(skills, skill))
    if (!query) return available.slice(0, 8)
    return available.filter((skill) => normalizeCatalogToken(skill).includes(query)).slice(0, 8)
  }, [canonicalSkillOptions, skillInput, skills])

  const filteredCourseworkCategoryOptions = useMemo(() => {
    const query = normalizeCatalogToken(courseworkCategoryInput)
    const available = canonicalCourseworkCategoryOptions.filter(
      (category) => !includesCourseworkCategory(courseworkCategories, category)
    )
    if (!query) return available.slice(0, 8)
    return available.filter((category) => normalizeCatalogToken(category).includes(query)).slice(0, 8)
  }, [canonicalCourseworkCategoryOptions, courseworkCategories, courseworkCategoryInput])

  useEffect(() => {
    let active = true

    const timer = setTimeout(() => {
      void (async () => {
        if (!active) return

        if (!selectedUniversity || !selectedMajorId || !major.trim()) {
          setSuggestedCoursework([])
          return
        }

        const universityIdValue =
          typeof selectedUniversity.id === 'number'
            ? selectedUniversity.id
            : Number(selectedUniversity.id)

        if (!Number.isFinite(universityIdValue)) {
          setSuggestedCoursework([])
          return
        }

        const supabase = supabaseBrowser()
        setSuggestionsLoading(true)

        const { data, error: suggestionError } = await supabase.rpc('course_suggestions', {
          p_university_id: universityIdValue,
          p_major: major,
          p_query: '',
          p_limit: 12,
        })

        if (!active) return

        if (suggestionError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[CourseSuggestions] error:', suggestionError.message)
          }
          setSuggestedCoursework([])
          setSuggestionsLoading(false)
          return
        }

        const nextSuggestions = (Array.isArray(data) ? data : []).reduce((acc: string[], row: unknown) => {
          const code =
            row && typeof row === 'object' && 'code' in row && typeof row.code === 'string'
              ? row.code.trim()
              : ''
          if (!code || includesCoursework(acc, code)) return acc
          acc.push(code)
          return acc
        }, [])

        setSuggestedCoursework(nextSuggestions)
        setSuggestionsLoading(false)
      })()
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [major, selectedMajorId, selectedUniversity])

function addCourseworkItem(value: string) {
    const normalized = normalizeCourseworkName(value)
    if (!normalized || includesCoursework(coursework, normalized)) return
    setCoursework((prev) => [...prev, normalized])
    setCourseworkInput('')
  }

  function addCourseworkCategoryItem(value: string) {
    const normalized = normalizeCourseworkName(value)
    if (!normalized || includesCourseworkCategory(courseworkCategories, normalized)) return
    setCourseworkCategories((prev) => [...prev, normalized])
    setCourseworkCategoryInput('')
  }

  function removeCourseworkCategoryItem(value: string) {
    setCourseworkCategories((prev) =>
      prev.filter((item) => normalizeCourseworkName(item).toLowerCase() !== normalizeCourseworkName(value).toLowerCase())
    )
  }

  function removeCourseworkItem(value: string) {
    setCoursework((prev) =>
      prev.filter((item) => normalizeCourseworkName(item).toLowerCase() !== normalizeCourseworkName(value).toLowerCase())
    )
  }

  function addSkillItem(value: string) {
    const normalized = normalizeSkillName(value)
    if (!normalized || includesSkill(skills, normalized)) return
    setSkills((prev) => [...prev, normalized])
    setSkillInput('')
  }

  function removeSkillItem(value: string) {
    setSkills((prev) =>
      prev.filter((item) => normalizeSkillName(item).toLowerCase() !== normalizeSkillName(value).toLowerCase())
    )
  }

  function toggleAvailability(season: (typeof seasons)[number]) {
    setAvailability((prev) =>
      prev.includes(season) ? prev.filter((item) => item !== season) : [...prev, season]
    )
  }

  async function saveProfile() {
    setError(null)
    setUniversityError(null)

    if (!selectedUniversity) {
      setUniversityError('Please select a university from the list.')
      setError('Please select a verified university before saving.')
      return
    }
    if (!selectedMajor?.id) {
      setMajorError('Select a verified major from the list.')
      setError('Please select a verified major before saving.')
      return
    }

    if (availability.length === 0) {
      setError('Select at least one season.')
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.')
      return
    }

    setSaving(true)
    const supabase = supabaseBrowser()

    const safeExperienceLevel = normalizeExperienceLevel(experienceLevel)
    const normalizedCourseworkList = coursework
      .map((course) => normalizeCourseworkName(course))
      .filter(Boolean)
    const normalizedCourseworkCategoryList = courseworkCategories
      .map((category) => normalizeCourseworkName(category))
      .filter(Boolean)
    const normalizedSkillsList = skills.map((skill) => normalizeSkillName(skill)).filter(Boolean)
    const normalizedCourseworkText =
      normalizedCourseworkList.length > 0 ? normalizedCourseworkList.join(', ') : ''
    const [{ skillIds: normalizedSkillIds, unknown: unknownSkills }, { courseworkItemIds, unknown: unknownCoursework }] =
      await Promise.all([
        normalizeSkillsClient(normalizedSkillsList),
        normalizeCourseworkClient(normalizedCourseworkList),
      ])

    const { categoryIds: mappedCategoryIdsFromText } = await (async () => {
      const response = await fetch('/api/coursework/map-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: normalizedCourseworkList }),
      })
      if (!response.ok) return { categoryIds: [] as string[] }
      const payload = (await response.json()) as { categoryIds?: string[] }
      return {
        categoryIds: Array.isArray(payload.categoryIds)
          ? payload.categoryIds.filter((item): item is string => typeof item === 'string')
          : [],
      }
    })()
    const normalizedMajor = selectedMajor.name.trim() || null
    let avatarUrl = profilePhotoUrl.trim()
    let resumePath = resumeStoragePath.trim()
    let resumeName = resumeFileName.trim()

    if (profilePhotoFile) {
      const uploadPath = `students/${userId}/avatar-${Date.now()}-${profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
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
        avatarUrl = urlData.publicUrl
        uploaded = true
        break
      }

      if (!uploaded) {
        setSaving(false)
        setError(uploadMessage)
        return
      }
    }

    if (resumeFile) {
      const sanitizedFileName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const resumePathForStorage = `profiles/${userId}/resume-${Date.now()}-${sanitizedFileName}`
      const { error: resumeUploadError } = await supabase.storage
        .from('resumes')
        .upload(resumePathForStorage, resumeFile, { contentType: 'application/pdf', upsert: true })

      if (resumeUploadError) {
        setSaving(false)
        setError(resumeUploadError.message)
        return
      }

      resumePath = resumePathForStorage
      resumeName = resumeFile.name
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName || null,
        avatar_url: avatarUrl || null,
        resume_path: resumePath || null,
        resume_file_name: resumeName || null,
      },
    })

    if (authError) {
      setSaving(false)
      setError(authError.message)
      return
    }

    const basePayload = {
      user_id: userId,
      university_id: selectedUniversity.id,
      school: selectedUniversity.name,
      major_id: selectedMajor.id,
      year: graduationYear.trim() || null,
      experience_level: safeExperienceLevel,
      availability_start_month: availabilityStartMonth.trim() || null,
      availability_hours_per_week: Number(availabilityHoursPerWeek),
      preferred_city: preferredCity.trim() || null,
      preferred_state: preferredState.trim() || null,
      preferred_zip: preferredZip.trim() || null,
      max_commute_minutes: Number(maxCommuteMinutes) || 30,
      transport_mode: transportMode,
      exact_address_line1: exactAddressLine1.trim() || null,
    }

    function buildPayloadVariants(options: {
      includeUniversityId: boolean
      includePreferences: boolean
    }): Array<Record<string, unknown>> {
      const payloadBase: Record<string, unknown> = { ...basePayload }
      if (!options.includeUniversityId) {
        delete payloadBase.university_id
      }

      const attachPreferences = (payload: Record<string, unknown>) =>
        options.includePreferences
          ? {
              ...payload,
              preferences: {
                remoteOk,
                seasons: availability,
                profileHeadline: profileHeadline.trim() || '',
                skills: normalizedSkillsList,
              },
            }
          : payload

      return [
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor,
          coursework: normalizedCourseworkText,
        }),
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor ? [normalizedMajor] : null,
          coursework: normalizedCourseworkText,
        }),
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor,
          coursework: normalizedCourseworkList.length > 0 ? normalizedCourseworkList : [],
        }),
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor ? [normalizedMajor] : null,
          coursework: normalizedCourseworkList.length > 0 ? normalizedCourseworkList : [],
        }),
      ]
    }

    async function tryUpserts(variants: Array<Record<string, unknown>>) {
      const errors: string[] = []
      let lastMessage = ''

      for (const payload of variants) {
        const { error: saveError } = await supabase.from('student_profiles').upsert(payload, {
          onConflict: 'user_id',
        })

        if (!saveError) {
          return { saved: true, errors, lastMessage: '' }
        }

        lastMessage = saveError.message
        errors.push(saveError.message.toLowerCase())
      }

      return { saved: false, errors, lastMessage }
    }

    const fallbackConfigs = [
      { includeUniversityId: true, includePreferences: true },
      { includeUniversityId: true, includePreferences: false },
      { includeUniversityId: false, includePreferences: true },
      { includeUniversityId: false, includePreferences: false },
    ] as const

    let attempt = { saved: false, errors: [] as string[], lastMessage: '' }
    let saved = false

    for (const config of fallbackConfigs) {
      attempt = await tryUpserts(buildPayloadVariants(config))
      if (attempt.saved) {
        saved = true
        break
      }
    }

    setSaving(false)

    if (!saved) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[StudentProfileSave] failed:', attempt.lastMessage || 'unknown error')
      }
      setError(attempt.lastMessage || 'Unable to save profile right now. Please try again.')
      return
    }

    const { error: clearSkillItemsError } = await supabase
      .from('student_skill_items')
      .delete()
      .eq('student_id', userId)

    if (clearSkillItemsError) {
      setError(clearSkillItemsError.message)
      return
    }

    if (normalizedSkillIds.length > 0) {
      const { error: insertSkillItemsError } = await supabase.from('student_skill_items').insert(
        normalizedSkillIds.map((skillId) => ({
          student_id: userId,
          skill_id: skillId,
          level: null,
        }))
      )

      if (insertSkillItemsError) {
        setError(insertSkillItemsError.message)
        return
      }
    }

    const { error: clearCourseworkItemsError } = await supabase
      .from('student_coursework_items')
      .delete()
      .eq('student_id', userId)
    if (clearCourseworkItemsError) {
      setError(clearCourseworkItemsError.message)
      return
    }

    if (courseworkItemIds.length > 0) {
      const { error: insertCourseworkItemsError } = await supabase.from('student_coursework_items').insert(
        courseworkItemIds.map((courseworkItemId) => ({
          student_id: userId,
          coursework_item_id: courseworkItemId,
        }))
      )
      if (insertCourseworkItemsError) {
        setError(insertCourseworkItemsError.message)
        return
      }
    }

    const [{ data: selectedCategoryRows }, { data: itemCategoryRows }, { error: clearCategoryLinksError }] = await Promise.all([
      normalizedCourseworkCategoryList.length > 0
        ? supabase.from('coursework_categories').select('id').in('name', normalizedCourseworkCategoryList)
        : Promise.resolve({ data: [] as Array<{ id: string }> }),
      courseworkItemIds.length > 0
        ? supabase
            .from('coursework_item_category_map')
            .select('category_id')
            .in('coursework_item_id', courseworkItemIds)
        : Promise.resolve({ data: [] as Array<{ category_id: string }> }),
      supabase.from('student_coursework_category_links').delete().eq('student_id', userId),
    ])

    if (clearCategoryLinksError) {
      setError(clearCategoryLinksError.message)
      return
    }

    const derivedCategoryIds = Array.from(
      new Set([
        ...((selectedCategoryRows ?? []).map((row) => row.id).filter((value): value is string => typeof value === 'string')),
        ...((itemCategoryRows ?? []).map((row) => row.category_id).filter((value): value is string => typeof value === 'string')),
        ...mappedCategoryIdsFromText,
      ])
    )

    if (derivedCategoryIds.length > 0) {
      const { error: insertCategoryLinksError } = await supabase.from('student_coursework_category_links').insert(
        derivedCategoryIds.map((categoryId) => ({
          student_id: userId,
          category_id: categoryId,
        }))
      )
      if (insertCategoryLinksError) {
        setError(insertCategoryLinksError.message)
        return
      }
    }

    const recoveryReadyAfterSave =
      getMinimumProfileCompleteness({
        school: selectedUniversity.name,
        majors: normalizedMajor ? [normalizedMajor] : [],
        availability_start_month: availabilityStartMonth.trim() || null,
        availability_hours_per_week: Number(availabilityHoursPerWeek),
      }).ok && Boolean(resumePath || resumeName || resumeFile)

    if (returnTo && recoveryReadyAfterSave) {
      try {
        await fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_name: 'apply_recovery_completed',
            properties: { return_to: returnTo, recovery_code: recoveryCode ?? null },
          }),
          keepalive: true,
        })
      } catch {
        // no-op
      }

      clearStoredReturnTo()
      router.push(addRecoverySuccessParam(returnTo))
      router.refresh()
      return
    }

    showToast({
      kind: 'success',
      message:
        unknownSkills.length > 0 || unknownCoursework.length > 0
          ? `Preferences saved. Stored fallback text for unrecognized items: ${[
              ...unknownSkills.map((item) => `skill: ${item}`),
              ...unknownCoursework.map((item) => `coursework: ${item}`),
            ].join(', ')}`
          : 'Preferences saved.',
      key: 'student-preferences-saved',
    })
    setProfilePhotoUrl(avatarUrl)
    setProfilePhotoFile(null)
    setResumeStoragePath(resumePath)
    setResumeFileName(resumeName)
    setResumeFile(null)
    if (profilePhotoPreviewUrl) {
      URL.revokeObjectURL(profilePhotoPreviewUrl)
      setProfilePhotoPreviewUrl(null)
    }
    setMode('view')
  }

  async function signOut() {
    const confirmed = window.confirm('Are you sure you want to sign out?')
    if (!confirmed) return

    setSigningOut(true)
    const supabase = supabaseBrowser()
    const { error: signOutError } = await supabase.auth.signOut()
    setSigningOut(false)

    if (signOutError) {
      setError(signOutError.message)
      return
    }

    router.push('/login')
    router.refresh()
  }

  function editField(focusId: string) {
    setMode('edit')
    setPendingFocusId(focusId)
  }

    return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Student account</h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'view' ? 'Your saved profile settings.' : 'Update your profile in about a minute.'}
          </p>
        </div>
        {mode === 'view' && (
          <button
            type="button"
            onClick={() => {
              setMode('edit')
            }}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit profile
          </button>
        )}
      </div>

      {mode === 'edit' && !hasSavedProfile && (
        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Set your preferences to get better matches.
        </div>
      )}

      {loading && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-200" />
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {returnTo && (
        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {recoveryReady ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>Profile requirements are complete. Continue your application.</p>
              <Link
                href={returnTo}
                onClick={() => clearStoredReturnTo()}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Continue Application
              </Link>
            </div>
          ) : (
            <p>
              {recoveryCode === 'RESUME_REQUIRED'
                ? 'Upload a resume and complete required profile fields to continue your application.'
                : 'Complete required profile fields to continue your application.'}
            </p>
          )}
        </div>
      )}
      {mode === 'view' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {showCardHints && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:col-span-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                <span>{missingCount} sections still need completion.</span>
              </div>
            </div>
          )}

          <div className={`${cardClass(!completionFlags.identity)} sm:col-span-2`}>
            {showCardHints && !completionFlags.identity && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit identity"
              onClick={() => editField('first-name')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-4">
              {profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhotoUrl}
                  alt="Profile"
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {initialsForName(firstName, lastName)}
                </div>
              )}
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {[firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'Student'}
                </div>
                {isProfileLoaded ? (
                  <div className="text-sm text-slate-600">{email || 'No email on file'}</div>
                ) : (
                  <div className="mt-1 h-4 w-40 animate-pulse rounded bg-slate-200" />
                )}
                {profileHeadline && <div className="mt-1 text-sm text-slate-700">{profileHeadline}</div>}
              </div>
            </div>
          </div>

          <div className={cardClass(!completionFlags.university)}>
            {showCardHints && !completionFlags.university && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit university"
              onClick={() => editField('university-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">University</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {isProfileLoaded ? selectedUniversity?.name || universityQuery || 'Not set' : (
                <span className="block h-4 w-44 animate-pulse rounded bg-slate-200" />
              )}
            </div>
            {isProfileLoaded && !selectedUniversity && universityQuery && (
              <div className="mt-1 text-xs text-amber-700">Unverified university. Edit profile to verify.</div>
            )}
          </div>
          <div className={cardClass(!completionFlags.major)}>
            {showCardHints && !completionFlags.major && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit major"
              onClick={() => editField('major-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Major / interest area</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{major || 'Not set'}</div>
          </div>
          <div className={cardClass(!completionFlags.graduationYear)}>
            {showCardHints && !completionFlags.graduationYear && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit graduation year"
              onClick={() => editField('graduation-year-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Graduation year</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{graduationYear || 'Not set'}</div>
          </div>
          <div className={cardClass(!completionFlags.experience)}>
            {showCardHints && !completionFlags.experience && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit experience level"
              onClick={() => editField('experience-level-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Experience level</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{getExperienceLabel(experienceLevel)}</div>
          </div>
          <div id="availability" className={cardClass(!completionFlags.startMonth)}>
            {showCardHints && !completionFlags.startMonth && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit start month"
              onClick={() => editField('start-month-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Availability start month</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{availabilityStartMonth || 'Not set'}</div>
          </div>
          <div className={cardClass(!completionFlags.hours)}>
            {showCardHints && !completionFlags.hours && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit hours per week"
              onClick={() => editField('hours-per-week-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Hours per week</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {availabilityHoursPerWeek ? String(availabilityHoursPerWeek) : 'Not set'}
            </div>
          </div>

          <div className={`${cardClass(!completionFlags.coursework)} sm:col-span-2`}>
            {showCardHints && !completionFlags.coursework && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit coursework"
              onClick={() => editField('coursework-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Coursework</div>
            <div className="mt-2 text-xs font-medium text-slate-500">Categories</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {courseworkCategories.length > 0 ? (
                courseworkCategories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800"
                  >
                    {category}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-700">Not set</span>
              )}
            </div>
            <div className="mt-3 text-xs font-medium text-slate-500">Specific courses</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {coursework.length > 0 ? (
                coursework.map((course) => (
                  <span
                    key={course}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {course}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-700">Not set</span>
              )}
            </div>
          </div>

          <div id="skills" className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <button
              type="button"
              aria-label="Edit skills"
              onClick={() => editField('skills-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Skills</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-700">Not set</span>
              )}
            </div>
          </div>

          <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <button
              type="button"
              aria-label="Edit resume"
              onClick={() => editField('resume-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Resume</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {resumeFileName || (resumeStoragePath ? 'Resume uploaded' : 'Not uploaded')}
            </div>
            <p className="mt-1 text-xs text-slate-600">Used automatically when you apply if you do not upload a new file.</p>
          </div>

          <div id="preferences" className={`${cardClass(!completionFlags.seasons)} sm:col-span-2`}>
            {showCardHints && !completionFlags.seasons && (
              <span className="absolute right-12 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            )}
            <button
              type="button"
              aria-label="Edit season preferences"
              onClick={() => editField('season-summer')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Season preferences</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {availability.length > 0 ? (
                availability.map((season) => (
                  <span
                    key={season}
                    className="rounded-full border border-blue-600 bg-blue-50 px-3 py-1 text-sm text-blue-700"
                  >
                    {season}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-700">Not set</span>
              )}
            </div>
            <div className="mt-3 text-sm text-slate-700">Remote OK: {remoteOk ? 'Yes' : 'No'}</div>
          </div>

          <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <button
              type="button"
              aria-label="Edit commute preferences"
              onClick={() => editField('preferred-city-input')}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Location preferences</div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
              {preferredCity || preferredState ? (
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1">
                  {preferredCity || 'City'}{preferredState ? `, ${preferredState}` : ''}
                </span>
              ) : null}
              {preferredZip ? (
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1">ZIP {preferredZip}</span>
              ) : null}
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1">
                Max commute: {maxCommuteMinutes} min
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Mode: {transportMode}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Account settings</div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              {isProfileLoaded ? (
                <div className="text-sm text-slate-700">{email || 'No email on file'}</div>
              ) : (
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              )}
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">First name</label>
              <input
                id="first-name"
                className={FIELD}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Last name</label>
              <input
                id="last-name"
                className={FIELD}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Profile photo</label>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {profilePhotoPreviewUrl || profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profilePhotoPreviewUrl || profilePhotoUrl}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-slate-600">{initialsForName(firstName, lastName)}</span>
                  )}
                </div>
                <div className="min-w-[260px] flex-1">
                  <input
                    id="profile-photo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      if (!file) return
                      if (!file.type.startsWith('image/')) {
                        setError('Profile photo must be an image file.')
                        return
                      }
                      if (file.size > maxProfilePhotoBytes) {
                        setError('Profile photo must be 2MB or smaller.')
                        return
                      }
                      setError(null)
                      setProfilePhotoFile(file)
                      if (profilePhotoPreviewUrl) {
                        URL.revokeObjectURL(profilePhotoPreviewUrl)
                      }
                      setProfilePhotoPreviewUrl(URL.createObjectURL(file))
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">PNG, JPG, or WEBP. Max 2MB.</p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Profile headline (optional)</label>
              <input
                className={FIELD}
                value={profileHeadline}
                onChange={(e) => setProfileHeadline(e.target.value)}
                placeholder="Finance student focused on internships in valuation and FP&A"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Resume (PDF)</label>
              <input
                id="resume-input"
                type="file"
                accept="application/pdf"
                className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  if (!file) return
                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
                  if (!isPdf) {
                    setError('Resume must be a PDF.')
                    return
                  }
                  if (file.size > maxResumeBytes) {
                    setError('Resume must be 5MB or smaller.')
                    return
                  }
                  setError(null)
                  setResumeFile(file)
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                {resumeFile ? `${resumeFile.name} selected.` : resumeFileName ? `Current: ${resumeFileName}` : 'No resume uploaded yet.'}
              </p>
            </div>

            <div className="sm:col-span-2">
              <UniversityCombobox
                inputId="university-input"
                query={universityQuery}
                onQueryChange={(value) => {
                  setUniversityQuery(value)
                  setUniversityError(null)
                  setUniversitySearchError(null)
                  setError(null)
                  if (selectedUniversity && value.trim() !== selectedUniversity.name) {
                    setSelectedUniversity(null)
                  }
                }}
                options={universityOptions}
                selectedUniversity={selectedUniversity}
                onSelect={(university) => {
                  setSelectedUniversity(university)
                  setUniversityQuery(university.name)
                  setUniversityOptions([])
                  setUniversityError(null)
                }}
                loading={universityLoading}
                error={universityError ?? (process.env.NODE_ENV !== 'production' ? universitySearchError : null)}
              />
              {!selectedUniversity && universityQuery.trim().length > 0 && !universityError && (
                <p className="mt-1 text-xs text-amber-700">Select a verified university from the dropdown list.</p>
              )}
            </div>

            <div>
              <MajorCombobox
                inputId="major-input"
                label="Major"
                query={majorQuery}
                onQueryChange={(value) => {
                  setMajorQuery(value)
                  setMajor(value)
                  setMajorError(null)
                  setError(null)
                  if (selectedMajor && value.trim() !== selectedMajor.name) {
                    setSelectedMajorId(null)
                  }
                }}
                options={majorCatalog}
                selectedMajor={selectedMajor}
                onSelect={(majorOption) => {
                  setSelectedMajorId(majorOption.id)
                  setMajor(majorOption.name)
                  setMajorQuery(majorOption.name)
                  setMajorError(null)
                  setError(null)
                }}
                loading={loading}
                error={majorError}
                placeholder="Start typing your major"
              />
              {!selectedMajor && majorQuery.trim().length > 0 && !majorError ? (
                <p className="mt-1 text-xs text-amber-700">Select a verified major from the dropdown.</p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Graduation year</label>
              <select
                id="graduation-year-input"
                className={FIELD}
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              >
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Relevant experience (in your intended field)
              </label>
              <select
                id="experience-level-input"
                className={FIELD}
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(normalizeExperienceLevel(e.target.value))}
              >
                {experienceLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Not about having any job—about experience related to your major/career path.
              </p>
            </div>

            <div id="availability">
              <label className="text-sm font-medium text-slate-700">Availability start month</label>
              <select
                id="start-month-input"
                className={FIELD}
                value={availabilityStartMonth}
                onChange={(e) => setAvailabilityStartMonth(e.target.value)}
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Availability hours per week</label>
              <select
                id="hours-per-week-input"
                className={FIELD}
                value={String(availabilityHoursPerWeek)}
                onChange={(e) => setAvailabilityHoursPerWeek(Number(e.target.value))}
              >
                {hoursPerWeekOptions.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Preferred city</label>
              <input
                id="preferred-city-input"
                className={FIELD}
                value={preferredCity}
                onChange={(e) => setPreferredCity(e.target.value)}
                placeholder="Salt Lake City"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Preferred state</label>
              <input
                className={FIELD}
                value={preferredState}
                onChange={(e) => setPreferredState(e.target.value.toUpperCase())}
                placeholder="UT"
                maxLength={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Preferred ZIP (optional)</label>
              <input
                className={FIELD}
                value={preferredZip}
                onChange={(e) => setPreferredZip(e.target.value)}
                placeholder="84101"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Max commute (minutes)</label>
              <input
                type="number"
                min={5}
                max={180}
                className={FIELD}
                value={String(maxCommuteMinutes)}
                onChange={(e) => setMaxCommuteMinutes(Number(e.target.value) || 30)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Transportation mode</label>
              <select
                className={FIELD}
                value={transportMode}
                onChange={(e) => {
                  const next = e.target.value as (typeof transportModes)[number]
                  setTransportMode(transportModes.includes(next) ? next : 'driving')
                }}
              >
                {transportModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Exact address (optional advanced)</label>
              <input
                className={FIELD}
                value={exactAddressLine1}
                onChange={(e) => setExactAddressLine1(e.target.value)}
                placeholder="Optional, for more precise commute estimates"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Coursework categories (primary)</label>
              <div className="relative mt-2">
                <input
                  id="coursework-category-input"
                  className={FIELD}
                  value={courseworkCategoryInput}
                  onChange={(e) => setCourseworkCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCourseworkCategoryItem(courseworkCategoryInput)
                    }
                  }}
                  placeholder="Add capability area (e.g., Corporate Finance / Valuation)"
                />
                {courseworkCategoryInput.trim().length > 0 && filteredCourseworkCategoryOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredCourseworkCategoryOptions.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => addCourseworkCategoryItem(category)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">These categories are the primary coursework matching signal.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {courseworkCategories.length > 0 ? (
                  courseworkCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => removeCourseworkCategoryItem(category)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800 hover:bg-blue-100"
                    >
                      {category} ×
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No categories selected yet.</span>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Coursework</label>
              {(suggestionsLoading || suggestedCoursework.length > 0) && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500">Suggested coursework</div>
                  {suggestionsLoading ? (
                    <div className="mt-2 text-sm text-slate-500">Loading suggestions...</div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedCoursework.map((course) => {
                        const added = includesCoursework(coursework, course)
                        return (
                          <button
                            key={course}
                            type="button"
                            onClick={() => addCourseworkItem(course)}
                            disabled={added}
                            className={`rounded-full border px-3 py-1 text-sm ${
                              added
                                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                : 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {course}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="relative mt-3">
                <input
                  id="coursework-input"
                  className={FIELD}
                  value={courseworkInput}
                  onChange={(e) => setCourseworkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCourseworkItem(courseworkInput)
                    }
                  }}
                  placeholder="Add coursework"
                />
                {courseworkInput.trim().length > 0 && filteredCourseworkOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredCourseworkOptions.map((course) => (
                      <button
                        key={course}
                        type="button"
                        onClick={() => addCourseworkItem(course)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {course}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {hasScopedUniversityCatalog
                  ? 'Type to pick coursework tuned to your selected university, or press Enter to add custom coursework.'
                  : 'Type to pick canonical coursework, or press Enter to add custom coursework.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {coursework.length > 0 ? (
                  coursework.map((course) => (
                    <button
                      key={course}
                      type="button"
                      onClick={() => removeCourseworkItem(course)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {course} ×
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No coursework added yet.</span>
                )}
              </div>
            </div>

            <div id="skills" className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Skills</label>
              <div className="relative mt-2 flex gap-2">
                <input
                  id="skills-input"
                  className={FIELD}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkillItem(skillInput)
                    }
                  }}
                  placeholder="Add skill (e.g., React, SQL, Excel)"
                />
                <button
                  type="button"
                  onClick={() => addSkillItem(skillInput)}
                  className="mt-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Add
                </button>
                {skillInput.trim().length > 0 && filteredSkillOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredSkillOptions.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addSkillItem(skill)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">Type to pick canonical skills, or press Enter to add custom text.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => removeSkillItem(skill)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {skill} ×
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No skills added yet.</span>
                )}
              </div>
            </div>

            <div id="preferences" className="sm:col-span-2">
              <div className="text-sm font-medium text-slate-700">Season preferences</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {seasons.map((season) => {
                  const active = availability.includes(season)
                  return (
                    <button
                      id={season === 'Summer' ? 'season-summer' : undefined}
                      key={season}
                      type="button"
                      onClick={() => toggleAvailability(season)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {season}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  checked={remoteOk}
                  onChange={(e) => setRemoteOk(e.target.checked)}
                />
                Remote OK
              </label>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
