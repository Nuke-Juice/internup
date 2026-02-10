import { redirect } from 'next/navigation'
import { isAdminRole, isUserRole } from '@/lib/auth/roles'
import { supabaseServer } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await supabaseServer()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/login')

  const { data: userRow, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (roleError || !userRow) redirect('/account')

  const role = isUserRole(userRow.role) ? userRow.role : null
  if (isAdminRole(role)) redirect('/admin')
  if (role === 'student') redirect('/')
  if (role === 'employer') redirect('/dashboard/employer')

  redirect('/account')
}
