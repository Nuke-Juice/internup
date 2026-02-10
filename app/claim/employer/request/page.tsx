import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function RequestEmployerClaimLinkPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/login"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Request a new claim link</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your previous link may be expired, used, or tied to a different email.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Contact your concierge/admin and ask them to resend an employer claim link to your contact email.
        </p>
      </section>
    </main>
  )
}
