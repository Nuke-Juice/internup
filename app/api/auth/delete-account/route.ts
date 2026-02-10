import { NextResponse } from 'next/server'
import { deleteUserAccountById } from '@/lib/auth/accountDeletion'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ ok: false, error: 'Server missing admin credentials.' }, { status: 500 })
  }

  const admin = supabaseAdmin()
  const result = await deleteUserAccountById(admin, user.id)

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
