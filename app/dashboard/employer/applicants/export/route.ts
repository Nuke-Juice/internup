import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

function escapeCsv(value: string | null | undefined) {
  const text = (value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const internshipIdFilter = url.searchParams.get('internship_id')?.trim() ?? ''

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (userRow?.role !== 'employer') return new NextResponse('Forbidden', { status: 403 })

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title')
    .eq('employer_id', user.id)
  const internshipIds = (internships ?? []).map((row) => row.id)
  const scopedInternshipIds = internshipIdFilter && internshipIds.includes(internshipIdFilter) ? [internshipIdFilter] : internshipIds
  if (scopedInternshipIds.length === 0) {
    return new NextResponse('No data', { status: 200 })
  }

  const { data: applications } = await supabase
    .from('applications')
    .select('id, internship_id, student_id, created_at, status, resume_url, external_apply_required, external_apply_completed_at')
    .in('internship_id', scopedInternshipIds)
    .order('created_at', { ascending: false })

  const internshipById = new Map((internships ?? []).map((row) => [row.id, row.title ?? 'Internship']))

  const header = [
    'application_id',
    'internship_id',
    'internship_title',
    'student_id',
    'created_at',
    'status',
    'resume_storage_path',
    'external_apply_required',
    'external_apply_completed_at',
  ]
  const rows = (applications ?? []).map((row) => [
    escapeCsv(row.id),
    escapeCsv(row.internship_id),
    escapeCsv(internshipById.get(row.internship_id) ?? 'Internship'),
    escapeCsv(row.student_id),
    escapeCsv(row.created_at),
    escapeCsv(row.status),
    escapeCsv(row.resume_url),
    escapeCsv(String(Boolean(row.external_apply_required))),
    escapeCsv(row.external_apply_completed_at),
  ])

  const csv = [header.map(escapeCsv).join(','), ...rows.map((row) => row.join(','))].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=\"internactive-preapplicants-${new Date().toISOString().slice(0, 10)}.csv\"`,
      'Cache-Control': 'no-store',
    },
  })
}
