import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import EmployerDashboardPage from '@/app/dashboard/employer/page'

type SearchParams = Promise<{ edit?: string; concierge?: string; draft?: string }>

export default async function EmployerNewInternshipPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const editingInternshipId = String(resolvedSearchParams?.edit ?? '').trim()
  const draftId = String(resolvedSearchParams?.draft ?? '').trim()

  if (!editingInternshipId && !draftId) {
    redirect(`/dashboard/employer/new?draft=${encodeURIComponent(randomUUID())}`)
  }

  return await EmployerDashboardPage({
    searchParams: Promise.resolve({
      create: '1',
      edit: resolvedSearchParams?.edit,
      concierge: resolvedSearchParams?.concierge,
      draft: resolvedSearchParams?.draft,
    }),
    createOnly: true,
  })
}
