import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

function getErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) {
    return 'Invalid email or password.'
  }
  return message
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string }
}) {
  async function signIn(formData: FormData) {
    'use server'

    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '').trim()

    if (!email || !password) {
      redirect('/login?error=Email+and+password+are+required.')
    }

    const supabase = await supabaseServer()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const message = encodeURIComponent(getErrorMessage(error.message))
      redirect(`/login?error=${message}`)
    }

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) redirect('/login?error=Unable+to+load+session.')

    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (userRow?.role === 'student') redirect('/dashboard/student')
    if (userRow?.role === 'employer') redirect('/dashboard/employer')

    redirect('/')
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-md">
        <a href="/" className="text-sm font-medium text-blue-700 hover:underline">
          â† Back
        </a>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-2 text-slate-600">Use the email and password you created at signup.</p>

        <form action={signIn} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              name="email"
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              placeholder="you@email.com"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              required
            />
          </div>

          {searchParams?.error && (
            <p className="text-sm text-red-600">
              {decodeURIComponent(searchParams.error)}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Log in
          </button>

          <p className="text-xs text-slate-500">
            Donâ€™t have an account?{' '}
            <a className="text-blue-700 hover:underline" href="/signup/student">
              Student signup
            </a>{' '}
            or{' '}
            <a className="text-blue-700 hover:underline" href="/signup/employer">
              Employer signup
            </a>
            .
          </p>
        </form>
      </div>
    </main>
  )
}
