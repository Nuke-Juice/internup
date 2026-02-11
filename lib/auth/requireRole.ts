import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { type UserRole } from '@/lib/auth/roles'
import { normalizeNextPath } from '@/lib/auth/nextPath'

export async function requireRole<T extends UserRole>(
  role: T,
  options?: { requestedPath?: string | null }
) {
  const supabase = await supabaseServer()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    const nextPath = normalizeNextPath(options?.requestedPath ?? null)
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login')
  }

  const { data: userRow, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (roleError || !userRow || userRow.role !== role) redirect('/unauthorized')

  return { user: data.user, role: userRow.role as T }
}
