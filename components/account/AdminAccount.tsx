'use client'

import { useMemo, useState } from 'react'
import { useToast } from '@/components/feedback/ToastProvider'
import { supabaseBrowser } from '@/lib/supabase/client'

type Props = {
  userId: string
  userEmail: string | null
  initialFirstName: string
  initialLastName: string
  initialAvatarUrl: string
}

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const profilePhotoBuckets = ['avatars', 'profile-photos']

function initialsForName(firstName: string, lastName: string) {
  const first = firstName.trim().slice(0, 1).toUpperCase()
  const last = lastName.trim().slice(0, 1).toUpperCase()
  return `${first}${last}` || 'A'
}

export default function AdminAccount({
  userId,
  userEmail,
  initialFirstName,
  initialLastName,
  initialAvatarUrl,
}: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { showToast } = useToast()

  const displayName = useMemo(() => {
    const combined = `${firstName.trim()} ${lastName.trim()}`.trim()
    return combined || 'Admin user'
  }, [firstName, lastName])

  async function saveAdminProfile() {
    setError(null)
    setSuccess(null)

    if (!firstName.trim()) {
      const message = 'First name is required.'
      setError(message)
      showToast({ kind: 'error', message, key: 'admin-profile-missing-first-name' })
      return
    }
    if (!lastName.trim()) {
      const message = 'Last name is required.'
      setError(message)
      showToast({ kind: 'error', message, key: 'admin-profile-missing-last-name' })
      return
    }

    setSaving(true)
    const supabase = supabaseBrowser()
    let nextAvatarUrl = avatarUrl.trim()

    if (profilePhotoFile) {
      const uploadPath = `admins/${userId}/avatar-${Date.now()}-${profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
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
        setSaving(false)
        setError(uploadMessage)
        showToast({ kind: 'error', message: uploadMessage, key: `admin-profile-upload-error:${uploadMessage}` })
        return
      }
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName || null,
        avatar_url: nextAvatarUrl || null,
      },
    })

    setSaving(false)

    if (authError) {
      setError(authError.message)
      showToast({ kind: 'error', message: authError.message, key: `admin-profile-auth-error:${authError.message}` })
      return
    }

    setAvatarUrl(nextAvatarUrl)
    setProfilePhotoFile(null)
    const message = 'Admin profile saved.'
    setSuccess(message)
    showToast({ kind: 'success', message, key: 'admin-profile-saved' })
    setMode('view')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin profile</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your account identity and admin access.</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          Admin
        </span>
      </div>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      {mode === 'view' ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-white">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Admin profile photo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                  {initialsForName(firstName, lastName)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold text-slate-900">{displayName}</h2>
              <p className="mt-1 text-sm text-slate-600">{userEmail ?? 'No email on file'}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</div>
              <div className="mt-1 text-sm font-medium text-slate-800">{firstName || 'Not set'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</div>
              <div className="mt-1 text-sm font-medium text-slate-800">{lastName || 'Not set'}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMode('edit')}
            className="mt-5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit profile
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Profile photo</label>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Admin profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                      {initialsForName(firstName, lastName)}
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    if (!file) return
                    if (!file.type.startsWith('image/')) {
                      setError('Profile photo must be an image file.')
                      return
                    }
                    if (file.size > 2 * 1024 * 1024) {
                      setError('Profile photo must be 2MB or smaller.')
                      return
                    }
                    setError(null)
                    setProfilePhotoFile(file)
                  }}
                  className="block text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">First name</label>
              <input className={FIELD} value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Jane" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Last name</label>
              <input className={FIELD} value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Doe" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveAdminProfile}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFirstName(initialFirstName)
                setLastName(initialLastName)
                setAvatarUrl(initialAvatarUrl)
                setProfilePhotoFile(null)
                setError(null)
                setSuccess(null)
                setMode('view')
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
