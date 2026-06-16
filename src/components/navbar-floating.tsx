'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, User, LogOut, Menu, X, ChevronDown, Settings, Store, Package, MessageSquare, PlusCircle, Heart, Wallet, Star, List, Bell, LayoutDashboard, Activity, Award, Crown, Gem, Sparkles, Shield, ShieldCheck } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'

// ── Tier visual config ────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  unverified: { icon: Shield,       color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   border: 'border-zinc-500/20' },
  bronze:     { icon: Award,        color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  silver:     { icon: ShieldCheck,  color: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
  gold:       { icon: Crown,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  platinum:   { icon: Gem,          color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  diamond:    { icon: Sparkles,     color: 'text-lime-text', bg: 'bg-lime/10', border: 'border-lime-tint-border' },
}

export function Navbar() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  // V14u — Force-close every navbar dropdown on route change. Catches
  // cases where the user navigates via the browser back button, a
  // programmatic redirect, or a link inside a sub-component that didn't
  // wire up its own onSelect handler.
  useEffect(() => {
    setActiveDropdown(null)
    setUserMenuOpen(false)
    setNotificationsOpen(false)
    setActivityOpen(false)
    setMobileMenuOpen(false)
  }, [pathname])
  const [activityTab, setActivityTab] = useState<'buying' | 'selling'>('buying')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false)
        return
      }

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data } = await supabase
        .from('admin_roles')
        .select('role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      setIsAdmin(!!data)
    }

    checkAdminStatus()
  }, [user?.id])

  // Get unread message count
  const { data: unreadData } = useQuery({
    queryKey: ['unread-messages', user?.id],
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
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time feel
  })

  const unreadCount = unreadData || 0

  // Get unread notification count
  const { data: notificationCount } = useQuery({
    queryKey: ['unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      return count || 0
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  // Get recent UNREAD notifications for dropdown
  const { data: notifications } = useQuery({
    queryKey: ['unread-notifications-list', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false) // Only unread notifications
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) return []
      return data || []
    },
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  const unreadNotificationCount = notificationCount || 0
  const recentNotifications = notifications || []

  // Fetch active orders for Activity dropdown
  const { data: activeOrdersData } = useQuery({
    queryKey: ['active-orders-navbar', user?.id],
    queryFn: async () => {
      if (!user?.id) return { buying: [], selling: [] }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const ACTIVE = ['pending', 'paid', 'processing', 'delivering']
      const [buyResult, sellResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, listing:listings!orders_listing_id_fkey(title)')
          .eq('buyer_id', user.id)
          .in('status', ACTIVE)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, listing:listings!orders_listing_id_fkey(title)')
          .eq('seller_id', user.id)
          .in('status', ACTIVE)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      return { buying: buyResult.data || [], selling: sellResult.data || [] }
    },
    enabled: !!user,
    refetchInterval: 30000,
  })
  const activeOrders = activeOrdersData || { buying: [], selling: [] }
  const totalActiveOrders = activeOrders.buying.length + activeOrders.selling.length

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user) return

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    await (supabase
      .from('notifications')
      .update as any)({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    // Refetch notifications
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-list', user.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications', user.id] })
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setUserMenuOpen(false)
        setNotificationsOpen(false)
        setActivityOpen(false)
        setActiveDropdown(null)
      }
    }

    // Add keyboard shortcut to force refresh data (Ctrl/Cmd + Shift + R)
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'r') {
        event.preventDefault()
        console.log('🔄 Force refreshing games data...')
        queryClient.invalidateQueries({ queryKey: ['games'] })
        queryClient.invalidateQueries({ queryKey: ['categories'] })
        queryClient.refetchQueries({ queryKey: ['games'] })
        queryClient.refetchQueries({ queryKey: ['categories'] })
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [queryClient])

  // Fetch all active categories with their games for nav dropdowns
  const { data: navCatsData } = useQuery({
    queryKey: ['nav-categories'],
    queryFn: async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('categories')
        .select('slug, metadata, game:games!categories_game_id_fkey(name, slug, emoji, image_url, sort_order)')
        .eq('is_active', true)
        .order('display_order')
      return data || []
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  })

  // Group categories by metadata type → map of type → [{game, categorySlug}]
  const gamesByType = useMemo(() => {
    const groups: Record<string, Array<{ game: any; categorySlug: string }>> = {}
    navCatsData?.forEach((cat: any) => {
      const type = cat.metadata?.type
      if (type && cat.game) {
        if (!groups[type]) groups[type] = []
        // Dedupe by game.slug
        if (!groups[type].find((g) => g.game.slug === cat.game.slug)) {
          groups[type].push({ game: cat.game, categorySlug: cat.slug })
        }
      }
    })
    // Sort each group by game.sort_order
    Object.values(groups).forEach((arr) => arr.sort((a, b) => (a.game.sort_order ?? 99) - (b.game.sort_order ?? 99)))
    return groups
  }, [navCatsData])

  // 5 fixed nav tabs with their DB type keys
  const NAV_TABS = [
    { id: 'currency', label: 'Currency', type: 'currency' },
    { id: 'accounts', label: 'Accounts', type: 'account' },
    { id: 'items',    label: 'Items',    type: 'items' },
    { id: 'top-up',  label: 'Top Up',   type: 'top_up' },
    { id: 'boosting', label: 'Boosting', type: 'service' },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/browse?search=${encodeURIComponent(searchQuery)}`
    }
  }

  return (
    <>
      {/* Top black bar to hide content scrolling above navbar */}
      <div className="fixed left-0 right-0 top-0 z-50 h-6 bg-black" />

      {/*
        Floating Navbar — R17: dropped the slide-in animation that ran on
        every page load. It made the navbar feel like it "loaded later" than
        the page body even though both painted at the same time. Now it's
        in its final position from frame 1.
      */}
      <motion.nav
        initial={false}
        className="fixed left-0 right-0 top-6 z-50 flex justify-center"
      >
        <div className="w-full max-w-[95vw] px-2 sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
          <motion.div
            // R17 — Dropped `transition-all duration-300`. The pill is
            // content-width; when the auth-dependent icons swap in, even a
            // 1px width delta gets animated as a visible 300ms stretch.
            // Nothing on this element actually needs an animated transition.
            className="flex items-center justify-between gap-2 rounded-full border border-white/10 bg-black px-3 py-3 shadow-2xl backdrop-blur-xl sm:gap-3 sm:px-6"
          >
            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime">
                <span className="text-lg font-bold text-text-inverse">G</span>
              </div>
              <span className="hidden font-bold text-white sm:inline-block">GameVault</span>
            </Link>

            <div className="hidden h-6 w-px bg-white/20 md:block" />

            {/* Categories - Desktop */}
            <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
              {NAV_TABS.map((tab) => (
                <CategoryDropdown
                  key={tab.id}
                  tab={tab}
                  gameEntries={gamesByType[tab.type] || []}
                  isActive={activeDropdown === tab.id}
                  onHoverStart={() => setActiveDropdown(tab.id)}
                  onHoverEnd={() => setActiveDropdown(null)}
                  // V14u — Force-close the dropdown when a game is picked
                  // so it doesn't linger on the destination page.
                  onSelect={() => setActiveDropdown(null)}
                />
              ))}
            </div>

            <div className="hidden h-6 w-px bg-white/20 md:block" />

            {/* Right Side */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* V15n — Global game autocomplete. Replaces the
                  single-keyword form input that just submitted to /browse.
                  Now: type a game name → live filtered dropdown of
                  matching games across every category. Enter or "View all
                  results" still goes to /browse for full marketplace
                  search. */}
              <div className="hidden lg:block">
                <GlobalSearch
                  navCatsData={navCatsData ?? []}
                  onSubmitFallback={(q) => {
                    window.location.href = `/browse?search=${encodeURIComponent(q)}`
                  }}
                />
              </div>

              {/* R17 — Skeleton placeholders for Notifications + Messages +
                  Activity while auth is resolving, so the navbar's width is
                  identical before and after the user data arrives. Guarded
                  on `!user` because `useAuth()` can set `user` from
                  localStorage cache before `loading` flips to false — without
                  the `!user` guard we'd briefly render BOTH the skeletons
                  AND the real icons side by side. */}
              {loading && !user && (
                <>
                  {/* h-9 w-9 to match the real bell/messages/activity
                      Buttons: `cn()` uses tailwind-merge, so the className
                      `h-9 w-9` overrides the default `h-10 w-10` from
                      `size="icon"`. Real buttons render 36×36. */}
                  <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
                  <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
                  <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
                </>
              )}

              {user && (
                <>
                  {/* Notifications Dropdown */}
                  <div className="relative" data-dropdown>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9 rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setNotificationsOpen(!notificationsOpen)
                        setActivityOpen(false)
                        setUserMenuOpen(false)
                      }}
                    >
                      <Bell className="h-5 w-5" />
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                      )}
                    </Button>

                    <AnimatePresence>
                      {notificationsOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 top-full mt-2 w-[400px] max-w-[90vw]"
                        >
                          <div className="rounded-2xl border border-white/10 bg-black p-4 shadow-2xl backdrop-blur-xl">
                            {/* Header */}
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-white">Notifications</h3>
                            </div>

                            {/* Notifications List */}
                            {recentNotifications.length === 0 ? (
                              <div className="py-12 text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                  <Bell className="h-6 w-6 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400">You're all caught up!</p>
                                <p className="mt-1 text-xs text-gray-500">No new notifications</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                {recentNotifications.map((notification: any) => (
                                  <Link
                                    key={notification.id}
                                    href={notification.link || '#'}
                                    onClick={() => {
                                      markAsRead(notification.id)
                                      setNotificationsOpen(false)
                                    }}
                                    className="block rounded-lg p-3 transition-colors hover:bg-white/5 bg-lime/10 border border-lime-tint-border"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime/20">
                                          <Bell className="h-4 w-4 text-lime-text" />
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                          {notification.title}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                                          {notification.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {new Date(notification.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                          })}
                                        </p>
                                      </div>
                                      <div className="flex-shrink-0">
                                        <div className="h-2 w-2 rounded-full bg-lime" />
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}

                            {/* View All Button */}
                            <Link
                              href="/notifications"
                              className="mt-2 block rounded-lg bg-white/5 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              View all notifications
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Messages */}
                  <Link href="/account/messages">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9 rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
                    >
                      <MessageSquare className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </Button>
                  </Link>

                  {/* Activity Dropdown */}
                  <div className="relative" data-dropdown>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9 rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setActivityOpen(!activityOpen)
                        setNotificationsOpen(false)
                        setUserMenuOpen(false)
                      }}
                    >
                      <Activity className="h-5 w-5" />
                      {totalActiveOrders > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-lime text-[10px] font-bold text-text-inverse">
                          {totalActiveOrders > 9 ? '9+' : totalActiveOrders}
                        </span>
                      )}
                    </Button>

                    <AnimatePresence>
                      {activityOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 top-full mt-2 w-[400px] max-w-[90vw]"
                        >
                          <div className="rounded-2xl border border-white/10 bg-black p-4 shadow-2xl backdrop-blur-xl">
                            {/* Header */}
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-white">Live Orders</h3>
                              <Link
                                href="/account/orders"
                                className="text-xs text-lime-text hover:text-lime-text transition-colors"
                                onClick={() => setActivityOpen(false)}
                              >
                                View all
                              </Link>
                            </div>

                            {/* Tabs */}
                            <div className="mb-3 flex rounded-lg bg-white/5 p-1">
                              {(['buying', 'selling'] as const).map((tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setActivityTab(tab)}
                                  className={cn(
                                    'flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors',
                                    activityTab === tab
                                      ? 'bg-white/10 text-white'
                                      : 'text-gray-400 hover:text-gray-300'
                                  )}
                                >
                                  {tab} ({tab === 'buying' ? activeOrders.buying.length : activeOrders.selling.length})
                                </button>
                              ))}
                            </div>

                            {/* Orders list */}
                            {(activityTab === 'buying' ? activeOrders.buying : activeOrders.selling).length === 0 ? (
                              <div className="py-12 text-center">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                  <Activity className="h-6 w-6 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400">No active orders</p>
                                <p className="mt-1 text-xs text-gray-500">Orders in progress will appear here</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                {(activityTab === 'buying' ? activeOrders.buying : activeOrders.selling).map((order: any) => {
                                  const statusColors: Record<string, string> = {
                                    pending: 'bg-yellow-500/20 text-yellow-400',
                                    paid: 'bg-blue-500/20 text-blue-400',
                                    processing: 'bg-blue-500/20 text-blue-400',
                                    delivering: 'bg-lime/20 text-lime-text',
                                  }
                                  return (
                                    <Link
                                      key={order.id}
                                      href={`/account/orders/${order.id}`}
                                      onClick={() => setActivityOpen(false)}
                                      className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                                    >
                                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lime/20">
                                        <Package className="h-4 w-4 text-lime-text" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">
                                          {(order.listing as any)?.title || 'Order'}
                                        </p>
                                        <div className="mt-1 flex items-center gap-2">
                                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', statusColors[order.status] || 'bg-white/10 text-gray-400')}>
                                            {order.status}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            ${Number(order.total_amount).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </Link>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* User/Auth */}
              {(loading && !user) || isLoggingOut ? (
                // R17 — match the real avatar button (h-10 w-10) so the
                // navbar doesn't grow when the user data resolves. `!user`
                // guard so a cached-then-fresh hydration doesn't flash the
                // skeleton over the real avatar.
                <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
              ) : user ? (
                <div className="relative" data-dropdown>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full hover:bg-white/10"
                    onClick={() => {
                      setUserMenuOpen(!userMenuOpen)
                      setNotificationsOpen(false)
                      setActivityOpen(false)
                    }}
                  >
                    <img
                      src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                      alt={user.profile?.username || 'User'}
                      className="h-9 w-9 rounded-full ring-2 ring-primary/50"
                    />
                  </Button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-[300px] max-w-[85vw]"
                      >
                        <div className="rounded-2xl border border-white/10 bg-black p-2 shadow-2xl backdrop-blur-xl">
                          {/* User Info card */}
                          <div className="border-b border-white/10 p-2 pb-2.5">
                            {user.isApprovedSeller ? (
                              // Outer container — shared bg/border
                              <div className="flex items-center gap-2.5 w-full rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-primary/25 transition-all overflow-hidden group/card">
                                {/* Left — shop link */}
                                <Link
                                  href={`/shop/${user.profile?.shop_slug || user.profile?.username || ''}`}
                                  onClick={() => setUserMenuOpen(false)}
                                  className="flex items-center gap-2.5 flex-1 min-w-0 px-3 py-2.5 hover:bg-white/[0.04] transition-colors group/link"
                                >
                                  <img
                                    src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                                    alt={user.profile?.username || 'User'}
                                    className="h-9 w-9 rounded-full flex-shrink-0 object-cover ring-2 ring-white/10 group-hover/link:ring-primary/40 transition-all"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-white text-sm truncate group-hover/link:text-primary/90 transition-colors leading-tight">
                                      {user.profile?.shop_name || user.profile?.username || 'Seller'}
                                    </div>
                                    {(() => {
                                      const tier = (user.profile?.seller_tier || 'unverified').toLowerCase()
                                      const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.unverified
                                      const TierIcon = cfg.icon
                                      return (
                                        <div className={cn('mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize', cfg.color, cfg.bg, cfg.border)}>
                                          <TierIcon className="h-2.5 w-2.5" />
                                          {tier} Seller
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </Link>
                                {/* Divider */}
                                <div className="w-px h-8 bg-white/10 flex-shrink-0" />
                                {/* Right — Sell button */}
                                <Link
                                  href="/sell/new"
                                  onClick={() => setUserMenuOpen(false)}
                                  className="flex-shrink-0 flex items-center gap-1.5 pr-3 pl-2.5 py-2.5 text-sm font-semibold text-white hover:text-primary transition-colors whitespace-nowrap"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                  Sell
                                </Link>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 bg-white/[0.04] border border-white/[0.06]">
                                <img
                                  src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                                  alt={user.profile?.username || 'User'}
                                  className="h-9 w-9 rounded-full flex-shrink-0 object-cover ring-2 ring-white/10"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-white text-sm truncate leading-tight">
                                    {user.profile?.username || 'User'}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-gray-400">Buyer Account</div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Menu Items */}
                          <div className="py-2">

                            {/* Admin Panel - Admins Only */}
                            {isAdmin && (
                              <>
                                <Link
                                  href="/admin"
                                  className="mb-2 flex items-center gap-3 rounded-lg border border-lime-tint-border bg-lime-tint-bg px-4 py-2 text-sm font-semibold text-lime-text transition-colors hover:border-lime hover:bg-lime-tint-bg/80"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Shield className="h-4 w-4" />
                                  Admin Panel
                                </Link>
                                <div className="my-2 h-px bg-white/10" />
                              </>
                            )}

                            {/* Dashboard - For All Users */}
                            <Link
                              href="/account/dashboard"
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors font-medium mb-1",
                                user.isApprovedSeller
                                  ? "bg-white text-black hover:bg-white/90"
                                  : "text-gray-300 hover:bg-white/10 hover:text-white"
                              )}
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <LayoutDashboard className="h-4 w-4" />
                              Dashboard
                            </Link>

                            {/* My Listings - Sellers Only */}
                            {user.isApprovedSeller && (
                              <>
                                <Link
                                  href="/account/listings"
                                  className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <List className="h-4 w-4" />
                                  My Listings
                                </Link>

                                <div className="my-2 h-px bg-white/10" />
                              </>
                            )}

                            {/* Pending/Non-Seller Actions */}
                            {!user.isApprovedSeller && (
                              <>
                                {user.sellerApplicationStatus === 'pending' || user.sellerApplicationStatus === 'under_review' ? (
                                  <Link
                                    href="/account/seller-status"
                                    className="flex items-center gap-3 rounded-lg px-4 py-2 mb-1 text-sm text-yellow-400 transition-colors hover:bg-yellow-500/10 border border-yellow-500/20"
                                    onClick={() => setUserMenuOpen(false)}
                                  >
                                    <Store className="h-4 w-4" />
                                    Application Pending
                                  </Link>
                                ) : (
                                  <Link
                                    href="/account/become-seller"
                                    className="flex items-center gap-3 rounded-lg px-4 py-2 mb-1 text-sm text-primary transition-colors hover:bg-primary/10 border border-primary/20 font-medium"
                                    onClick={() => setUserMenuOpen(false)}
                                  >
                                    <Store className="h-4 w-4" />
                                    Become a Seller
                                  </Link>
                                )}
                              </>
                            )}

                            <div className="my-2 h-px bg-white/10" />

                            {/* Profile & Activity */}
                            {user.isApprovedSeller ? (
                              <Link
                                href={`/shop/${user.profile?.shop_slug || user.profile?.username || user.id}`}
                                className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                onClick={() => setUserMenuOpen(false)}
                              >
                                <Store className="h-4 w-4" />
                                My Shop
                              </Link>
                            ) : (
                              <Link
                                href="/account"
                                className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                onClick={() => setUserMenuOpen(false)}
                              >
                                <User className="h-4 w-4" />
                                My Account
                              </Link>
                            )}

                            {/* My Orders - Sellers Only */}
                            {user.isApprovedSeller && (
                              <Link
                                href="/account/orders"
                                className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                onClick={() => setUserMenuOpen(false)}
                              >
                                <Package className="h-4 w-4" />
                                My Orders
                              </Link>
                            )}

                            {/* My Feedback - Sellers Only */}
                            {user.isApprovedSeller && (
                              <Link
                                href="/account/reviews"
                                className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                                onClick={() => setUserMenuOpen(false)}
                              >
                                <Star className="h-4 w-4" />
                                My Feedback
                              </Link>
                            )}

                            <Link
                              href="/account/wishlist"
                              className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Heart className="h-4 w-4" />
                              Wishlist
                            </Link>

                            <Link
                              href="/account/wallet"
                              className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Wallet className="h-4 w-4" />
                              Wallet
                            </Link>

                            <div className="my-2 h-px bg-white/10" />

                            {/* Settings */}
                            <Link
                              href="/account/settings"
                              className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Settings className="h-4 w-4" />
                              Settings
                            </Link>
                          </div>

                          {/* Logout */}
                          <div className="border-t border-white/10 pt-2">
                            <button
                              onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()

                                try {
                                  // Set logging out state immediately to prevent UI flash
                                  setIsLoggingOut(true)
                                  setUserMenuOpen(false)

                                  // Sign out using client supabase
                                  const { createClient } = await import('@/lib/supabase/client')
                                  const supabase = createClient()
                                  const { error } = await supabase.auth.signOut()

                                  if (error) {
                                    console.error('Logout error:', error)
                                  }

                                  // Force reload to clear all state
                                  window.location.href = '/'
                                } catch (error) {
                                  console.error('Logout failed:', error)
                                  // Force reload anyway
                                  window.location.href = '/'
                                }
                              }}
                              className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                            >
                              <LogOut className="h-4 w-4" />
                              Log Out
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button
                      size="sm"
                      className="h-9 rounded-lg bg-white text-black hover:bg-white/90 font-medium"
                    >
                      Sign up
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-gray-300 hover:bg-white/10 hover:text-white md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed left-[2.5vw] right-[2.5vw] top-20 z-40 rounded-2xl border border-white/10 bg-black p-4 shadow-2xl backdrop-blur-xl sm:left-[5vw] sm:right-[5vw] sm:p-6 md:hidden"
          >
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search GameVault"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-full border-white/10 bg-white/5 pl-10 text-white placeholder:text-gray-500"
                />
              </div>
            </form>

            {/* Categories */}
            <div className="space-y-2">
              <h3 className="mb-3 text-xs font-semibold uppercase text-gray-400">Browse</h3>
              {NAV_TABS.map((tab) => {
                const entries = gamesByType[tab.type] || []
                return (
                  <div key={tab.id}>
                    <p className="px-4 pt-2 text-xs font-semibold text-gray-500 uppercase">
                      {tab.label}
                    </p>
                    {entries.slice(0, 4).map(({ game, categorySlug }) => (
                      <Link
                        key={game.slug}
                        href={`/${game.slug}/${categorySlug}`}
                        className="flex items-center gap-2.5 rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {game.image_url && game.image_url !== '' ? (
                          <img src={game.image_url} alt={game.name} className="h-5 w-5 rounded object-contain" />
                        ) : (
                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-white/10 text-[9px] font-bold text-gray-400">
                            {game.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {game.name}
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Mobile Auth Links */}
            {!loading && !user && (
              <div className="mt-6 space-y-2">
                <Link href="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full rounded-full border-white/20 text-white hover:bg-white/10">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full rounded-full bg-white text-black hover:bg-white/90">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="h-16 md:h-18 lg:h-20" />
    </>
  )
}

// Category Dropdown Component
function CategoryDropdown({
  tab,
  gameEntries,
  isActive,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: {
  tab: { id: string; label: string; type: string }
  gameEntries: Array<{ game: any; categorySlug: string }>
  isActive: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
  /** V14u — Called when the user picks a game so the dropdown can close. */
  onSelect: () => void
}) {
  // V15n — Split layout. Left = popular (top 5 by sort_order). Right =
  // searchable list of every game in this category. The search input is
  // autofocused when the menu opens; arrow keys scroll the list.
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  // V15o — Don't auto-focus the search input on open. Hover-opens
  // shouldn't steal focus from whatever the user was doing (typing in a
  // text field elsewhere on the page, scrolling, etc.). Users can click
  // the input or tab into it when they want to type.
  useEffect(() => {
    if (!isActive) setQ('')
  }, [isActive])

  const popular = useMemo(() => gameEntries.slice(0, 5), [gameEntries])
  const filtered = useMemo(() => {
    if (!q.trim()) return gameEntries
    const needle = q.trim().toLowerCase()
    return gameEntries.filter(
      ({ game }) =>
        game.name.toLowerCase().includes(needle) ||
        game.slug?.toLowerCase().includes(needle),
    )
  }, [gameEntries, q])

  return (
    <div
      className="relative"
      data-dropdown
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <button className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white whitespace-nowrap">
        {tab.label}
        <ChevronDown className={cn('h-3 w-3 transition-transform', isActive && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isActive && gameEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2"
          >
            <div className="w-[640px] max-w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
                {/* LEFT — Popular */}
                <div className="border-b border-white/10 bg-white/[0.02] p-3 md:border-b-0 md:border-r">
                  <div className="mb-2 px-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-lime-text">
                    Popular {tab.label}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {popular.map(({ game, categorySlug }) => (
                      <li key={game.slug}>
                        <Link
                          href={`/${game.slug}/${categorySlug}`}
                          onClick={onSelect}
                          className="group flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/[0.06]"
                        >
                          {game.image_url ? (
                            <img
                              src={game.image_url}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-md object-contain"
                            />
                          ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-gray-300">
                              {game.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate text-[13px] font-semibold text-gray-200 group-hover:text-white">
                            {game.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* RIGHT — Searchable */}
                <div className="flex max-h-[440px] flex-col p-3">
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={`Search ${tab.label.toLowerCase()}…`}
                      className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-[13px] text-white placeholder:text-gray-500 outline-none transition-colors focus:border-lime-tint-border focus:bg-white/[0.08]"
                    />
                  </div>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400">
                      All {tab.label}
                    </div>
                    <div className="text-[10.5px] tabular-nums text-gray-500">
                      {filtered.length} game{filtered.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="-mr-1 flex-1 overflow-y-auto pr-1">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Search className="mb-1.5 h-4 w-4 text-gray-600" />
                        <p className="text-[12px] text-gray-500">
                          No games match "{q}"
                        </p>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-2 gap-0.5">
                        {filtered.map(({ game, categorySlug }) => (
                          <li key={game.slug}>
                            <Link
                              href={`/${game.slug}/${categorySlug}`}
                              onClick={onSelect}
                              className="group flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-white/[0.06]"
                            >
                              {game.image_url ? (
                                <img
                                  src={game.image_url}
                                  alt=""
                                  className="h-7 w-7 shrink-0 rounded-md object-contain"
                                />
                              ) : (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-gray-300">
                                  {game.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate text-[12.5px] font-semibold text-gray-200 group-hover:text-white">
                                {game.name}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
   V15n — Global navbar search.

   Live autocomplete that searches across every game in every category
   from `navCatsData`. Click a game → goes to its first available
   category page. Press Enter (or the "View all results" link) → falls
   back to /browse?search=q.

   Focus styling: subtle white-overlay ring, NOT lime — the navbar's lime
   logo + active dropdown carry the brand accent, the search box should
   stay neutral so it doesn't fight them.
   ────────────────────────────────────────────────────────────────── */

interface NavGame {
  name: string
  slug: string
  emoji?: string | null
  image_url?: string | null
  sort_order?: number | null
}
interface NavCatRow {
  slug: string
  metadata: any
  game: NavGame | null
}

function GlobalSearch({
  navCatsData,
  onSubmitFallback,
}: {
  navCatsData: any[]
  onSubmitFallback: (q: string) => void
}) {
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Click-outside closes the panel.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Build a flat (game, primary categorySlug) index — first category
  // listed wins as the link target when the user clicks the game.
  const gameIndex = useMemo(() => {
    const map = new Map<
      string,
      { game: NavGame; primaryCategorySlug: string; categories: string[] }
    >()
    for (const row of navCatsData as NavCatRow[]) {
      const game = row.game
      if (!game?.slug) continue
      const existing = map.get(game.slug)
      if (existing) {
        existing.categories.push(row.slug)
      } else {
        map.set(game.slug, {
          game,
          primaryCategorySlug: row.slug,
          categories: [row.slug],
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.game.sort_order ?? 99) - (b.game.sort_order ?? 99),
    )
  }, [navCatsData])

  const trimmed = q.trim()
  const matches = useMemo(() => {
    if (!trimmed) return [] as typeof gameIndex
    const needle = trimmed.toLowerCase()
    return gameIndex
      .filter((g) =>
        g.game.name.toLowerCase().includes(needle) ||
        g.game.slug.toLowerCase().includes(needle),
      )
      .slice(0, 8)
  }, [gameIndex, trimmed])

  // Reset highlight when query changes.
  useEffect(() => {
    setHighlightIdx(matches.length > 0 ? 0 : -1)
  }, [trimmed, matches.length])

  const goToGame = (g: (typeof matches)[number]) => {
    setFocused(false)
    setQ('')
    window.location.href = `/${g.game.slug}/${g.primaryCategorySlug}`
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!focused) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(matches.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[highlightIdx]) goToGame(matches[highlightIdx])
      else if (trimmed) onSubmitFallback(trimmed)
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  const open = focused && (matches.length > 0 || trimmed.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="Search games…"
          aria-label="Search games"
          aria-autocomplete="list"
          aria-expanded={open}
          className={cn(
            'h-9 w-44 rounded-full border bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 outline-none transition-colors xl:w-56',
            // V15n — Subtle border-default + white-overlay focus, no lime
            // glow. The lime accent stays for active dropdowns / nav state.
            focused
              ? 'border-white/20 bg-white/[0.08]'
              : 'border-white/10 hover:border-white/20',
          )}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); setFocused(true) }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Result panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl backdrop-blur-xl"
          >
            <div className="max-h-[360px] overflow-y-auto">
              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                  <Search className="mb-2 h-5 w-5 text-gray-600" />
                  <p className="text-[13px] font-semibold text-gray-300">
                    No games match "{trimmed}"
                  </p>
                  <button
                    type="button"
                    onClick={() => onSubmitFallback(trimmed)}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-[12px] font-semibold text-gray-200 transition-colors hover:bg-white/10"
                  >
                    Search marketplace listings instead
                    <ArrowRightIcon />
                  </button>
                </div>
              ) : (
                <ul className="p-1.5">
                  {matches.map((m, i) => {
                    const highlighted = i === highlightIdx
                    return (
                      <li key={m.game.slug}>
                        <button
                          type="button"
                          onClick={() => goToGame(m)}
                          onMouseEnter={() => setHighlightIdx(i)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                            highlighted ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]',
                          )}
                        >
                          {m.game.image_url ? (
                            <img
                              src={m.game.image_url}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-md object-contain"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-gray-300">
                              {m.game.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-semibold text-white">
                              {m.game.name}
                            </div>
                            <div className="truncate text-[11px] text-gray-500">
                              {m.categories.length} categor
                              {m.categories.length === 1 ? 'y' : 'ies'}
                            </div>
                          </div>
                          <span className="text-gray-500">
                            <ArrowRightIcon />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {/* Footer: explicit "search all listings" link */}
            {trimmed && matches.length > 0 && (
              <div className="border-t border-white/10 bg-white/[0.02] p-1.5">
                <button
                  type="button"
                  onClick={() => onSubmitFallback(trimmed)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    View all results for "{trimmed}"
                  </span>
                  <ArrowRightIcon />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5.5 3.5L10 8l-4.5 4.5" />
    </svg>
  )
}
