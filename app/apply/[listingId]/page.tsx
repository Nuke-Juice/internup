import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/requireRole'
import ApplyForm from './ApplyForm'

function formatMajors(value: string[] | string | null) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>
  searchParams?: { error?: string }
}) {
  const { user } = await requireRole('student')
  const { listingId } = await params
  const supabase = await supabaseServer()

  const { data: listing } = await supabase
    .from('internships')
    .select('id, title, company_name, location, experience_level, majors, description')
    .eq('id', listingId)
    .single()

  if (!listing) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <a href="/internships" className="text-sm font-medium text-blue-700 hover:underline">
            â† Back to internships
          </a>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h1 className="text-xl font-semibold text-slate-900">Listing not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This internship no longer exists or the link is incorrect.
            </p>
          </div>
        </div>
      </main>
    )
  }

  async function submitApplication(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('student')
    const listingId = listing.id
    const file = formData.get('resume') as File | null

    if (!listingId || !file) {
      redirect(`/apply/${params.listingId}?error=Missing+resume`)
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      redirect(`/apply/${params.listingId}?error=Resume+must+be+a+PDF`)
    }

    const supabaseAction = await supabaseServer()
    const { data: existing } = await supabaseAction
      .from('applications')
      .select('id')
      .eq('student_id', currentUser.id)
      .eq('internship_id', listingId)
      .maybeSingle()

    if (existing?.id) {
      redirect(`/apply/${params.listingId}?error=You+already+applied+to+this+internship`)
    }

    const timestamp = Date.now()
    const path = `resumes/${currentUser.id}/${listingId}/${timestamp}.pdf`
    const { error: uploadError } = await supabaseAction.storage
      .from('resumes')
      .upload(path, file, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      redirect(`/apply/${params.listingId}?error=${encodeURIComponent(uploadError.message)}`)
    }

    const { error: insertError } = await supabaseAction.from('applications').insert({
      internship_id: listingId,
      student_id: currentUser.id,
      resume_url: path,
      status: 'submitted',
    })

    if (insertError) {
      redirect(`/apply/${params.listingId}?error=${encodeURIComponent(insertError.message)}`)
    }

    redirect('/applications')
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <a href="/internships" className="text-sm font-medium text-blue-700 hover:underline">
          â† Back to internships
        </a>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Apply</h1>
        <p className="mt-2 text-slate-600">Submit your resume for this internship.</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-slate-900">{listing.title}</div>
            <div className="text-sm text-slate-600">
              {listing.company_name || 'Company'} â€¢ {listing.location || 'TBD'}
            </div>
            <div className="text-xs text-slate-500">
              Experience: {listing.experience_level || 'TBD'}
            </div>
            {listing.majors && (
              <div className="text-xs text-slate-500">
                Majors: {formatMajors(listing.majors)}
              </div>
            )}
          </div>

          {listing.description && (
            <p className="mt-4 text-sm text-slate-600">{listing.description}</p>
          )}

          {searchParams?.error && (
            <p className="mt-4 text-sm text-red-600">{decodeURIComponent(searchParams.error)}</p>
          )}

          <ApplyForm listingId={listing.id} action={submitApplication} />
        </div>
      </div>
    </main>
  )
}
