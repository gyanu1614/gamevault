'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Store,
  Award,
  Crown,
  Gem,
  Sparkles,
  Shield,
  ShieldCheck,
  Gift,
  FileText,
  Lock,
  ShieldAlert,
  Ban,
} from 'lucide-react'

// ── Tier visual config ────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  unverified: { icon: Shield,      color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   border: 'border-zinc-500/20' },
  bronze:     { icon: Award,       color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  silver:     { icon: ShieldCheck, color: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
  gold:       { icon: Crown,       color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  platinum:   { icon: Gem,         color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  diamond:    { icon: Sparkles,    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
  showForBuyer?: boolean
  showForSeller?: boolean
  requiresSeller?: boolean
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
  }
}

export default function AccountSidebar({ user }: AccountSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

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

  // Navigation split into seller tools and account tools (with divider between)
  const getSellerToolItems = (): NavItem[] => [
    { label: 'Dashboard',   href: '/account/dashboard',  icon: LayoutDashboard, requiresSeller: true, showForBuyer: false, showForSeller: true },
    { label: 'Orders',      href: '/account/orders',     icon: ShoppingCart,    requiresSeller: true, showForBuyer: false, showForSeller: true },
    { label: 'Listings',    href: '/account/listings',   icon: Package, requiresSeller: true, showForBuyer: false, showForSeller: true },
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
      {/* User Profile */}
      <div className="p-4 border-b border-white/[0.08]">
        {user?.isApprovedSeller ? (
          <Link
            href={`/shop/${user?.shop_slug || user?.username || ''}`}
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 w-full rounded-2xl px-3 py-3.5 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent hover:from-violet-500/15 border border-violet-500/20 hover:border-violet-500/30 transition-all duration-200 group"
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-violet-500/30 group-hover:ring-violet-500/50 transition-all"
                />
              ) : (
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-base bg-gradient-to-br from-violet-500 to-purple-600 ring-2 ring-violet-500/30 group-hover:ring-violet-500/50 transition-all">
                  {user?.username?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-black shadow-lg" />
            </div>
            {/* Name + Tier */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.shop_name || user?.username || 'Seller'}
              </p>
              {(() => {
                const tier = (user?.seller_tier || 'unverified').toLowerCase()
                const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.unverified
                const TierIcon = cfg.icon
                return (
                  <div className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', cfg.color, cfg.bg, cfg.border)}>
                    <TierIcon className="h-2.5 w-2.5" />
                    {tier}
                  </div>
                )
              })()}
            </div>
            <Store className="h-4 w-4 text-violet-400 flex-shrink-0" />
          </Link>
        ) : (
          <div className="flex items-center gap-3 w-full rounded-2xl px-3 py-3.5 bg-white/[0.02] border border-white/[0.08]">
            <div className="relative flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user?.username}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-base bg-gradient-to-br from-blue-500 to-cyan-600">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-black shadow-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.username || 'User'}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">Buyer Account</p>
            </div>
          </div>
        )}

        {/* Restriction Status - Only for approved sellers who are restricted/banned */}
        {user?.isApprovedSeller && user?.seller_status && user.seller_status !== 'active' && (
          <Link
            href="/account/restrictions"
            onClick={() => setIsMobileOpen(false)}
            className={cn(
              "mt-3 flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 border",
              user.seller_status === 'restricted' && "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/15 hover:border-yellow-500/30",
              user.seller_status === 'banned' && "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15 hover:border-red-500/30"
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
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={cn(
                  'px-2 py-0.5 text-[11px] font-bold rounded-full',
                  active ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-400'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}

        {/* Divider between seller tools and account tools (sellers only) */}
        {user?.isApprovedSeller && (
          <div className="py-3 px-3">
            <div className="h-px bg-white/[0.08]" />
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
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={cn(
                  'px-2 py-0.5 text-[11px] font-bold rounded-full',
                  active ? 'bg-white/20 text-white' : 'bg-violet-500/20 text-violet-400'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>


      {/* Bottom Navigation */}
      <div className="p-2 border-t border-white/[0.08] space-y-1">
        {bottomNavigation.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Logout */}
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
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
        className="fixed top-[4.5rem] left-3 z-50 lg:hidden p-2.5 rounded-xl bg-black/50 backdrop-blur-xl border border-white/[0.08] text-white shadow-lg hover:bg-black/70 transition-all"
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
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:left-4 lg:top-24 lg:bottom-4 lg:w-64 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden">
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
            className="fixed top-4 bottom-4 left-4 w-56 bg-black/50 backdrop-blur-2xl border border-white/[0.08] rounded-3xl z-40 lg:hidden flex flex-col shadow-2xl"
          >
            <NavItems />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
