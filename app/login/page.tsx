import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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

    if (userRow?.role === 'student') redirect('/')
    if (userRow?.role === 'employer') redirect('/dashboard/employer')

    redirect('/')
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-2 text-slate-600">Use the email and password you created at signup.</p>

        <div className="mt-6 border-t border-slate-200 pt-6">
        <form action={signIn} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6 shadow-md">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              name="email"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="you@email.com"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="********"
              required
            />
          </div>

          {searchParams?.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {decodeURIComponent(searchParams.error)}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            Log in
          </button>

          <p className="text-xs text-slate-500">
            Do not have an account?{' '}
            <Link className="text-blue-700 hover:underline" href="/signup/student">
              Student signup
            </Link>{' '}
            or{' '}
            <Link className="text-blue-700 hover:underline" href="/signup/employer">
              Employer signup
            </Link>
            .
          </p>
        </form>
        </div>
      </div>
    </main>
  )
}
