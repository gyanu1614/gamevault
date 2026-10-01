'use client'

/**
 * Admin chrome: the client shell around every admin page.
 *
 * The (server) layout keeps the auth/MFA checks and renders this shell,
 * which owns two pieces of state:
 *   - `collapsed` (desktop): sidebar card 232px ↔ 64px icon rail; the content
 *     column's left padding tracks it (CSS transition). Persisted.
 *   - `mobileOpen` (<lg): the nav drawer, opened from the header's menu
 *     button and closed on navigation.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Restore the saved preference after mount (SSR renders expanded;
  // flipping in an effect avoids a hydration mismatch).
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
    } catch {
      /* storage blocked: stay expanded */
    }
  }, [])

  // A route change closes the phone drawer.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? '0' : '1')
      } catch {
        /* storage blocked: keep it for this visit only */
      }
      return !v
    })

  return (
    <>
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      {/* Content column: clears the floating sidebar card (12px inset + card + 12px gap). */}
      <div
        className={cn(
          'flex min-h-[100dvh] min-w-0 flex-col transition-[padding-left] duration-300 ease-out',
          collapsed ? 'lg:pl-[88px]' : 'lg:pl-[256px]',
        )}
      >
        <EnhancedAdminHeader role={role} user={user} profile={profile} onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-5">
          <div className="mx-auto w-full min-w-0 max-w-[1440px]">{children}</div>
        </main>
      </div>
    </>
  )
}
