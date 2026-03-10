'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  MessageSquare,
  Star,
  BarChart3,
  Settings,
  ChevronDown,
  Wallet,
  Bell,
  FileText,
  User,
  LogOut,
  Menu,
  X
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/account/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Listings',
    href: '/account/listings',
    icon: Package,
    badge: '2',
  },
  {
    label: 'Orders',
    href: '/account/orders',
    icon: ShoppingCart,
  },
  {
    label: 'Messages',
    href: '/account/messages',
    icon: MessageSquare,
    badge: '3',
  },
  {
    label: 'Reviews',
    href: '/account/reviews',
    icon: Star,
  },
  {
    label: 'Analytics',
    href: '/account/analytics',
    icon: BarChart3,
  },
  {
    label: 'Earnings',
    href: '/account/earnings',
    icon: Wallet,
  },
]

const bottomNavigation: NavItem[] = [
  {
    label: 'Settings',
    href: '/account/settings',
    icon: Settings,
  },
]

interface SellerSidebarProps {
  user?: {
    username: string
    email: string
    avatar_url?: string
    seller_tier?: string
    shop_name?: string | null
  }
}

export default function SellerSidebar({ user }: SellerSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    )
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const tierColors: Record<string, string> = {
    bronze: 'text-orange-400',
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    platinum: 'text-cyan-400',
  }

  const NavItems = () => (
    <>
      {/* User Profile */}
      <div className="px-3 pt-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03]">
          <div className="relative flex-shrink-0">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              {user?.username?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.shop_name || user?.username || 'Seller'}
            </p>
            <p className={cn(
              'text-xs font-medium capitalize',
              tierColors[user?.seller_tier || 'bronze']
            )}>
              {user?.seller_tier || 'Bronze'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="px-3 py-3 space-y-0.5">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = expandedItems.includes(item.label)

          return (
            <div key={item.label}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpanded(item.label)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-semibold rounded-full',
                      active
                        ? 'bg-black/10 text-black'
                        : 'bg-violet-500/20 text-violet-400'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}

              {/* Children */}
              <AnimatePresence>
                {hasChildren && isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-7 mt-1 space-y-1 border-l border-white/[0.08] pl-3">
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon
                        const childActive = isActive(child.href)
                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                              childActive
                                ? 'bg-white/[0.08] text-white'
                                : 'text-gray-500 hover:text-white hover:bg-white/[0.05]'
                            )}
                          >
                            <ChildIcon className="h-3.5 w-3.5" />
                            <span>{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Navigation */}
      <div className="px-3 py-3 border-t border-white/[0.08] space-y-0.5">
        {bottomNavigation.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Logout */}
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/[0.05] transition-all"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-20 left-4 z-50 lg:hidden p-2.5 rounded-xl bg-gray-900/90 backdrop-blur-xl border border-white/[0.08] text-white shadow-lg hover:bg-gray-900 transition-all"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar - Static Floating Card */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:left-4 lg:top-28 lg:bottom-4 lg:w-56 bg-gray-900/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl">
        <NavItems />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-4 bottom-4 left-4 w-56 bg-gray-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl z-40 lg:hidden flex flex-col shadow-2xl"
          >
            <NavItems />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
