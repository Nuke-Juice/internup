import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const EFFECTIVE_DATE = 'February 10, 2026'

export default function PrivacyPage() {
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
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">Effective date: {EFFECTIVE_DATE}</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            Internactive (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects limited account and profile information to operate the
            platform, including internship discovery, applications, and employer workflows.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Information We Collect</h2>
          <p>
            We may collect your name, email, role (student/employer), profile details you provide, and usage data needed
            to improve product functionality and security.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">How We Use Information</h2>
          <p>
            We use data to authenticate users, personalize experience, process applications, communicate important
            account updates, and maintain service integrity.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Sharing</h2>
          <p>
            We do not sell personal data. We may share data with service providers (for example, infrastructure,
            authentication, analytics, and payments) strictly to run the service.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Data Retention</h2>
          <p>
            We retain data while your account is active or as needed for legitimate business, legal, and security
            purposes.
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Your Choices</h2>
          <p>
            You can update profile details in your account settings. To request account or data deletion, contact us at{' '}
            <a className="text-blue-700 hover:underline" href="mailto:support@internactive.com">
              support@internactive.com
            </a>
            .
          </p>

          <h2 className="pt-2 text-base font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about this policy can be sent to{' '}
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
