import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeSkills } from '@/lib/skills/normalizeSkills'

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawSkills = body && typeof body === 'object' && 'skills' in body ? (body as { skills?: unknown }).skills : []
  const skills = Array.isArray(rawSkills) ? rawSkills.filter((item): item is string => typeof item === 'string') : []

  const normalized = await normalizeSkills(skills)
  return NextResponse.json(normalized)
}
