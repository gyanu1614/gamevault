'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  MessageSquare,
  Star,
  Settings,
  Wallet,
  Heart,
  LogOut,
  Menu,
  X,
  Sparkles,
  Shield,
  ShieldCheck,
  Gift,
  FileText,
  Lock,
  ShieldAlert,
  Ban,
  ChevronDown,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
  showForBuyer?: boolean
  showForSeller?: boolean
  requiresSeller?: boolean
  /** V21/P7.ai — Nested sub-items (e.g. Offers → Currency/Items/...). */
  children?: { label: string; href: string }[]
}

interface AccountSidebarProps {
  user?: {
    id: string
    username: string
    email: string
    avatar_url?: string
    seller_tier?: string
    isApprovedSeller?: boolean
    shop_name?: string | null
    shop_slug?: string | null
    seller_status?: 'active' | 'restricted' | 'banned'
    joinedAt?: string
  }
}

export default function AccountSidebar({ user }: AccountSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  // V22 — Accordion: at most one grouped item (Offers / Orders) is open at a
  // time. `null` = none open. Clicking a parent navigates AND opens its group,
  // closing any other. Initialized lazily from the active route below.
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  // Get unread message count
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-messages-sidebar', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // First get all conversation IDs where I'm involved
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`) as any

      if (!conversations || conversations.length === 0) return 0

      const conversationIds = conversations.map((c: any) => c.id)

      // Count unread messages in those conversations where I'm not the sender
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false)

      return count || 0
    },
    enabled: !!user?.id,
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchOnWindowFocus: true,
  })

  const isActive = (href: string) => {
    // Exact match for /account to avoid matching /account/*
    if (href === '/account') {
      return pathname === '/account'
    }
    // For all other paths, check exact match or subdirectories
    return pathname === href || pathname.startsWith(href + '/')
  }

  // V22 — When the route lands on a grouped section (e.g. /account/listings),
  // open that group so its sub-items are visible. Keyed on pathname only, so
  // switching ?type= within the same group doesn't reset a user's choice.
  useEffect(() => {
    if (pathname.startsWith('/account/listings')) setOpenGroup('Offers')
    else if (pathname.startsWith('/account/orders')) setOpenGroup('Orders')
  }, [pathname])

  // Navigation split into seller tools and account tools (with divider between)
  const getSellerToolItems = (): NavItem[] => [
    { label: 'Dashboard',   href: '/account/dashboard',  icon: LayoutDashboard, requiresSeller: true, showForBuyer: false, showForSeller: true },
    { label: 'Orders',      href: '/account/orders',     icon: ShoppingCart,    requiresSeller: true, showForBuyer: false, showForSeller: true,
      children: [
        { label: 'Sold Orders', href: '/account/orders?type=sold' },
        { label: 'Purchases',   href: '/account/orders?type=purchases' },
      ] },
    { label: 'Offers',      href: '/account/listings',   icon: Package, requiresSeller: true, showForBuyer: false, showForSeller: true,
      children: [
        { label: 'Currency', href: '/account/listings?type=currency' },
        { label: 'Items',    href: '/account/listings?type=items' },
        { label: 'Accounts', href: '/account/listings?type=accounts' },
        { label: 'Top Ups',  href: '/account/listings?type=top-up' },
      ] },
    { label: 'Messages',    href: '/account/messages',   icon: MessageSquare, badge: unreadCount ? unreadCount.toString() : undefined, requiresSeller: true, showForBuyer: false, showForSeller: true },
    { label: 'Wallet',      href: '/account/wallet',     icon: Wallet,          requiresSeller: true, showForBuyer: false, showForSeller: true },
  ]

  const getAccountToolItems = (): NavItem[] => {
    if (user?.isApprovedSeller) {
      return [
        { label: 'Feedback',    href: '/account/reviews',  icon: Star,         showForBuyer: false, showForSeller: true },
        { label: 'Wishlist',    href: '/account/wishlist', icon: Heart,        showForBuyer: false, showForSeller: true },
        { label: 'Rewards',     href: '/account/loyalty',           icon: Sparkles,  showForBuyer: false, showForSeller: true },
        { label: 'Refer & Earn', href: '/account/referral',          icon: Gift,      showForBuyer: false, showForSeller: true },
        { label: 'INFORM Disclosure', href: '/account/inform-disclosure', icon: FileText, showForBuyer: false, showForSeller: true },
        { label: 'Privacy & Data',    href: '/account/privacy',           icon: Lock,     showForBuyer: false, showForSeller: true },
      ]
    }
    // Buyer-only items
    return [
      { label: 'Dashboard',    href: '/account/dashboard', icon: LayoutDashboard, showForBuyer: true, showForSeller: false },
      { label: 'My Purchases', href: '/account/orders',    icon: ShoppingCart, showForBuyer: true, showForSeller: false },
      { label: 'Messages',     href: '/account/messages',  icon: MessageSquare, badge: unreadCount ? unreadCount.toString() : undefined, showForBuyer: true, showForSeller: false },
      { label: 'Wishlist',     href: '/account/wishlist',  icon: Heart,        showForBuyer: true, showForSeller: false },
      { label: 'Wallet',       href: '/account/wallet',    icon: Wallet,       showForBuyer: true, showForSeller: false },
      { label: 'Rewards',      href: '/account/loyalty',   icon: Sparkles, showForBuyer: true, showForSeller: false },
      { label: 'Refer & Earn', href: '/account/referral',  icon: Gift,     showForBuyer: true, showForSeller: false },
      { label: 'Privacy & Data', href: '/account/privacy', icon: Lock,    showForBuyer: true, showForSeller: false },
    ]
  }

  const sellerItems  = user?.isApprovedSeller ? getSellerToolItems() : []
  const accountItems = getAccountToolItems()

  const bottomNavigation: NavItem[] = [
    {
      label: 'Settings',
      href: '/account/settings',
      icon: Settings,
      showForBuyer: true,
      showForSeller: true,
    },
  ]

  const NavItems = () => (
    <>
      {/* V22 — Clean floating identity: avatar + name, "Joined …" beneath.
          No bordered box / tier pill — just the user, modern and minimal.
          Sellers' block links to their public shop. */}
      <div className="p-3 border-b border-border-subtle">
        {(() => {
          const isSeller = !!user?.isApprovedSeller
          const displayName = isSeller
            ? (user?.shop_name || user?.username || 'Seller')
            : (user?.username || 'User')
          const joinedDate = user?.joinedAt
            ? new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : null

          const inner = (
            <>
              <div className="relative flex-shrink-0">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime/15 text-[15px] font-bold text-lime-text">
                    {displayName[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-bg-base" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold leading-tight text-text-primary">{displayName}</p>
                  {isSeller && (
                    /* Verified badge. Swap public/assets/badges/verified.png to
                       use your own (square image, transparent bg). */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src="/assets/badges/verified.png"
                      alt="Verified"
                      className="h-4 w-4 shrink-0 object-contain"
                    />
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
                  {joinedDate ? (
                    <>Joined <span className="font-semibold text-text-secondary">{joinedDate}</span></>
                  ) : (
                    isSeller ? 'Seller' : 'Buyer'
                  )}
                </p>
              </div>
            </>
          )

          return isSeller ? (
            <Link
              href={`/shop/${user?.shop_slug || user?.username || ''}`}
              onClick={() => setIsMobileOpen(false)}
              className="group flex w-full items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.04]"
            >
              {inner}
            </Link>
          ) : (
            <div className="flex w-full items-center gap-3 px-1 py-1">{inner}</div>
          )
        })()}

        {/* Restriction Status - Only for approved sellers who are restricted/banned */}
        {user?.isApprovedSeller && user?.seller_status && user.seller_status !== 'active' && (
          <Link
            href="/account/restrictions"
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "mt-3 flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 border",
              user.seller_status === 'restricted' && "bg-warning-bg border-yellow-500/20 text-warning hover:bg-yellow-500/15 hover:border-warning/40",
              user.seller_status === 'banned' && "bg-error-bg border-error/40 text-error hover:bg-red-500/15 hover:border-error/40"
            )}
          >
            {user.seller_status === 'restricted' && <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />}
            {user.seller_status === 'banned' && <Ban className="h-3.5 w-3.5 flex-shrink-0" />}
            <span className="flex-1">
              {user.seller_status === 'restricted' && "Selling Restricted"}
              {user.seller_status === 'banned' && "Account Banned"}
            </span>
          </Link>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="px-2 py-3 space-y-1 overflow-y-auto flex-1 min-h-0">
        {/* Seller tool items */}
        {sellerItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const activeType = searchParams.get('type')
          // V22 — Accordion: a grouped item's children show only when it's the
          // open group. Clicking a parent (below) sets it open + closes others.
          const showChildren = !!item.children && openGroup === item.label
          return (
            <div key={item.label}>
              {item.children ? (
                /* V79 — Grouped parents (Orders / Offers) are pure dropdown
                   toggles: clicking never navigates, it opens the group;
                   picking a sub-item is what navigates. */
                <button
                  type="button"
                  onClick={() => setOpenGroup((prev) => (prev === item.label ? null : item.label))}
                  aria-expanded={showChildren}
                  className={cn(
                    'w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-[14.5px] font-medium transition-all duration-200',
                    active
                      ? 'text-text-primary hover:bg-bg-raised-hover'
                      : 'text-text-secondary hover:text-white hover:bg-bg-raised-hover'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                      showChildren && 'rotate-180',
                      'text-text-tertiary',
                    )}
                  />
                </button>
              ) : (
              <Link
                href={item.href}
                onClick={() => {
                  setIsMobileOpen(false)
                  setOpenGroup(null)
                }}
                className={cn(
                  'flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-[14.5px] font-medium transition-all duration-200',
                  active
                    ? 'bg-[rgba(198,255,61,0.13)] text-lime-text'
                    : 'text-text-secondary hover:text-white hover:bg-bg-raised-hover'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={cn(
                    'px-2 py-0.5 text-[11px] font-bold rounded-full',
                    'bg-lime/20 text-lime-text'
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
              )}

              {/* V21/P7.ai/aj — Nested sub-items (Offers → Currency/…).
                  Animated open/close with framer-motion (height + opacity).
                  Active sub-item matched on the ?type= query param. */}
              <AnimatePresence initial={false}>
                {item.children && showChildren && (
                  <motion.div
                    key="subnav"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-6 flex flex-col gap-0.5">
                      {item.children.map((sub, subIdx) => {
                        const subType = sub.href.split('type=')[1] ?? null
                        // Default to the first child when no ?type= is set,
                        // so the group works for any section (Offers,
                        // Orders, …) without a hardcoded default. Only while
                        // actually on the section's page — the dropdown can
                        // now be opened from anywhere without navigating.
                        const onSection = pathname === sub.href.split('?')[0]
                        const firstType = item.children![0].href.split('type=')[1] ?? null
                        const subActive = onSection && (activeType ?? firstType) === subType
                        return (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                              'rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                              subActive
                                ? 'bg-[rgba(198,255,61,0.13)] text-lime-text'
                                : 'text-text-tertiary hover:bg-bg-raised-hover hover:text-text-secondary'
                            )}
                          >
                            {sub.label}
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

        {/* Divider between seller tools and account tools (sellers only) */}
        {user?.isApprovedSeller && (
          <div className="py-3 px-3">
            <div className="h-px bg-bg-raised-hover" />
          </div>
        )}

        {/* Account tool items */}
        {accountItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-[14.5px] font-medium transition-all duration-200',
                active
                  ? 'bg-[rgba(198,255,61,0.13)] text-lime-text'
                  : 'text-text-secondary hover:text-white hover:bg-bg-raised-hover'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={cn(
                  'px-2 py-0.5 text-[11px] font-bold rounded-full',
                  'bg-lime/20 text-lime-text'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>


      {/* Bottom Navigation */}
      <div className="p-2 border-t border-border-subtle space-y-1">
        {bottomNavigation.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[14.5px] font-medium transition-all duration-200',
                active
                  ? 'bg-[rgba(198,255,61,0.13)] text-lime-text'
                  : 'text-text-secondary hover:text-white hover:bg-bg-raised-hover'
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Logout */}
        <button
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[14.5px] font-medium text-text-secondary hover:text-error hover:bg-red-500/[0.08] transition-all duration-200"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
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
        className="fixed top-[4.5rem] left-3 z-50 lg:hidden p-2.5 rounded-lg bg-black/50 backdrop-blur-xl border border-border-subtle text-white shadow-lg hover:bg-black/70 transition-all"
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

      {/* Desktop Sidebar - Modern Floating Card */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:left-4 lg:top-24 lg:bottom-4 lg:w-64 card-frost border border-border-subtle rounded-lg shadow-2xl overflow-hidden">
        {/* V21/P7.aj — Call as a function, not <NavItems/>, so it inlines
            into this render tree. As a child component it got a fresh
            identity every parent re-render, remounting the subtree and
            killing AnimatePresence (collapse snapped instead of animating). */}
        {NavItems()}
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-4 bottom-4 left-4 w-64 card-frost border border-border-subtle rounded-lg z-40 lg:hidden flex flex-col shadow-2xl"
          >
            {NavItems()}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
