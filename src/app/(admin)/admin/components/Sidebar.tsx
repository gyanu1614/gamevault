'use client'

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
  IconShieldCheck,
  IconShieldX,
  IconIdBadge,
  IconLock,
  IconTool,
  IconClipboardCheck,
  IconDeviceGamepad2,
  IconShoppingCart,
  IconTicket
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  role: string
  user: {
    id: string
    email?: string
  }
}

export function Sidebar({ role, user }: SidebarProps) {
  // For display purposes, extract initials from email or use default
  const displayName = user.email?.split('@')[0] || 'Admin'
  const displayInitial = displayName[0]?.toUpperCase() || 'A'

  const admin = {
    role,
    full_name: displayName,
    username: displayName,
  }
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: IconLayoutDashboard,
      roles: ['admin', 'moderator', 'support', 'super_admin']
    },
    {
      label: 'Orders',
      href: '/admin/orders',
      icon: IconShoppingCart,
      roles: ['admin', 'support', 'super_admin']
    },
    {
      label: 'Seller Applications',
      href: '/admin/sellers',
      icon: IconFileText,
      roles: ['admin', 'moderator', 'super_admin']
    },
    {
      label: 'Active Sellers',
      href: '/admin/active-sellers',
      icon: IconBuildingStore,
      roles: ['admin', 'moderator', 'support', 'super_admin']
    },
    {
      label: 'Disputes',
      href: '/admin/disputes',
      icon: IconMessage2,
      roles: ['admin', 'support', 'super_admin']
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      icon: IconChartBar,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'Fraud',
      href: '/admin/fraud',
      icon: IconShieldX,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'INFORM Act',
      href: '/admin/inform',
      icon: IconIdBadge,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'GDPR',
      href: '/admin/gdpr',
      icon: IconLock,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'Games',
      href: '/admin/games',
      icon: IconDeviceGamepad2,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'Moderation',
      href: '/admin/moderation',
      icon: IconClipboardCheck,
      roles: ['admin', 'moderator', 'super_admin']
    },
    {
      label: 'Promo Codes',
      href: '/admin/promos',
      icon: IconTicket,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'Utilities',
      href: '/admin/utils',
      icon: IconTool,
      roles: ['admin', 'super_admin']
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: IconSettings,
      roles: ['super_admin']
    },
  ]

  const filteredLinks = links.filter(link =>
    link.roles.includes(admin.role)
  )

  return (
    <>
      {/* Mobile Menu Toggle */}
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

      {/* Desktop Sidebar - Always Visible */}
      <div
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 lg:w-[14.3rem]",
          "bg-black/40 backdrop-blur-xl border-r border-white/[0.06]"
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="h-[3.85rem] flex items-center px-3 border-b border-white/[0.06] flex-shrink-0">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
                <span className="text-white text-sm font-bold">GV</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">
                  GameVault
                </span>
                <span className="text-[11px] text-violet-400/80 font-medium">
                  Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {filteredLinks.map((link, idx) => {
              const Icon = link.icon
              const isActive = pathname === link.href ||
                              (link.href !== '/admin' && pathname.startsWith(link.href))

              return (
                <Link
                  key={idx}
                  href={link.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg",
                    "text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-violet-500/15 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-400 to-indigo-500 rounded-r-full" />
                  )}

                  <Icon className={cn(
                    "h-5 w-5 transition-colors flex-shrink-0",
                    isActive ? "text-violet-400" : "text-gray-500"
                  )} />
                  <span className="whitespace-nowrap">{link.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout Button */}
          <div className="border-t border-white/[0.06] px-3 py-2.5 flex-shrink-0">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg",
                "text-xs font-medium transition-all duration-150",
                "text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
              )}
            >
              <IconLogout className="h-4 w-4 transition-colors flex-shrink-0" />
              <span className="whitespace-nowrap">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence mode="wait">
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
              }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-black/90 backdrop-blur-xl border-r border-white/[0.06]"
            >
              <div className="flex flex-col h-full">
                {/* Logo */}
                <div className="h-[3.85rem] flex items-center px-3 border-b border-white/[0.06]">
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <span className="text-white text-sm font-bold">GV</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        GameVault
                      </span>
                      <span className="text-[11px] text-violet-400/80 font-medium">
                        Admin
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
                  {filteredLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href ||
                                    (link.href !== '/admin' && pathname.startsWith(link.href))

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-lg",
                          "text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-violet-500/15 text-white"
                            : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-violet-400 to-indigo-500 rounded-r-full" />
                        )}
                        <Icon className={cn(
                          "h-5 w-5",
                          isActive ? "text-violet-400" : "text-gray-500"
                        )} />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </nav>

                {/* Logout */}
                <div className="border-t border-white/[0.06] px-3 py-2.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-150"
                  >
                    <IconLogout className="h-4 w-4" />
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
