import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const EFFECTIVE_DATE = 'February 10, 2026'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-600">Effective date: {EFFECTIVE_DATE}</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            These Terms govern your access to and use of Internactive. By using the platform, you agree to these Terms.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Use of Service</h2>
          <p>
            You agree to provide accurate information, keep your credentials secure, and use the service in compliance
            with applicable laws.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Accounts</h2>
          <p>
            You are responsible for activity under your account. We may suspend or terminate accounts that violate these
            Terms or create security risk.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Content and Conduct</h2>
          <p>
            You retain ownership of content you submit. You grant Internactive a limited license to host and display
            submitted content solely to provide platform functionality.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Disclaimers</h2>
          <p>
            The service is provided on an &quot;as is&quot; basis without warranties of any kind to the extent permitted by law.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Internactive is not liable for indirect, incidental, special, or
            consequential damages arising from use of the service.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use after updates means you accept the revised Terms.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about these Terms can be sent to{' '}
            <a className="text-blue-700 hover:underline" href="mailto:support@internactive.com">
              support@internactive.com
            </a>
            .
          </p>
        </section>

      </div>
    </main>
  )
}
