import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ensureUserRole } from '@/lib/auth/ensureUserRole'
import { canUseClaimToken, getClaimTokenStatus, hashEmployerClaimToken } from '@/lib/auth/employerClaimToken'
import { getAppUrl } from '@/lib/billing/stripe'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{ token?: string }>

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function mergeCompanyProfile(
  target: {
    company_name: string | null
    website: string | null
    contact_email: string | null
    industry: string | null
    location: string | null
    overview: string | null
    avatar_url: string | null
    header_image_url: string | null
  } | null,
  source: {
    company_name: string | null
    website: string | null
    contact_email: string | null
    industry: string | null
    location: string | null
    overview: string | null
    avatar_url: string | null
    header_image_url: string | null
  } | null
) {
  if (!target && !source) {
    return {
      company_name: null,
      website: null,
      contact_email: null,
      industry: null,
      location: null,
      overview: null,
      avatar_url: null,
      header_image_url: null,
    }
  }

  return {
    company_name: target?.company_name ?? source?.company_name ?? null,
    website: target?.website ?? source?.website ?? null,
    contact_email: target?.contact_email ?? source?.contact_email ?? null,
    industry: target?.industry ?? source?.industry ?? null,
    location: target?.location ?? source?.location ?? null,
    overview: target?.overview ?? source?.overview ?? null,
    avatar_url: target?.avatar_url ?? source?.avatar_url ?? null,
    header_image_url: target?.header_image_url ?? source?.header_image_url ?? null,
  }
}

function mergePublicCompanyProfile(
  target: {
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
  } | null,
  source: {
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
  } | null
) {
  if (!target && !source) {
    return {
      company_name: null,
      tagline: null,
      about_us: null,
      website: null,
      industry: null,
      founded_date: null,
      location_city: null,
      location_state: null,
      avatar_url: null,
      header_image_url: null,
    }
  }

  return {
    company_name: target?.company_name ?? source?.company_name ?? null,
    tagline: target?.tagline ?? source?.tagline ?? null,
    about_us: target?.about_us ?? source?.about_us ?? null,
    website: target?.website ?? source?.website ?? null,
    industry: target?.industry ?? source?.industry ?? null,
    founded_date: target?.founded_date ?? source?.founded_date ?? null,
    location_city: target?.location_city ?? source?.location_city ?? null,
    location_state: target?.location_state ?? source?.location_state ?? null,
    avatar_url: target?.avatar_url ?? source?.avatar_url ?? null,
    header_image_url: target?.header_image_url ?? source?.header_image_url ?? null,
  }
}

