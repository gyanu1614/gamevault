'use client'

/**
 * V55 — Admin chrome: client shell owning the sidebar-collapse state.
 *
 * The (server) layout keeps auth/MFA checks and renders this shell,
 * which coordinates the three pieces that must move together when the
 * sidebar collapses to an icon rail:
 *   - Sidebar width  (14.3rem ↔ 4.5rem)
 *   - Header left    (fixed element — margins don't affect it)
 *   - Content margin
 * The frame animates via CSS transitions (breakpoint-safe); the
 * sidebar's labels/logo slide-fade with framer-motion inside Sidebar.
 * Preference persists in localStorage.
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import EnhancedAdminHeader from './EnhancedAdminHeader'

const STORAGE_KEY = 'gv-admin-sidebar-collapsed'

export interface AdminProfile {
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export default function AdminChrome({
  role,
  user,
  profile,
  children,
}: {
  role: string
  user: { id: string; email?: string }
  profile: AdminProfile | null
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  // Restore the saved preference after mount (SSR renders expanded;
  // flipping in an effect avoids a hydration mismatch).
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
  }, [])

  const toggle = () =>
    setCollapsed((v) => {
      localStorage.setItem(STORAGE_KEY, v ? '0' : '1')
      return !v
    })

  return (
    <>
      <Sidebar role={role} user={user} collapsed={collapsed} onToggle={toggle} />

      {/* Main column — margin tracks the rail width. */}
      <div
        className={cn(
          'relative flex min-h-screen flex-col transition-[margin-left] duration-300 ease-out',
          collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-[14.3rem]',
        )}
      >
        <EnhancedAdminHeader role={role} user={user} profile={profile} collapsed={collapsed} />
        <main className="mt-20 flex-1 p-4 lg:p-8">
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </>
  )
}
