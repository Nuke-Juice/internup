'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
  match: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/admin', match: (pathname) => pathname === '/admin' },
  { label: 'Internships', href: '/admin/internships', match: (pathname) => pathname.startsWith('/admin/internships') },
  { label: 'New', href: '/admin/internships/new', match: (pathname) => pathname === '/admin/internships/new' },
  { label: 'Employers', href: '/admin/employers', match: (pathname) => pathname.startsWith('/admin/employers') },
  { label: 'Students', href: '/admin/students', match: (pathname) => pathname.startsWith('/admin/students') },
  { label: 'Match preview', href: '/admin/matching/preview', match: (pathname) => pathname.startsWith('/admin/matching/preview') },
  { label: 'Match report', href: '/admin/matching/report', match: (pathname) => pathname.startsWith('/admin/matching/report') },
]

function linkClass(active: boolean) {
  return `inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
    active
      ? 'border-blue-300 bg-blue-50 text-blue-700'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`
}

export default function AdminSectionNav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-6 py-2.5">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.match(pathname))}>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
