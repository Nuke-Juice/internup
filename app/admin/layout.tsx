import type { ReactNode } from 'react'
import AdminSectionNav from '@/components/admin/AdminSectionNav'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminSectionNav />
      {children}
    </>
  )
}
