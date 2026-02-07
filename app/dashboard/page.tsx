import { redirect } from 'next/navigation'
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

  if (roleError || !userRow) redirect('/')

  if (userRow.role === 'student') redirect('/dashboard/student')
  if (userRow.role === 'employer') redirect('/dashboard/employer')

  redirect('/')
}
