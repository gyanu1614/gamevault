'use client'

import Link from 'next/link'
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
  diamond:    { icon: Sparkles,     color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
}

export function Navbar() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
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

      {/* Floating Navbar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed left-0 right-0 top-6 z-50 flex justify-center"
      >
        <div className="w-full max-w-[95vw] px-2 sm:max-w-[90vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
          <motion.div
            className={cn(
              'flex items-center justify-between gap-2 rounded-full border border-white/10 bg-black px-3 py-3 shadow-2xl backdrop-blur-xl sm:gap-3 sm:px-6',
              'transition-all duration-300'
            )}
          >
            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600">
                <span className="text-lg font-bold text-white">G</span>
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
                />
              ))}
            </div>

            <div className="hidden h-6 w-px bg-white/20 md:block" />

            {/* Right Side */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* Search - Desktop */}
              <div className="hidden lg:block">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-32 rounded-full border-white/10 bg-white/5 pl-10 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:bg-white/10 xl:w-48"
                  />
                </form>
              </div>

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
                                    className="block rounded-lg p-3 transition-colors hover:bg-white/5 bg-violet-500/10 border border-violet-500/20"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20">
                                          <Bell className="h-4 w-4 text-violet-400" />
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
                                        <div className="h-2 w-2 rounded-full bg-violet-500" />
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
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
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
                                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
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
                                    delivering: 'bg-violet-500/20 text-violet-400',
                                  }
                                  return (
                                    <Link
                                      key={order.id}
                                      href={`/account/orders/${order.id}`}
                                      onClick={() => setActivityOpen(false)}
                                      className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                                    >
                                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20">
                                        <Package className="h-4 w-4 text-violet-400" />
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
              {loading || isLoggingOut ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
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
                                  className="flex items-center gap-3 rounded-lg px-4 py-2 mb-2 text-sm transition-all font-semibold bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-400 hover:border-violet-500/50 hover:from-violet-500/25 hover:to-purple-500/25 shadow-lg shadow-violet-500/10"
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
}: {
  tab: { id: string; label: string; type: string }
  gameEntries: Array<{ game: any; categorySlug: string }>
  isActive: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
}) {
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
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-full pt-2 z-50"
          >
            <div className="min-w-[280px] w-[400px] max-w-[92vw] rounded-2xl border border-white/10 bg-black p-5 shadow-2xl backdrop-blur-xl">
              <h3 className="mb-3 text-xs font-semibold uppercase text-gray-400">
                {tab.label}
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {gameEntries.slice(0, 10).map(({ game, categorySlug }) => (
                  <Link
                    key={game.slug}
                    href={`/${game.slug}/${categorySlug}`}
                    className="group flex items-center gap-3 rounded-lg p-2.5 transition-all hover:bg-white/10"
                  >
                    {game.image_url && game.image_url !== '' ? (
                      <img
                        src={game.image_url}
                        alt={game.name}
                        className="h-8 w-8 rounded-md object-contain transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-bold text-gray-300 group-hover:bg-white/20">
                        {game.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-300 group-hover:text-white truncate">
                      {game.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
