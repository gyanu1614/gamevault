'use client'

/**
 * V55 — Admin sidebar.
 *
 * - Collapsible to an icon rail: the toggle sits beside the logo; the
 *   rail width is animated by AdminChrome (CSS), while labels and the
 *   wordmark slide-fade out with framer-motion.
 * - Nav trimmed to the working set: compliance pages (GDPR / INFORM
 *   Act) stay routable but no longer occupy the rail.
 * - DropMarket branding (DM mark + wordmark).
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  IconLayoutDashboard,
  IconFileText,
  IconBuildingStore,
  IconMessage2,
  IconChartBar,
  IconSettings,
  IconLogout,
  IconMenu2,
  IconX,
  IconShieldX,
  IconTool,
  IconClipboardCheck,
  IconDeviceGamepad2,
  IconShoppingCart,
  IconTicket,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  role: string
  user: {
    id: string
    email?: string
  }
  collapsed?: boolean
  onToggle?: () => void
}

// The working set. GDPR + INFORM Act intentionally removed from the
// rail (routes still exist at /admin/gdpr and /admin/inform).
const LINKS = [
  { label: 'Dashboard',           href: '/admin',                icon: IconLayoutDashboard, roles: ['admin', 'moderator', 'support', 'super_admin'] },
  { label: 'Orders',              href: '/admin/orders',         icon: IconShoppingCart,    roles: ['admin', 'support', 'super_admin'] },
  { label: 'Seller Applications', href: '/admin/sellers',        icon: IconFileText,        roles: ['admin', 'moderator', 'super_admin'] },
  { label: 'Active Sellers',      href: '/admin/active-sellers', icon: IconBuildingStore,   roles: ['admin', 'moderator', 'support', 'super_admin'] },
  { label: 'Disputes',            href: '/admin/disputes',       icon: IconMessage2,        roles: ['admin', 'support', 'super_admin'] },
  { label: 'Analytics',           href: '/admin/analytics',      icon: IconChartBar,        roles: ['admin', 'super_admin'] },
  { label: 'Fraud',               href: '/admin/fraud',          icon: IconShieldX,         roles: ['admin', 'super_admin'] },
  { label: 'Games',               href: '/admin/games',          icon: IconDeviceGamepad2,  roles: ['admin', 'super_admin'] },
  { label: 'Moderation',          href: '/admin/moderation',     icon: IconClipboardCheck,  roles: ['admin', 'moderator', 'super_admin'] },
  { label: 'Promo Codes',         href: '/admin/promos',         icon: IconTicket,          roles: ['admin', 'super_admin'] },
  { label: 'Utilities',           href: '/admin/utils',          icon: IconTool,            roles: ['admin', 'super_admin'] },
  { label: 'Settings',            href: '/admin/settings',       icon: IconSettings,        roles: ['super_admin'] },
]

/** Slide-fade for labels when the rail collapses/expands. */
const labelMotion = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.18 },
}

export function Sidebar({ role, user, collapsed = false, onToggle }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredLinks = LINKS.filter((link) => link.roles.includes(role))

  const isLinkActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(href))

  return (
    <>
      {/* Mobile menu toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-black/50 backdrop-blur-xl border border-white/[0.1]"
      >
        {isMobileMenuOpen ? (
          <IconX className="h-5 w-5 text-white" />
        ) : (
          <IconMenu2 className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Desktop sidebar — width animated via the collapsed class. */}
      <div
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40',
          'bg-black/40 backdrop-blur-xl border-r border-white/[0.06]',
          'transition-[width] duration-300 ease-out',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-[14.3rem]',
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo row + collapse toggle */}
          <div
            className={cn(
              'h-[3.85rem] flex items-center border-b border-white/[0.06] flex-shrink-0',
              collapsed ? 'justify-center px-0' : 'justify-between px-3',
            )}
          >
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div {...labelMotion} className="min-w-0">
                  <Link href="/admin" className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-lime flex items-center justify-center flex-shrink-0">
                      <span className="text-text-inverse text-sm font-bold">DM</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white whitespace-nowrap">
                        DropMarket
                      </span>
                      <span className="text-[11px] text-lime-text/80 font-medium">Admin</span>
                    </div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              whileTap={{ scale: 0.92 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {collapsed ? (
                <IconLayoutSidebarLeftExpand className="h-5 w-5" />
              ) : (
                <IconLayoutSidebarLeftCollapse className="h-5 w-5" />
              )}
            </motion.button>
          </div>

          {/* Navigation — bumped size (py-3, 14.5px labels, 22px icons). */}
          <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
            {filteredLinks.map((link) => {
              const Icon = link.icon
              const isActive = isLinkActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg py-3',
                    'text-[14.5px] font-medium transition-all duration-150',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-lime-tint-bg text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]',
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime rounded-r-full" />
                  )}
                  <Icon
                    className={cn(
                      'h-[22px] w-[22px] transition-colors flex-shrink-0',
                      isActive ? 'text-lime-text' : 'text-gray-500',
                    )}
                  />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span {...labelMotion} className="whitespace-nowrap">
                        {link.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="border-t border-white/[0.06] px-2 py-2.5 flex-shrink-0">
            <button
              onClick={handleLogout}
              title={collapsed ? 'Logout' : undefined}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-lg py-2.5',
                'text-[13px] font-medium transition-all duration-150',
                'text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20',
              )}
            >
              <IconLogout className="h-[18px] w-[18px] flex-shrink-0" />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span {...labelMotion} className="whitespace-nowrap">
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence mode="wait">
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-black/90 backdrop-blur-xl border-r border-white/[0.06]"
            >
              <div className="flex flex-col h-full">
                <div className="h-[3.85rem] flex items-center px-3 border-b border-white/[0.06]">
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5"
                  >
                    <div className="h-9 w-9 rounded-lg bg-lime flex items-center justify-center">
                      <span className="text-text-inverse text-sm font-bold">DM</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">DropMarket</span>
                      <span className="text-[11px] text-lime-text/80 font-medium">Admin</span>
                    </div>
                  </Link>
                </div>

                <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
                  {filteredLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = isLinkActive(link.href)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          'relative flex items-center gap-3 px-3 py-3 rounded-lg',
                          'text-[14.5px] font-medium transition-all duration-150',
                          isActive
                            ? 'bg-lime-tint-bg text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/[0.04]',
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime rounded-r-full" />
                        )}
                        <Icon
                          className={cn(
                            'h-[22px] w-[22px]',
                            isActive ? 'text-lime-text' : 'text-gray-500',
                          )}
                        />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </nav>

                <div className="border-t border-white/[0.06] px-3 py-2.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-150"
                  >
                    <IconLogout className="h-[18px] w-[18px]" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