export default async function EmployerClaimPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const token = String(resolvedSearchParams?.token ?? '').trim()

  if (!token) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Invalid claim link</h1>
          <p className="mt-2 text-sm text-slate-600">This claim link is missing required information.</p>
        </section>
      </main>
    )
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    let appUrl = ''
    try {
      appUrl = getAppUrl()
    } catch {
      appUrl = ''
    }

    const nextPath = `/claim/employer?token=${encodeURIComponent(token)}`
    const loginHref = appUrl
      ? `${appUrl}/login?next=${encodeURIComponent(nextPath)}`
      : `/login?next=${encodeURIComponent(nextPath)}`

    redirect(loginHref)
  }

  const admin = supabaseAdmin()
  const tokenHash = hashEmployerClaimToken(token)
  const { data: tokenRow } = await admin
    .from('employer_claim_tokens')
    .select('id, employer_id, contact_email, used_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Invalid claim link</h1>
          <p className="mt-2 text-sm text-red-700">This link is invalid or no longer available. Request a new claim link.</p>
          <div className="mt-4">
            <Link
              href="/claim/employer/request"
              className="inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Request new link
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const tokenStatus = getClaimTokenStatus(tokenRow)
  if (tokenStatus !== 'valid') {
    const statusMessage = tokenStatus === 'used' ? 'already used' : 'expired'
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Claim link {statusMessage}</h1>
          <p className="mt-2 text-sm text-red-700">Please request a new claim link from your concierge contact.</p>
          <div className="mt-4">
            <Link
              href="/claim/employer/request"
              className="inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Request new link
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const authEmail = normalizeEmail(user.email)
  const contactEmail = normalizeEmail(tokenRow.contact_email)

  if (!authEmail || authEmail !== contactEmail) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Email mismatch</h1>
          <p className="mt-2 text-sm text-red-700">
            This claim link is for <strong>{tokenRow.contact_email}</strong>. Sign in with that email or request a new link.
          </p>
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/login"
                className="inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Use different account
              </Link>
              <Link
                href="/claim/employer/request"
                className="inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Request new link
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const nowIso = new Date().toISOString()
  if (!canUseClaimToken(tokenRow)) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Claim link unavailable</h1>
          <p className="mt-2 text-sm text-red-700">Please request a new claim link from your concierge contact.</p>
          <div className="mt-4">
            <Link
              href="/claim/employer/request"
              className="inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Request new link
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const { data: consumedToken } = await admin
    .from('employer_claim_tokens')
    .update({ used_at: nowIso, used_by: user.id })
    .eq('id', tokenRow.id)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('id, employer_id')
    .maybeSingle()

  if (!consumedToken?.id) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Claim link already used</h1>
          <p className="mt-2 text-sm text-red-700">This link has already been used. Request a new link.</p>
          <div className="mt-4">
            <Link
              href="/claim/employer/request"
              className="inline-flex rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Request new link
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const sourceEmployerId = consumedToken.employer_id

  if (sourceEmployerId !== user.id) {
    const [{ data: sourceProfile }, { data: targetProfile }, { data: sourcePublicProfile }, { data: targetPublicProfile }] = await Promise.all([
      admin
        .from('employer_profiles')
        .select('user_id, company_name, website, contact_email, industry, location, overview, avatar_url, header_image_url')
        .eq('user_id', sourceEmployerId)
        .maybeSingle(),
      admin
        .from('employer_profiles')
        .select('user_id, company_name, website, contact_email, industry, location, overview, avatar_url, header_image_url')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('employer_public_profiles')
        .select('employer_id, company_name, tagline, about_us, website, industry, founded_date, location_city, location_state, avatar_url, header_image_url')
        .eq('employer_id', sourceEmployerId)
        .maybeSingle(),
      admin
        .from('employer_public_profiles')
        .select('employer_id, company_name, tagline, about_us, website, industry, founded_date, location_city, location_state, avatar_url, header_image_url')
        .eq('employer_id', user.id)
        .maybeSingle(),
    ])

    if (sourceProfile?.user_id) {
      const { error: internshipsTransferError } = await admin
        .from('internships')
        .update({ employer_id: user.id })
        .eq('employer_id', sourceEmployerId)

      if (internshipsTransferError) {
        return (
          <main className="min-h-screen bg-white px-6 py-12">
            <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6">
              <h1 className="text-xl font-semibold text-red-800">Could not complete claim</h1>
              <p className="mt-2 text-sm text-red-700">{internshipsTransferError.message}</p>
            </section>
          </main>
        )
      }

      if (targetProfile?.user_id) {
        const merged = mergeCompanyProfile(targetProfile, sourceProfile)
        await admin.from('employer_profiles').update(merged).eq('user_id', user.id)
        await admin.from('employer_profiles').delete().eq('user_id', sourceEmployerId)
      } else {
        await admin.from('employer_profiles').update({ user_id: user.id }).eq('user_id', sourceEmployerId)
      }
    }

    if (sourcePublicProfile?.employer_id) {
      if (targetPublicProfile?.employer_id) {
        const mergedPublic = mergePublicCompanyProfile(targetPublicProfile, sourcePublicProfile)
        await admin.from('employer_public_profiles').update(mergedPublic).eq('employer_id', user.id)
        await admin.from('employer_public_profiles').delete().eq('employer_id', sourceEmployerId)
      } else {
        await admin
          .from('employer_public_profiles')
          .update({ employer_id: user.id })
          .eq('employer_id', sourceEmployerId)
      }
    }

    const { data: sourceAuthData } = await admin.auth.admin.getUserById(sourceEmployerId)
    const sourceAuthEmail = normalizeEmail(sourceAuthData.user?.email)
    const sourceMetadata = (sourceAuthData.user?.user_metadata ?? {}) as { concierge_placeholder?: unknown }
    const isConciergePlaceholder =
      sourceAuthEmail.endsWith('@example.invalid') || sourceMetadata.concierge_placeholder === true

    // Clean up placeholder concierge accounts after a successful transfer.
    if (isConciergePlaceholder) {
      await Promise.all([
        admin.from('users').delete().eq('id', sourceEmployerId),
        admin.auth.admin.deleteUser(sourceEmployerId),
      ])
    }
  }

  await ensureUserRole(user.id, 'employer', { explicitSwitch: true })
  redirect('/inbox?claimed=1')
}
