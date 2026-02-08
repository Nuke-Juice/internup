import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import ApplyButton from '../_components/ApplyButton'

function formatMajors(value: string[] | string | null) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: listing } = await supabase
    .from('internships')
    .select('id, title, company_name, location, experience_level, majors, description, hours_per_week')
    .eq('id', id)
    .maybeSingle()

  if (!listing) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/jobs" className="text-sm font-medium text-blue-700 hover:underline">
            Back to jobs
          </Link>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h1 className="text-xl font-semibold text-slate-900">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This listing no longer exists or the link is incorrect.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/jobs" className="text-sm font-medium text-blue-700 hover:underline">
          Back to jobs
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">{listing.title || 'Internship'}</h1>
            <div className="text-sm text-slate-600">
              {listing.company_name || 'Company'} · {listing.location || 'TBD'}
            </div>
            <div className="text-xs text-slate-500">
              Experience: {listing.experience_level || 'TBD'}
            </div>
            {typeof listing.hours_per_week === 'number' && (
              <div className="text-xs text-slate-500">Hours/week: {listing.hours_per_week}</div>
            )}
            {listing.majors && (
              <div className="text-xs text-slate-500">Majors: {formatMajors(listing.majors)}</div>
            )}
          </div>

          {listing.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{listing.description}</p>
          )}

          <div className="mt-6">
            <ApplyButton
              listingId={listing.id}
              isAuthenticated={Boolean(user)}
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
