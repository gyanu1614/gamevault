'use client'

import Link from 'next/link'
import { SmartLink } from '@/components/global/SmartLink'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, User, LogOut, Menu, X, ChevronDown, ChevronLeft, ChevronRight, Settings, Store, Package, MessageSquare, MessagesSquare, PlusCircle, Heart, Wallet, Star, List, Bell, BellDot, LayoutDashboard, Activity, Gauge, Award, Crown, Gem, Sparkles, Shield, ShieldCheck, Coins, UserCircle2, Swords, Zap, Rocket, LifeBuoy ,
  ShoppingCart,
  LayoutGrid,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import BecomeSellerCta from '@/components/account/BecomeSellerCta'
import { cn } from '@/lib/utils'
import { isProtectedPath } from '@/lib/auth/protected-routes'
import { beginLogout } from '@/lib/auth/logout-signal'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { getWalletBalance } from '@/lib/actions/wallet'
import { searchAttributeOptions, type AttrOptionHit } from '@/lib/actions/search'
import { setStorePaused, getMyStorePaused } from '@/lib/actions/seller-presence'
import { toast } from 'sonner'

// 5 fixed nav tabs with their DB type keys
/* Hamburger root on /account/* — the sidebar's destinations, flat.
   sellerOnly rows hide for buyers; page-level tabs carry sub-views. */
const ACCOUNT_MENU_ITEMS = [
  { label: 'Dashboard', href: '/account/dashboard', Icon: LayoutDashboard, sellerOnly: false },
  { label: 'Orders', href: '/account/orders', Icon: ShoppingCart, sellerOnly: false },
  { label: 'Offers', href: '/account/listings', Icon: Package, sellerOnly: true },
  { label: 'Messages', href: '/account/messages', Icon: MessageSquare, sellerOnly: false },
  { label: 'Wallet', href: '/account/wallet', Icon: Wallet, sellerOnly: false },
  { label: 'Wishlist', href: '/account/wishlist', Icon: Heart, sellerOnly: false },
  { label: 'Rewards', href: '/account/loyalty', Icon: Sparkles, sellerOnly: false },
  { label: 'Settings', href: '/account/settings', Icon: Settings, sellerOnly: false },
] as const

const NAV_TABS = [
  { id: 'currency', label: 'Currency', type: 'currency' },
  { id: 'accounts', label: 'Accounts', type: 'account' },
  { id: 'items',    label: 'Items',    type: 'items' },
  { id: 'top-up',  label: 'Top Up',   type: 'top_up' },
  { id: 'boosting', label: 'Boosting', type: 'service' },
]

// App-shell — icon per nav tab for the attached mobile menu rows.
const NAV_TAB_ICONS: Record<string, React.ElementType> = {
  currency: Coins,
  accounts: UserCircle2,
  items: Swords,
  'top-up': Zap,
  boosting: Rocket,
}

// Mobile marketplace sheet — rows intentionally carry a short promise, not
// just a category label. This gives the full-screen menu the editorial rhythm
// of the reference sheet while keeping each destination one tap away.
const MOBILE_SERVICE_ITEMS = [
  { id: 'accounts', label: 'Accounts', description: 'Get game accounts instantly', icon: 'account-card', tabId: 'accounts' },
  { id: 'game-keys', label: 'Game Keys', description: 'Game deals for every platform', icon: 'key', href: '/browse' },
  { id: 'items', label: 'Items', description: 'Unlock in-game items fast', icon: 'package', tabId: 'items' },
  { id: 'currency', label: 'Currencies', description: 'Cheapest game currency deals', icon: 'coins', tabId: 'currency' },
  { id: 'top-up', label: 'Top Ups', description: 'Top-up in-game balance instantly', icon: 'topup', tabId: 'top-up' },
  { id: 'cs2-skins', label: 'CS2 Skins', description: 'Trade skins with verified sellers', icon: 'gamepad', href: '/cs2/buy-items' },
  { id: 'boosting', label: 'Boosting', description: 'Rank up fast with pro boosting', icon: 'rocket', tabId: 'boosting' },
  { id: 'gift-cards', label: 'Gift Cards', description: 'Codes for all games and platforms', icon: 'gift', href: '/topups' },
] as const

type MobileServiceItem = (typeof MOBILE_SERVICE_ITEMS)[number]

function MobileServiceRow({
  item,
  onSelect,
  onClose,
}: {
  item: MobileServiceItem
  onSelect: (tabId: string) => void
  onClose: () => void
}) {
  const content = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(40,45,58,0.78),rgba(24,27,36,0.82))] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_7px_16px_-12px_rgba(0,0,0,0.8)]">
        {/* The icon set is a transparent, shaded SVG family — no flat
            glyph tile and no opaque background behind the artwork. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/icons/set/${item.icon}.svg`} alt="" className="h-7 w-7 object-contain drop-shadow-[0_3px_6px_rgba(61,155,255,0.2)]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-white transition-colors group-hover:text-white">
          {item.label}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-white/55">
          {item.description}
        </span>
      </span>
      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-white/65 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
    </>
  )

  if ('tabId' in item) {
    return (
      <button
        type="button"
        onClick={() => onSelect(item.tabId)}
        className="group flex min-h-[68px] w-full items-center gap-3 border-b border-white/[0.06] py-2.5 text-left transition-colors hover:bg-white/[0.035] active:bg-white/[0.06]"
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="group flex min-h-[68px] w-full items-center gap-3 border-b border-white/[0.06] py-2.5 text-left transition-colors hover:bg-white/[0.035] active:bg-white/[0.06]"
    >
      {content}
    </Link>
  )
}

// ── Tier visual config ────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  unverified: { icon: Shield,       color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   border: 'border-zinc-500/20' },
  bronze:     { icon: Award,        color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  silver:     { icon: ShieldCheck,  color: 'text-slate-300',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
  gold:       { icon: Crown,        color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  platinum:   { icon: Gem,          color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  diamond:    { icon: Sparkles,     color: 'text-lime-text', bg: 'bg-lime/10', border: 'border-lime-tint-border' },
}

/**
 * V19/P15.b — `forceScrolled` pins the navbar in its full-width "bar"
 * mode regardless of scroll position. Used by /sell/* and any other
 * surface that wants the navbar to sit flush at top-0 from the start
 * (no floating pill at rest). The framer-motion morph still runs on
 * mount so the visual transition is identical to what scrolling
 * triggers.
 */
/** V62 — Live-order row (activity dropdown). Status pill uses token
 *  tints; 'delivering' gets the lime treatment. */
function LiveOrderRow({ order, onNavigate }: { order: any; onNavigate: () => void }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-warning-bg text-warning',
    paid: 'bg-info-bg text-info',
    processing: 'bg-info-bg text-info',
    delivering: 'bg-lime-tint-bg text-lime-text',
  }
  const statusText: Record<string, string> = {
    pending: 'Awaiting Payment',
    paid: 'Payment Confirmed',
    processing: 'Payment Confirmed',
  }
  return (
    <Link
      href={`/account/orders/${order.id}`}
      onClick={onNavigate}
      className="flex items-start gap-3 rounded-md border border-border-subtle bg-white/[0.03] p-3 transition-colors hover:border-border-default hover:bg-white/[0.06]"
    >
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-md border border-border-subtle bg-bg-overlay">
        {(order.listing as any)?.game?.slug ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getGameIcon((order.listing as any).game.slug)}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-4 w-4 text-lime-text" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text-primary">
          {(order.listing as any)?.title || 'Order'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize', statusColors[order.status] || 'bg-white/10 text-text-secondary')}>
            {statusText[order.status] ?? order.status}
          </span>
          <span className="text-xs tabular-nums text-text-tertiary">
            ${Number(order.total_amount).toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function Navbar({ forceScrolled = false }: { forceScrolled?: boolean } = {}) {
  const { user, loading } = useAuth()
  const authDialog = useAuthDialog()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // App-shell — which category sub-screen the attached mobile menu is
  // showing (null = root screen). Drives the two-pane translateX
  // carousel inside the panel (Eldorado pattern: tap a category → the
  // content slides left to the full game list, back arrow slides right).
  const [mobileMenuTab, setMobileMenuTab] = useState<string | null>(null)
  // On /account/* the menu roots in ACCOUNT navigation (per user
  // direction: 'sidebar mode' pages shouldn't open into marketplace
  // categories). menuRoot 'browse' is reachable via an in-menu row.
  const inAccountArea = pathname?.startsWith('/account') ?? false
  const accountSidebarAvailable = inAccountArea && !/^\/account\/orders\/[^/]+$/.test(pathname || '')
  const [menuRoot, setMenuRoot] = useState<'account' | 'browse'>('browse')
  useEffect(() => {
    if (mobileMenuOpen) setMenuRoot(inAccountArea && user ? 'account' : 'browse')
  }, [mobileMenuOpen, inAccountArea, user])

  // Homepage hero chips (and future surfaces) deep-open the menu at a
  // category sub-screen via this event — app-like, no route hop.
  useEffect(() => {
    const onOpenCategory = (e: Event) => {
      const tabId = (e as CustomEvent<string>).detail
      if (NAV_TABS.some((t) => t.id === tabId)) {
        setMobileMenuTab(tabId)
        setMobileMenuOpen(true)
      }
    }
    window.addEventListener('dm:open-category', onOpenCategory)
    return () => window.removeEventListener('dm:open-category', onOpenCategory)
  }, [])

  // Lock body scroll while the mobile menu is open — otherwise the page
  // scrolls behind the fixed panel and the user loses their place.
  useEffect(() => {
    if (!mobileMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileMenuOpen])
  // V21/P7.r — Expanding search. When true, the category links + right
  // icons collapse and GlobalSearch grows to fill the freed space.
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  // V17r — Debounced close. The cursor briefly leaves the trigger
  // when moving toward the dropdown content; a hard close on
  // mouseleave makes the dropdown vanish mid-traverse. Holding a
  // small 160ms grace window lets the user reach the dropdown.
  // openDropdown cancels any pending close; closeDropdown schedules
  // a deferred close that openDropdown can cancel.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // V17v — Ref to the category-tabs container, used as a shared
  // anchor for all four CategoryDropdown popovers. Centers each
  // mega-menu over the same midpoint of the navbar instead of
  // jumping under whichever tab was hovered.
  const navCategoriesRef = useRef<HTMLDivElement | null>(null)
  // V21/P7.y — The mega-menu anchors to the centered navbar pill (not the
  // left-of-center category cluster) so every dropdown opens centered to
  // the page rather than drifting left.
  const navBarRef = useRef<HTMLDivElement | null>(null)
  const openDropdown = (id: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setActiveDropdown(id)
  }
  const closeDropdown = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      setActiveDropdown(null)
      closeTimerRef.current = null
    }, 160)
  }
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  // The <sm attached sheets dim the page — lock its scroll too (the
  // desktop popovers at sm+ must NOT lock, hence the media check).
  useEffect(() => {
    const anyOpen = notificationsOpen || activityOpen || userMenuOpen
    if (!anyOpen) return
    if (!window.matchMedia('(max-width: 639px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [notificationsOpen, activityOpen, userMenuOpen])

  // V18.b — Scroll-snap navbar. At rest the navbar floats as a pill
  // centered in the page. Once the user scrolls past `SNAP_PX` the
  // pill morphs into a solid full-width bar pinned at top-0. Stripe
  // / Cron pattern — keeps the premium floating feel at the top of
  // the page and turns into honest product chrome once the user is
  // reading content (which is where content-bleeding-behind-pill
  // becomes a problem).
  const [scrolledNative, setScrolledNative] = useState(false)
  useEffect(() => {
    // 40px feels like the right threshold — far enough that casual
    // mouse-wheel jiggle doesn't trip it, close enough that any
    // intentional scroll commits the morph immediately.
    const SNAP_PX = 40
    const onScroll = () => setScrolledNative(window.scrollY > SNAP_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // V19/P15.b — `forceScrolled` short-circuits the scroll listener so
  // pages like /sell/* can lock the navbar in its full-width bar mode
  // even at scrollY=0. Everywhere else falls through to live scroll.
  const scrolled = forceScrolled || scrolledNative

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
    setMobileMenuTab(null)
  }, [pathname])
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  // V23 — When a protected-path logout redirects home, we hold the opaque
  // overlay until the home route has actually PAINTED (not a blind timer that
  // can fire before home mounts, popping content in). This flag arms the
  // navigation-settle effect below; once pathname becomes '/' we wait two
  // animation frames (home tree committed + painted) and lift the overlay.
  const [awaitingHomePaint, setAwaitingHomePaint] = useState(false)

  // V23 — Lift the logout overlay only once home has painted.
  // When a protected-path logout fires router.replace('/'), we keep the
  // opaque overlay up and arm `awaitingHomePaint`. This effect watches for
  // the route to settle on '/', then waits two rAFs (React commits the new
  // tree, then the browser paints it) before lifting — so the user never
  // sees a cold home mid-mount. The handler also sets a safety cap so the
  // overlay can't get stuck if navigation never settles.
  useEffect(() => {
    if (!awaitingHomePaint) return
    if (pathname !== '/') return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIsLoggingOut(false)
        setAwaitingHomePaint(false)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [awaitingHomePaint, pathname])

  const [isAdmin, setIsAdmin] = useState(false)
  // V21/P7.ae — Offline Mode (store pause). When on, the seller's offers
  // are taken down for buyers until toggled back. `pendingOffline` blocks
  // double-clicks while the server action is in flight.
  const [offlineMode, setOfflineMode] = useState(false)
  const [pendingOffline, setPendingOffline] = useState(false)

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

  // V21/P7.ae — Hydrate Offline Mode for approved sellers.
  useEffect(() => {
    if (!user?.isApprovedSeller) { setOfflineMode(false); return }
    let active = true
    getMyStorePaused().then((v) => { if (active) setOfflineMode(v) })
    return () => { active = false }
  }, [user?.id, user?.isApprovedSeller])

  // V21/P7.ae — Toggle store online/offline. Optimistic flip with
  // rollback on failure.
  const toggleOfflineMode = useCallback(async () => {
    if (pendingOffline) return
    const next = !offlineMode
    setOfflineMode(next)
    setPendingOffline(true)
    const res = await setStorePaused(next)
    setPendingOffline(false)
    if (!res.success) {
      setOfflineMode(!next) // rollback
      toast.error('Could not update store status')
      return
    }
    toast.success(next ? 'Store is now offline — your offers are hidden' : 'Store is back online')
  }, [offlineMode, pendingOffline])

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
        // Workstream E — chat messages live under the Messages badge, not the
        // bell. Exclude legacy 'new_message' rows so they stop polluting the
        // bell count.
        .neq('type', 'new_message')

      return count || 0
    },
    enabled: !!user,
    // Poll fallback only — the realtime subscription below flips the bell
    // instantly on INSERT, so the poll can relax to 60s.
    refetchInterval: 60000,
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
        .neq('type', 'new_message') // Workstream E — bell excludes chat rows
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) return []
      return data || []
    },
    enabled: !!user,
    refetchInterval: 60000, // Realtime-backed; poll is a slow fallback
  })

  // Workstream E — Realtime bell. Subscribe to INSERTs on the current user's
  // notifications so a new order (webhook's new_order insert) or a seller's
  // first order-message flips the bell WITHOUT waiting on the 60s poll. The
  // notifications table must be in the supabase_realtime publication
  // (20260715_notifications_realtime.sql) for these events to arrive; the
  // per-user SELECT RLS policy gates delivery to the owner.
  useEffect(() => {
    if (!user?.id) return
    const userId = user.id
    let cleanup: (() => void) | null = null
    let cancelled = false
    ;(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      if (cancelled) return
      const channel = supabase
        .channel(`notif:${userId}`)
        .on(
          'postgres_changes' as any,
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['unread-notifications', userId] })
            queryClient.invalidateQueries({ queryKey: ['unread-notifications-list', userId] })
          },
        )
        .subscribe()
      // Capture the same client instance for teardown.
      cleanup = () => { void supabase.removeChannel(channel) }
      if (cancelled) cleanup()
    })()
    return () => {
      cancelled = true
      if (cleanup) cleanup()
    }
  }, [user?.id, queryClient])

  const unreadNotificationCount = notificationCount || 0
  const recentNotifications = notifications || []

  // Fetch active orders for Activity dropdown
  const { data: activeOrdersData } = useQuery({
    queryKey: ['active-orders-navbar', user?.id],
    queryFn: async () => {
      if (!user?.id) return { buying: [], selling: [] }
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      // Workstream E — buyers still see their unpaid 'pending' (awaiting
      // payment) orders in Live Orders; sellers do NOT — a seller can't act on
      // an order until the payment is confirmed, so 'pending' is dropped from
      // the selling set.
      const ACTIVE_BUYING = ['pending', 'paid', 'processing', 'delivering']
      const ACTIVE_SELLING = ['paid', 'processing', 'delivering']
      const [buyResult, sellResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, listing:listings!orders_listing_id_fkey(title, game:games(slug))')
          .eq('buyer_id', user.id)
          .in('status', ACTIVE_BUYING)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, listing:listings!orders_listing_id_fkey(title, game:games(slug))')
          .eq('seller_id', user.id)
          .in('status', ACTIVE_SELLING)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      return { buying: buyResult.data || [], selling: sellResult.data || [] }
    },
    enabled: !!user,
    refetchInterval: 30000,
  })
  // V63 — Wallet balance for the profile-menu Wallet row (sellers).
  const { data: navWalletBalance } = useQuery({
    queryKey: ['wallet-balance-navbar', user?.id],
    queryFn: async () => {
      const result = await getWalletBalance()
      return result.success ? result.balance : null
    },
    enabled: !!user?.isApprovedSeller,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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

  // Close dropdowns when clicking outside.
  //
  // V17w — ROOT-CAUSE FIX. The category dropdown (activeDropdown) is
  // now driven by Radix Popover, which lives in a PORTAL outside the
  // navbar's DOM tree. The legacy `target.closest('[data-dropdown]')`
  // check fails for clicks inside the portalled Popover content, so
  // EVERY click inside the dropdown — including on a game tile —
  // would set activeDropdown=null, unmounting the popover before
  // the browser's click event could fire. Result: the link never
  // navigates.
  //
  // Removing the setActiveDropdown(null) from this legacy handler
  // hands dropdown-dismiss responsibility entirely to Radix +
  // SmartLink's onClick={onSelect}. The other legacy dropdowns
  // (user menu, notifications, activity) still use the old
  // pattern, so we keep those.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setUserMenuOpen(false)
        setNotificationsOpen(false)
        setActivityOpen(false)
        // Category mega-menu: restored (V17w removed it because the
        // PORTALLED popover content wasn't matched by [data-dropdown] and
        // inside-clicks closed the menu before links could navigate). The
        // content card now carries data-dropdown itself, so inside clicks
        // are exempt and this is the deterministic outside-TAP dismiss for
        // touch devices, where the mouseleave debounce never fires.
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
        .select('slug, name, metadata, game_id, game:games!categories_game_id_fkey(name, slug, emoji, image_url, sort_order)')
        .eq('is_active', true)
        .order('display_order')
      return data || []
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  })

  // V21/P7.u — Category icons (admin-uploaded currency_icon_url) live
  // on category_configs, keyed by (game_id, category_type). Pulled
  // here and passed to GlobalSearch so the dropdown can show e.g. the
  // Robux icon next to the Robux row.
  const { data: catConfigData } = useQuery({
    queryKey: ['nav-category-configs'],
    queryFn: async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('category_configs')
        .select('game_id, category_type, config')
      return data || []
    },
    staleTime: 1000 * 60 * 5,
  })

  // Group categories by metadata type → map of type → [{game, categorySlug}]
  const gamesByType = useMemo(() => {
    // V17g — Alias rewrite removed. The DB now stores canonical slugs
    // (buy-robux, buy-vbucks, …) directly, so cat.slug IS the final
    // URL slug. No client-side translation needed.
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

  // App-shell — per-game market count (how many active categories a game
  // has across all types). Shown as the muted sub-count on the mobile
  // menu's category sub-screen rows.
  const gameCatCounts = useMemo(() => {
    const m = new Map<string, number>()
    navCatsData?.forEach((cat: any) => {
      const slug = cat.game?.slug
      if (slug) m.set(slug, (m.get(slug) ?? 0) + 1)
    })
    return m
  }, [navCatsData])

  // V50 — Which nav tab owns the CURRENT page? Matched against the
  // same category data that powers the dropdowns: a page at
  // /{gameSlug}/{categorySlug} lights up the tab whose entries include
  // that exact game+category pair. Null on non-category pages.
  const currentNavTabId = useMemo(() => {
    if (!pathname) return null
    for (const tab of NAV_TABS) {
      const entries = gamesByType[tab.type] || []
      const hit = entries.some(
        ({ game, categorySlug }) =>
          pathname === `/${game.slug}/${categorySlug}` ||
          pathname.startsWith(`/${game.slug}/${categorySlug}/`),
      )
      if (hit) return tab.id
    }
    return null
  }, [pathname, gamesByType])

  return (
    <>
      {/* V21/P5.b + V23 — Full-screen loader during signOut. Sits above
          everything (z-[100]) so the dropdown closing doesn't unmount
          the loader. Pointer-events trap so users can't click underneath
          while signOut completes.
          V23 — OPAQUE, painted with the SAME surface as <body>
          (--color-bg-base + --gradient-page-scrim). Previously this was
          bg-bg-base/40 (40% translucent) — during a logout from a
          protected page the account layout returns null and home hasn't
          painted yet, so the bare #0A0A0F body showed THROUGH the 40%
          scrim as a black flash. An opaque, body-matched fill masks that
          gap completely: lifting onto either still-unpainted body or
          painted home is a pixel-identical surface, so there's no swap.
          backdrop-blur dropped — it's inert once the fill is opaque. */}
      {isLoggingOut && (
        <div
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{
            backgroundColor: 'var(--color-bg-base)',
            backgroundImage: 'var(--gradient-page-scrim)',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'top center',
            backgroundSize: '100% 100%',
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-bg-raised/80 ring-1 ring-white/10">
              <span
                aria-hidden
                className="h-7 w-7 animate-spin rounded-full border-2 border-white/[0.08] border-t-lime"
              />
            </span>
            <p className="text-[13px] font-semibold text-text-primary">Signing You Out…</p>
          </div>
        </div>
      )}

      {/* V21/P7.w — Spotlight scrim behind the expanded search. Blurs +
          dims the page so the search panel reads as a focused overlay
          instead of floating over a busy hero. Sits below the navbar
          (z-50) but above page content (z-40). Clicking it collapses
          search via the panel's own click-outside handler, but we also
          close on direct click for snappiness. */}
      <AnimatePresence>
        {searchExpanded && (
          <div
            key="search-scrim"
            onMouseDown={() => setSearchExpanded(false)}
            className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-md"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* V18.b - Scroll-snap navbar driven by framer-motion springs.
          Tailwind class-swap was cranky because max-width and
          border-radius cannot interpolate from a length to the
          keyword none as a continuous CSS transition, so the browser
          stepped between them mid-morph. Framer animates numeric
          values and runs a single spring through every property in
          lockstep, which makes the whole bar morph feel like one
          motion instead of three properties glitching out of sync. */}
      {/* App-shell — MOBILE BAR (below lg): the floating pill collapses
          into a full-width, solid, forest-tinted bar pinned at top-0
          (no margins, no capsule radius). Framer writes the pill morph
          as inline styles, so the mobile overrides use `max-lg:!…`
          (!important) utilities to beat them; at lg+ none of these
          classes apply and the desktop pill/bar morph is untouched. */}
      <motion.nav
        initial={false}
        animate={{ top: scrolled ? 0 : 12 }}
        className="fixed left-0 right-0 z-50 flex justify-center max-lg:!top-0"
      >
        <motion.div
          initial={false}
          animate={{
            maxWidth: scrolled ? 1920 : 1400,
            paddingLeft: scrolled ? 0 : 16,
            paddingRight: scrolled ? 0 : 16,
          }}
          className="w-full max-lg:!max-w-none max-lg:!px-0"
        >
          <motion.div
            ref={navBarRef}
            initial={false}
            animate={{
              borderRadius: scrolled ? 0 : 9999,
              borderBottomWidth: scrolled ? 1 : 1,
              borderLeftWidth: scrolled ? 0 : 1,
              borderRightWidth: scrolled ? 0 : 1,
              borderTopWidth: scrolled ? 0 : 1,
            }}
            style={{
              borderColor: scrolled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.10)',
              // V22 — Navbar bar uses the same frosted grey as the sidebar
              // (`card-frost`). Slightly higher alpha than the cards (0.66/0.56)
              // so the bar stays readable over bright hero areas. Dropdowns are
              // intentionally left on their own darker surfaces.
              backgroundColor: scrolled
                ? 'rgba(20, 20, 27, 0.66)'
                : 'rgba(20, 20, 27, 0.56)',
            }}
            className={cn(
              'flex items-center justify-between gap-2 px-3 py-3 backdrop-blur-2xl backdrop-saturate-150 sm:gap-3 sm:px-6',
              // App-shell mobile bar: 60px tall, square, edge-to-edge,
              // forest-tinted near-opaque surface + lime-warmed bottom
              // hairline. !important beats framer's inline pill styles.
              'max-lg:h-[60px] max-lg:!py-0 max-lg:!rounded-none max-lg:!border-x-0 max-lg:!border-t-0',
              'max-lg:!border-b max-lg:!border-b-[rgba(163,230,53,0.10)] max-lg:!bg-[rgba(14,22,17,0.96)]',
              scrolled
                ? 'shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_8px_24px_-12px_rgba(0,0,0,0.7)]'
                : 'shadow-[0_4px_24px_-12px_rgba(0,0,0,0.5)]',
            )}
          >
            {/* App-shell — Mobile Menu Button now sits LEFT of the logo
                below lg ([hamburger][logo+wordmark]…). lg:hidden means the
                desktop DOM renders nothing here, exactly as before (the
                hamburger previously lived at the end of the right cluster,
                also lg:hidden). 44px touch target; visible through lg (not
                md) so 760-1023px tablets keep the in-menu search. */}
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full text-gray-300 transition-transform duration-[120ms] hover:bg-white/10 hover:text-white active:scale-[0.96] active:brightness-95 lg:hidden"
              onClick={() => {
                // Account pages use the full desktop-parity sidebar on mobile.
                // Marketplace pages keep the two-pane category menu.
                if (accountSidebarAvailable && user) {
                  window.dispatchEvent(new Event('dm:toggle-account-sidebar'))
                  setMobileMenuOpen(false)
                  setMobileMenuTab(null)
                  setNotificationsOpen(false)
                  setUserMenuOpen(false)
                  setActivityOpen(false)
                  return
                }
                // Always reopen on the root screen; close the other
                // attached sheets so only one panel hangs off the bar.
                setMobileMenuTab(null)
                setMobileMenuOpen(!mobileMenuOpen)
                setNotificationsOpen(false)
                setUserMenuOpen(false)
                setActivityOpen(false)
              }}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Logo — max-lg:mr-auto packs [hamburger][logo] to the left
                edge on phones (auto margin absorbs the free space that
                justify-between would otherwise split). At md-lg the
                flex-1 category strip absorbs all free space first, and at
                lg+ the class doesn't apply — desktop layout unchanged.
                Wordmark now shows at every width (was hidden < sm). */}
            <Link href="/" className="flex shrink-0 items-center gap-2 max-lg:mr-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark-lime.png"
                alt="DropMarket"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
              />
              <span className="inline-block font-bold text-white">DropMarket</span>
            </Link>

            {/* V21/P7.r — Divider hides while search is expanded. */}
            {!searchExpanded && (
              <div className="hidden h-6 w-px bg-white/20 md:block" />
            )}

            {/* Categories - Desktop. V17v — wrapper div holds a ref
                used as the shared Popover anchor so every dropdown
                opens centered under the category strip, not under the
                individual tab that was hovered. Centers the mega-menu
                Stripe/Linear-style.
                V21/P7.r — Collapses out when search is expanded. */}
            {!searchExpanded && (
              <div
                ref={navCategoriesRef}
                className="hidden flex-1 items-center justify-center gap-1 md:flex"
              >
                {NAV_TABS.map((tab) => (
                  <CategoryDropdown
                    key={tab.id}
                    tab={tab}
                    gameEntries={gamesByType[tab.type] || []}
                    isActive={activeDropdown === tab.id}
                    isCurrent={currentNavTabId === tab.id}
                    onHoverStart={() => openDropdown(tab.id)}
                    onHoverEnd={() => closeDropdown()}
                    onSelect={() => setActiveDropdown(null)}
                    anchorRef={navBarRef}
                  />
                ))}
              </div>
            )}

            {!searchExpanded && (
              <div className="hidden h-6 w-px bg-white/20 md:block" />
            )}

            {/* Right Side — grows to fill the row when search expands. */}
            <div
              className={cn(
                'flex items-center gap-1 sm:gap-2',
                searchExpanded ? 'flex-1' : 'shrink-0',
              )}
            >
              {/* V15n — Global game autocomplete. Replaces the
                  single-keyword form input that just submitted to /browse.
                  Now: type a game name → live filtered dropdown of
                  matching games across every category. Enter or "View all
                  results" still goes to /browse for full marketplace
                  search. */}
              {/* V21/P7.ab — mr pushes the collapsed search bar left, away
                  from the icon cluster, for a bit more breathing room. */}
              <div className={cn('hidden lg:block', searchExpanded ? 'flex-1' : 'mr-3 xl:mr-5')}>
                <GlobalSearch
                  navCatsData={navCatsData ?? []}
                  catConfigData={catConfigData ?? []}
                  expanded={searchExpanded}
                  onExpandedChange={setSearchExpanded}
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
              {/* V21/P7.t — Icons stay visible while search is expanded
                  (the input grows into the freed category space, not
                  the icon cluster). */}
              {loading && !user && (
                <>
                  {/* h-10 w-10 to match the real bell/messages/activity
                      Buttons (40×40) so the navbar width is identical
                      before and after auth resolves. */}
                  <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                  <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                  <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                </>
              )}

              {user && (
                <>
                  {/* Notifications Dropdown */}
                  <div className="relative" data-dropdown>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-10 w-10 rounded-full text-gray-100 hover:bg-white/15 hover:text-white"
                      onClick={() => {
                        setNotificationsOpen(!notificationsOpen)
                        setActivityOpen(false)
                        setUserMenuOpen(false)
                        setMobileMenuOpen(false)
                      }}
                    >
                      {unreadNotificationCount > 0 ? (
                        <BellDot className="h-[21px] w-[21px]" />
                      ) : (
                        <Bell className="h-[21px] w-[21px]" />
                      )}
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-text-inverse">
                          {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                      )}
                    </Button>

                    {/* V61 — CSS entry animation (framer stalls mid-fade
                        under heavy trees and strands the panel half-visible;
                        same fix as the admin header). */}
                    {notificationsOpen && (
                      /* App-shell (<sm): ATTACHED sheet — full-width flush
                         under the 60px bar, square top so the bar's hairline
                         reads as the seam, rounded bottom, page dimmed by the
                         scrim below. sm+ keeps the anchored desktop popover
                         unchanged. */
                      <>
                        <div
                          aria-hidden
                          onClick={() => setNotificationsOpen(false)}
                          className="animate-fade-in fixed inset-0 top-[60px] bg-black/60 sm:hidden"
                        />
                        <div className="fixed inset-x-0 top-[60px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-[27px] sm:w-[480px] sm:max-w-[92vw] animate-in fade-in-0 sm:zoom-in-95 slide-in-from-top-2 duration-200 max-sm:duration-[250ms]">
                          {/* V61 — Marketplace glass panel (was flat black):
                              near-opaque dark surface + top sheen, roomier
                              type and spacing. Capped to the dynamic viewport
                              so short phones scroll the list internally. */}
                          <div className="relative flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-lg border border-[#A3E635]/[0.12] bg-[linear-gradient(180deg,#14241A_0%,#0E1611_100%)] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] p-5 max-sm:rounded-none max-sm:rounded-b-2xl max-sm:border-x-0 max-sm:border-t-0 max-sm:max-h-[calc(100dvh-60px-var(--mobile-tab-bar-h,64px)-env(safe-area-inset-bottom)-16px)]">
                            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,rgba(163,230,53,0.06),transparent)]" />
                            {/* Header - hairline separator spans the full panel width */}
                            <div className="relative -mx-5 mb-4 flex shrink-0 items-center justify-between border-b border-border-subtle px-5 pb-3.5">
                              <h3 className="text-[16px] font-bold text-text-primary">Notifications</h3>
                              {unreadNotificationCount > 0 && (
                                <span className="inline-flex h-6 items-center rounded-md border border-lime-tint-border bg-lime-tint-bg px-2 text-[11.5px] font-bold text-lime-text">
                                  {unreadNotificationCount} unread
                                </span>
                              )}
                            </div>

                            {/* Notifications List */}
                            {recentNotifications.length === 0 ? (
                              <div className="relative py-14 text-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/characters/sleepy-pup.webp"
                                  alt=""
                                  aria-hidden
                                  className="mx-auto mb-3 h-28 w-auto select-none object-contain"
                                />
                                <p className="text-[14.5px] font-semibold text-text-primary">You&apos;re all caught up!</p>
                                <p className="mt-1 text-[12.5px] text-text-tertiary">No new notifications</p>
                              </div>
                            ) : (
                              <div className="relative min-h-0 max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                                {recentNotifications.map((notification: any) => (
                                  <Link
                                    key={notification.id}
                                    href={notification.link || '#'}
                                    onClick={() => {
                                      markAsRead(notification.id)
                                      setNotificationsOpen(false)
                                    }}
                                    className="block rounded-md border border-white/[0.06] bg-white/[0.03] p-3.5 transition-colors hover:border-[#A3E635]/[0.2] hover:bg-[#1B5E3A]/[0.12]"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0">
                                        <div className="grid h-9 w-9 place-items-center rounded-md border border-[#A3E635]/[0.14] bg-[#1B5E3A]/[0.16]">
                                          <Bell className="h-4 w-4 text-lime-text" />
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-text-primary">
                                          {notification.title}
                                        </p>
                                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-text-secondary">
                                          {notification.message}
                                        </p>
                                        <p className="mt-1.5 text-[11.5px] text-text-tertiary">
                                          {new Date(notification.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                          })}
                                        </p>
                                      </div>
                                      <div className="flex flex-shrink-0 flex-col items-end gap-2">
                                        <button
                                          type="button"
                                          aria-label="Dismiss notification"
                                          className="-my-1 -mr-1 grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/10 hover:text-text-primary"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            markAsRead(notification.id)
                                          }}
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                        <span aria-hidden className="mr-2 h-2 w-2 rounded-full bg-lime shadow-[0_0_8px_rgba(198,255,61,0.8)]" />
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}

                            {/* View All Button */}
                            <Link
                              href="/notifications"
                              className="relative mt-3 flex h-10 shrink-0 items-center justify-center rounded-md border border-border-default bg-bg-overlay text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-bg-overlay-2"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              View All Notifications
                            </Link>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Messages — desktop only; on phones the mobile bar keeps
                      just [bell][avatar] (messages live in the menu/tab bar). */}
                  <Link href="/account/messages" className="hidden lg:block">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-10 w-10 rounded-full text-gray-100 hover:bg-white/15 hover:text-white"
                    >
                      <MessagesSquare className="h-[21px] w-[21px]" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-text-inverse">
                          {unreadCount}
                        </span>
                      )}
                    </Button>
                  </Link>

                  {/* Activity Dropdown — desktop only (see Messages note). */}
                  <div className="relative max-lg:hidden" data-dropdown>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-10 w-10 rounded-full text-gray-100 hover:bg-white/15 hover:text-white"
                      onClick={() => {
                        setActivityOpen(!activityOpen)
                        setNotificationsOpen(false)
                        setUserMenuOpen(false)
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Package className="h-[21px] w-[21px]" />
                      {totalActiveOrders > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-text-inverse">
                          {totalActiveOrders > 9 ? '9+' : totalActiveOrders}
                        </span>
                      )}
                    </Button>

                    {activityOpen && (
                      /* App-shell (<sm): ATTACHED sheet (see Notifications
                         above); sm+ keeps the anchored desktop popover. */
                      <>
                        <div
                          aria-hidden
                          onClick={() => setActivityOpen(false)}
                          className="animate-fade-in fixed inset-0 top-[60px] bg-black/60 sm:hidden"
                        />
                        <div className="fixed inset-x-0 top-[60px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-[27px] sm:w-[480px] sm:max-w-[92vw] animate-in fade-in-0 sm:zoom-in-95 slide-in-from-top-2 duration-200 max-sm:duration-[250ms]">
                          {/* V61 — Same glass panel as Notifications. */}
                          <div className="relative flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-lg border border-[#A3E635]/[0.12] bg-[linear-gradient(180deg,#14241A_0%,#0E1611_100%)] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] p-5 max-sm:rounded-none max-sm:rounded-b-2xl max-sm:border-x-0 max-sm:border-t-0 max-sm:max-h-[calc(100dvh-60px-var(--mobile-tab-bar-h,64px)-env(safe-area-inset-bottom)-16px)]">
                            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,rgba(163,230,53,0.06),transparent)]" />
                            {/* Header - hairline separator spans the full panel width */}
                            <div className="relative -mx-5 mb-4 flex shrink-0 items-center justify-between border-b border-border-subtle px-5 pb-3.5">
                              <h3 className="text-[16px] font-bold text-text-primary">Live Orders</h3>
                              <Link
                                href="/account/orders"
                                className="text-[12.5px] font-semibold text-lime-text transition-opacity hover:opacity-80"
                                onClick={() => setActivityOpen(false)}
                              >
                                View All
                              </Link>
                            </div>

                            {/* V62 — No tabs: one view. Buying stacks above
                                Selling; a section renders only when it has
                                orders, so buyers see just Buying, sellers see
                                just Selling, and dual-role users see both. */}
                            {activeOrders.buying.length === 0 && activeOrders.selling.length === 0 ? (
                              <div className="relative py-14 text-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/characters/box-cat.webp"
                                  alt=""
                                  aria-hidden
                                  className="mx-auto mb-3 h-28 w-auto select-none object-contain"
                                />
                                <p className="text-[14.5px] font-semibold text-text-primary">No active orders</p>
                                <p className="mt-1 text-[12.5px] text-text-tertiary">Orders in progress will appear here</p>
                              </div>
                            ) : (
                              <div className="relative min-h-0 max-h-[440px] space-y-4 overflow-y-auto overscroll-contain pr-1">
                                {activeOrders.buying.length > 0 && (
                                  <div>
                                    <div className="mb-2 flex items-center gap-2">
                                      <span className="text-[14px] font-bold text-text-primary">Buying</span>
                                      <span className="text-[12.5px] font-semibold text-text-tertiary">({activeOrders.buying.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                      {activeOrders.buying.map((order: any) => (
                                        <LiveOrderRow key={order.id} order={order} onNavigate={() => setActivityOpen(false)} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {activeOrders.selling.length > 0 && (
                                  <div className={cn(activeOrders.buying.length > 0 && 'border-t border-border-subtle pt-4')}>
                                    <div className="mb-2 flex items-center gap-2">
                                      <span className="text-[14px] font-bold text-text-primary">Selling</span>
                                      <span className="text-[12.5px] font-semibold text-text-tertiary">({activeOrders.selling.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                      {activeOrders.selling.map((order: any) => (
                                        <LiveOrderRow key={order.id} order={order} onNavigate={() => setActivityOpen(false)} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* V21/P7.ac — Divider + spacing sets the avatar apart from
                  the icon cluster so it doesn't crowd the activity icon. */}
              {user && (
                <div className="ml-1 hidden h-6 w-px bg-white/15 lg:block" />
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
                      setMobileMenuOpen(false)
                    }}
                  >
                    <img
                      src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                      alt={user.profile?.username || 'User'}
                      className="h-9 w-9 rounded-full ring-2 ring-primary/50"
                    />
                  </Button>

                  {userMenuOpen && (
                    /* App-shell (<sm): ATTACHED sheet — full-width flush under
                       the 60px bar on the shared forest surface, page dimmed
                       behind. sm+ keeps the anchored desktop popover
                       unchanged. */
                    <>
                      <div
                        aria-hidden
                        onClick={() => setUserMenuOpen(false)}
                        className="animate-fade-in fixed inset-0 top-[60px] bg-black/60 sm:hidden"
                      />
                      <div className="fixed inset-x-0 top-[60px] sm:absolute sm:inset-x-auto sm:-right-6 sm:top-full sm:mt-[25px] sm:w-[360px] sm:max-w-[92vw] animate-in fade-in-0 sm:zoom-in-95 slide-in-from-top-2 duration-200 max-sm:duration-[250ms]">
                        {/* V61 — Marketplace glass panel: near-opaque dark
                            surface + top sheen, wider (360px) with roomier
                            rows so the menu reads as a proper panel, not a
                            cramped context menu. dvh (not vh) cap so the
                            bottom rows never hide behind iOS Safari's
                            toolbar. */}
                        <div className="relative overflow-hidden rounded-lg border border-border-default bg-[#17171F] p-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] max-h-[calc(100dvh-110px)] overflow-y-auto overscroll-contain max-sm:rounded-none max-sm:rounded-b-2xl max-sm:border-x-0 max-sm:border-t-0 max-sm:max-h-[calc(100dvh-60px-var(--mobile-tab-bar-h,64px)-env(safe-area-inset-bottom)-16px)]">
                          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,rgba(163,230,53,0.06),transparent)]" />
                          {/* User Info card */}
                          <div className="relative border-b border-border-subtle p-2 pb-2">
                            {user.isApprovedSeller ? (
                              // Outer container — shared bg/border
                              <div className="flex items-center gap-2.5 w-full rounded-md bg-white/[0.04] border border-border-subtle hover:border-border-strong transition-all overflow-hidden group/card">
                                {/* Left — shop link */}
                                <Link
                                  href={`/shop/${user.profile?.shop_slug || user.profile?.username || ''}`}
                                  onClick={() => setUserMenuOpen(false)}
                                  className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 hover:bg-white/[0.04] transition-colors group/link"
                                >
                                  <img
                                    src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                                    alt={user.profile?.username || 'User'}
                                    className="h-10 w-10 rounded-full flex-shrink-0 object-cover ring-2 ring-white/10 group-hover/link:ring-[#C6FF3D66] transition-all"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-bold text-text-primary text-[15px] truncate group-hover/link:text-lime-text transition-colors leading-tight">
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
                                {/* Right — Sell button (pill CTA) */}
                                <div className="flex-shrink-0 pr-2">
                                  <Link
                                    href="/sell/new"
                                    onClick={() => setUserMenuOpen(false)}
                                    className="flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-sm font-bold text-text-inverse transition-colors hover:bg-lime/90 whitespace-nowrap"
                                  >
                                    <PlusCircle className="h-4 w-4" />
                                    Sell
                                  </Link>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 bg-white/[0.04] border border-border-subtle">
                                {/* V66 — Buyer identity card: Rookie rank chip +
                                    member-since line. */}
                                <img
                                  src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                                  alt={user.profile?.username || 'User'}
                                  className="h-10 w-10 rounded-full flex-shrink-0 object-cover ring-2 ring-white/10"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-bold text-text-primary text-[15px] leading-tight">
                                      {user.profile?.username || 'User'}
                                    </span>
                                    <span className="inline-flex flex-none items-center gap-1 rounded-md border border-[rgba(96,165,250,0.3)] bg-info-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info">
                                      <Sparkles className="h-2.5 w-2.5" />
                                      Rookie
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-[11.5px] text-text-tertiary">
                                    Member since{' '}
                                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Menu Items */}
                          <div className="relative py-1.5">

                            {/* Admin Panel - Admins Only */}
                            {isAdmin && (
                              <>
                                <Link
                                  href="/admin"
                                  className="mb-1.5 flex items-center gap-3 rounded-md border border-lime-tint-border bg-lime-tint-bg px-4 py-2.5 text-[14px] font-semibold text-lime-text transition-colors hover:border-lime"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Shield className="h-[18px] w-[18px]" />
                                  Admin Panel
                                </Link>
                                <div className="my-1.5 h-px bg-border-subtle" />
                              </>
                            )}

                            {/* V21/P7.ae — SELLER MENU. Order:
                                Seller Dashboard → My Offers → My Orders →
                                ─ → Messages, Feedback → ─ → Offline Mode
                                toggle → ─ → Settings, Support.
                                Icons are swappable mask SVGs in
                                /public/assets/menu-icons/. */}
                            {user.isApprovedSeller ? (
                              <>
                                {/* V21/P7.ag — Primary item: soft elevated
                                    fill + lime icon, distinct from the
                                    lime-bordered Admin Panel above and the
                                    plain hover rows below. No more jarring
                                    white block. */}
                                <Link
                                  href="/account/dashboard"
                                  prefetch={false}
                                  className="mb-1 flex items-center gap-3 rounded-md border border-border-subtle bg-white/[0.06] px-4 py-2.5 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.10]"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="seller-dashboard" className="text-lime-text" />
                                  Seller Dashboard
                                </Link>

                                <div className="my-1.5 h-px bg-border-subtle" />

                                {/* V63 — Money section: Orders, Offers, Wallet (with live
                                    available balance on the right). */}
                                <Link
                                  href="/account/orders"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="my-orders" />
                                  Orders
                                </Link>

                                <Link
                                  href="/account/listings"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="my-offers" />
                                  Offers
                                </Link>

                                <Link
                                  href="/account/wallet"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Wallet className="h-[18px] w-[18px] shrink-0" />
                                  Wallet
                                  {navWalletBalance != null && (
                                    <span className="ml-auto text-[13.5px] font-semibold tabular-nums text-text-primary">
                                      ${Number(navWalletBalance.available_balance ?? 0).toFixed(2)}
                                    </span>
                                  )}
                                </Link>

                                <div className="my-1.5 h-px bg-border-subtle" />

                                {/* Offline Mode toggle — pauses all offers
                                    (hidden from buyers) until toggled back. */}
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={offlineMode}
                                  disabled={pendingOffline}
                                  onClick={toggleOfflineMode}
                                  className="flex w-full items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary disabled:opacity-60"
                                >
                                  <MenuIcon
                                    name="power"
                                    className={offlineMode ? 'text-amber-400' : 'text-text-secondary'}
                                  />
                                  <span className="flex min-w-0 flex-col items-start">
                                    <span className="leading-tight">Offline Mode</span>
                                    <span className="text-[11.5px] leading-tight text-text-tertiary">
                                      {offlineMode ? 'Offers hidden from buyers' : 'Your offers are live'}
                                    </span>
                                  </span>
                                  {/* Track */}
                                  <span
                                    className={cn(
                                      'ml-auto flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors',
                                      offlineMode ? 'bg-amber-400/90' : 'bg-white/15',
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'h-4 w-4 rounded-full bg-white shadow transition-transform',
                                        offlineMode ? 'translate-x-4' : 'translate-x-0',
                                      )}
                                    />
                                  </span>
                                </button>

                                <div className="my-1.5 h-px bg-border-subtle" />

                                <Link
                                  href="/account/messages"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="messages" />
                                  Messages
                                </Link>

                                <Link
                                  href="/account/reviews"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="feedback" />
                                  Feedback
                                </Link>

                                <Link
                                  href="/account/settings"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="settings" />
                                  Settings
                                </Link>

                                <Link
                                  href="/support"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MenuIcon name="support" />
                                  Support
                                </Link>
                              </>
                            ) : (
                              /* BUYER / PENDING-SELLER MENU (unchanged flow) */
                              <>
                                <Link
                                  href="/account/dashboard"
                                  prefetch={false}
                                  className="mb-1 flex items-center gap-3 rounded-md px-4 py-2 text-[14px] font-medium text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <LayoutDashboard className="h-[18px] w-[18px]" />
                                  Dashboard
                                </Link>

                                <BecomeSellerCta
                                  variant="menu"
                                  onNavigate={() => setUserMenuOpen(false)}
                                />

                                <div className="my-1.5 h-px bg-border-subtle" />

                                {/* V68 — Shopping section: Orders, Wishlist, Wallet */}
                                <Link
                                  href="/account/orders"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Package className="h-[18px] w-[18px]" />
                                  Orders
                                </Link>

                                <Link
                                  href="/account/wishlist"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Heart className="h-[18px] w-[18px]" />
                                  Wishlist
                                </Link>

                                <Link
                                  href="/account/wallet"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Wallet className="h-[18px] w-[18px]" />
                                  Wallet
                                </Link>

                                <div className="my-1.5 h-px bg-border-subtle" />

                                {/* V68 — Inbox + account management */}
                                <Link
                                  href="/account/messages"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <MessageSquare className="h-[18px] w-[18px]" />
                                  Messages
                                </Link>

                                <Link
                                  href="/account"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <User className="h-[18px] w-[18px]" />
                                  Account
                                </Link>

                                <Link
                                  href="/account/settings"
                                  className="flex items-center gap-3 rounded-md px-4 py-2 text-[14px] text-text-secondary transition-colors hover:bg-white/[0.07] hover:text-text-primary"
                                  onClick={() => setUserMenuOpen(false)}
                                >
                                  <Settings className="h-[18px] w-[18px]" />
                                  Settings
                                </Link>
                              </>
                            )}
                          </div>

                          {/* Logout */}
                          <div className="relative border-t border-border-subtle pt-1.5">
                            <button
                              onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()

                                // V21/P5.b + V23 — Sign-out flow:
                                //  1. Show full-screen blur+loader overlay
                                //  2. NAVIGATE FIRST (for protected paths),
                                //     THEN sign out. Order matters: signOut()
                                //     flips the auth state to logged-out, and
                                //     if we're still on a protected page like
                                //     /account/orders the page re-renders in
                                //     place as logged-out (collapsing to its
                                //     empty/footer fallback) — that's the
                                //     "see the bottom of the page" flash the
                                //     user reported. By starting the redirect
                                //     to '/' BEFORE awaiting signOut, we're
                                //     already leaving the protected page when
                                //     the state flips, so it never paints
                                //     logged-out in place.
                                //  3. Public paths just refresh in place
                                //     (scroll to top first so the user lands
                                //     cleanly, not stranded mid-scroll).
                                // The overlay stays up the whole time.
                                setIsLoggingOut(true)
                                setUserMenuOpen(false)

                                // Raise the cross-component logout flag so the
                                // protected layouts (e.g. /account) skip their
                                // "redirect to /login if !user" effect while we
                                // drive the user home — otherwise the two race
                                // and flash the login screen mid-logout.
                                beginLogout()

                                // Shared source of truth with the middleware
                                // (src/lib/auth/protected-routes.ts) so the two
                                // can't drift — logging out on a page you can no
                                // longer access sends you home.
                                const isProtected = isProtectedPath(pathname)

                                // Scroll to top BEFORE anything paints so the
                                // user never sees the page mid-scroll.
                                if (typeof window !== 'undefined') {
                                  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
                                }

                                // Kick off the redirect home for protected
                                // pages immediately — before signOut flips the
                                // auth state and re-renders the page in place.
                                // Arm the navigation-settle gate so the opaque
                                // overlay is lifted by the effect above (when
                                // pathname === '/' has painted), not by the
                                // blind timer — which could lift before home
                                // mounts and pop content in.
                                if (isProtected) {
                                  setAwaitingHomePaint(true)
                                  router.replace('/')
                                }

                                try {
                                  const { createClient } = await import('@/lib/supabase/client')
                                  const supabase = createClient()
                                  const { error } = await supabase.auth.signOut()
                                  if (error) console.error('Logout error:', error)

                                  queryClient.clear()

                                  // Public paths stay put — refresh in place so
                                  // server components re-render logged-out.
                                  if (!isProtected) {
                                    router.refresh()
                                  }

                                  try {
                                    const { toast } = await import('sonner')
                                    toast.success('Signed out')
                                  } catch {}

                                  if (isProtected) {
                                    // Primary lift is the navigation-settle
                                    // effect (waits for home to paint). This
                                    // timer is only a SAFETY CAP so the overlay
                                    // can never get stuck if the route never
                                    // settles on '/'. Generous (1500ms) so it
                                    // doesn't pre-empt a slightly slow home mount.
                                    setTimeout(() => {
                                      setIsLoggingOut(false)
                                      setAwaitingHomePaint(false)
                                    }, 1500)
                                  } else {
                                    // Public path: page stays put + refreshed,
                                    // so a short hold to let it re-render is all
                                    // that's needed.
                                    setTimeout(() => setIsLoggingOut(false), 350)
                                  }
                                } catch (error) {
                                  console.error('Logout failed:', error)
                                  if (!isProtected) {
                                    router.replace('/')
                                  }
                                  setTimeout(() => {
                                    setIsLoggingOut(false)
                                    setAwaitingHomePaint(false)
                                  }, 1500)
                                }
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-4 py-2 text-[14px] text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                            >
                              <LogOut className="h-[18px] w-[18px]" />
                              Log Out
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // V17 — Buttons open the AuthDialog modal instead of
                // navigating to /login or /signup. Modal handles the
                // smooth in/out transition; URL stays at the current
                // page so the user never loses their browsing context.
                <div className="flex items-center gap-2">
                  {/* App-shell — "Log in" is desktop-only; phones keep a
                      single Sign up CTA next to the bell per the mobile
                      bar spec (login reachable from the auth dialog). */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => authDialog.open('login')}
                    className="hidden h-9 rounded-full text-gray-300 hover:bg-white/10 hover:text-white lg:inline-flex"
                  >
                    Log in
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => authDialog.open('signup')}
                    className="h-9 rounded-lg bg-white text-black hover:bg-white/90 font-medium"
                  >
                    Sign up
                  </Button>
                </div>
              )}

              {/* App-shell — Mobile Menu Button moved to the far LEFT of
                  the bar (before the logo, above) for the
                  [hamburger][logo]……[bell][avatar] mobile order. */}
            </div>
          </motion.div>
        </motion.div>
      </motion.nav>

      {/* Mobile marketplace sheet — a full-screen editorial menu on phones.
          The panel owns the whole viewport so the hamburger never leaves a
          half-height sheet behind. AnimatePresence keeps the closing motion
          mounted long enough for the X action to slide it out cleanly. */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="mobile-menu-scrim"
              aria-hidden
              onClick={() => {
                setMobileMenuOpen(false)
                setMobileMenuTab(null)
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] lg:hidden"
            />
            <motion.div
              key="mobile-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Browse marketplace"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[70] lg:hidden"
            >
              <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#161922_0%,#10131a_44%,#090b10_100%)] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.9)]">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_at_18%_-20%,rgba(78,143,255,0.13),transparent_68%),linear-gradient(to_bottom,rgba(255,255,255,0.035),transparent)]"
                />

                {/* Full-modal header — brand at left, unboxed X at right. */}
                <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 pb-4 pt-4">
                  <Link
                    href="/"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setMobileMenuTab(null)
                    }}
                    className="flex items-center gap-2.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/logo-mark-lime.png" alt="DropMarket" className="h-9 w-9" />
                    <span className="font-display text-[20px] font-extrabold tracking-[-0.03em] text-white">
                      Drop<span className="text-lime-text">Market</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setMobileMenuTab(null)
                    }}
                    aria-label="Close menu"
                    className="grid h-10 w-10 place-items-center text-white/55 transition-colors hover:text-white active:scale-95"
                  >
                    <X aria-hidden className="h-7 w-7" strokeWidth={1.8} />
                  </button>
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {/* SCREEN 1 — service index. */}
                  <div
                    aria-hidden={mobileMenuTab !== null}
                    className={cn(
                      'absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-8 pt-6 transition-transform duration-[320ms] ease-gv [-webkit-overflow-scrolling:touch]',
                      mobileMenuTab !== null && 'pointer-events-none -translate-x-full',
                    )}
                  >
                    {/* ACCOUNT ROOT — retained for the account-aware menu path. */}
                    {menuRoot === 'account' && (
                      <>
                        <div className="mb-4">
                          <h2 className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-white">My Account</h2>
                          <p className="mt-0.5 text-[12px] text-white/50">Manage your DropMarket account</p>
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {ACCOUNT_MENU_ITEMS.filter((i) => !i.sellerOnly || user?.isApprovedSeller).map(
                            ({ label, href, Icon }) => (
                              <Link
                                key={href}
                                href={href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="group flex min-h-[58px] w-full items-center gap-3 text-left transition-colors hover:bg-white/[0.035]"
                              >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-white/[0.07] bg-white/[0.05]">
                                  <Icon className="h-[18px] w-[18px] text-[#3d9bff]" />
                                </span>
                                <span className="flex-1 truncate text-[14px] font-semibold text-white">{label}</span>
                                <ChevronRight className="h-4 w-4 text-white/60" />
                              </Link>
                            ),
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMenuRoot('browse')}
                          className="group mt-5 flex min-h-[58px] w-full items-center gap-3 border-t border-white/[0.08] pt-4 text-left"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-white/[0.07] bg-white/[0.05]">
                            <LayoutGrid className="h-[18px] w-[18px] text-[#3d9bff]" />
                          </span>
                          <span className="flex-1 text-[14px] font-semibold text-white">Browse Marketplace</span>
                          <ChevronRight className="h-4 w-4 text-white/60" />
                        </button>
                      </>
                    )}

                    {menuRoot === 'browse' && (
                      <>
                        <div className="mb-4">
                          <h2 className="font-display text-[22px] font-extrabold tracking-[-0.03em] text-white">Services</h2>
                          <p className="mt-0.5 text-[12px] text-white/50">Everything you need to play more</p>
                        </div>
                        <div>
                          {MOBILE_SERVICE_ITEMS.map((item) => (
                            <MobileServiceRow
                              key={item.id}
                              item={item}
                              onSelect={(tabId) => setMobileMenuTab(tabId)}
                              onClose={() => {
                                setMobileMenuOpen(false)
                                setMobileMenuTab(null)
                              }}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-4">
                      <Link
                        href="/account/wallet"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <Wallet className="h-4 w-4" /> Wallet
                      </Link>
                      <Link
                        href="/support"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <LifeBuoy className="h-4 w-4" /> Support
                      </Link>
                    </div>

                    {!loading && !user && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false)
                            authDialog.open('signup')
                          }}
                          className="h-10 rounded-lg bg-[#174d31] text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-14px_rgba(0,0,0,0.8)] transition-colors hover:bg-[#1e6540]"
                        >
                          Sign Up
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false)
                            authDialog.open('login')
                          }}
                          className="h-10 rounded-lg border border-white/[0.12] bg-white/[0.04] text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
                        >
                          Log In
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SCREEN 2 — game list. */}
                  {(() => {
                    const tab = NAV_TABS.find((t) => t.id === mobileMenuTab)
                    const entries = tab ? gamesByType[tab.type] || [] : []
                    return (
                      <div
                        aria-hidden={mobileMenuTab === null}
                        className={cn(
                          'absolute inset-0 flex flex-col bg-[linear-gradient(180deg,#161922_0%,#10131a_44%,#090b10_100%)] transition-transform duration-[320ms] ease-gv',
                          mobileMenuTab === null && 'pointer-events-none translate-x-full',
                        )}
                      >
                        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setMobileMenuTab(null)}
                            aria-label="Back To Menu"
                            className="grid h-9 w-9 shrink-0 place-items-center text-white/65 transition-colors hover:text-white active:scale-95"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                          <span className="truncate text-[16px] font-bold text-white">{tab?.label ?? ''}</span>
                          <span className="text-[12px] tabular-nums text-white/45">{entries.length} {entries.length === 1 ? 'Game' : 'Games'}</span>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 [-webkit-overflow-scrolling:touch]">
                          {entries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <Search className="mb-2 h-5 w-5 text-white/30" />
                              <p className="text-[13px] text-white/45">No games here yet</p>
                            </div>
                          ) : (
                            entries.map(({ game, categorySlug }) => (
                              <Link
                                key={game.slug}
                                href={`/${game.slug}/${categorySlug}`}
                                onClick={() => {
                                  setMobileMenuOpen(false)
                                  setMobileMenuTab(null)
                                }}
                                className="group flex h-12 items-center gap-2.5 border-b border-white/[0.06] transition-colors hover:bg-white/[0.035]"
                              >
                                {game.image_url && game.image_url !== '' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={game.image_url} alt="" className="h-8 w-8 shrink-0 rounded-[7px] object-cover ring-1 ring-white/[0.10]" />
                                ) : (
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-white/[0.08] text-[9px] font-bold text-white/45">
                                    {game.name.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                                <span className="flex-1 truncate text-[14px] font-semibold text-white/85">{game.name}</span>
                                {(gameCatCounts.get(game.slug) ?? 0) > 1 && (
                                  <span className="text-[11px] tabular-nums text-white/40">{gameCatCounts.get(game.slug)}</span>
                                )}
                                <ChevronRight className="h-4 w-4 shrink-0 text-white/45 group-hover:text-white/80" />
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer — sized to the navbar's real extent. Below lg the app-shell
          mobile bar is a solid 60px strip at top-0, so the spacer matches
          (h-[60px]). lg+ keeps the pill math (top 12px + ~66px bar ≈ 78px
          at rest → 84px spacer), byte-identical to before. */}
      <div className="h-[60px] lg:h-[84px]" />
    </>
  )
}

// Category Dropdown Component
function CategoryDropdown({
  tab,
  gameEntries,
  isActive,
  isCurrent = false,
  onHoverStart,
  onHoverEnd,
  onSelect,
  anchorRef,
}: {
  tab: { id: string; label: string; type: string }
  gameEntries: Array<{ game: any; categorySlug: string }>
  isActive: boolean
  /** V50 — True when the page being viewed belongs to this category. */
  isCurrent?: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
  /** V14u — Called when the user picks a game so the dropdown can close. */
  onSelect: () => void
  /**
   * V17v — Optional shared anchor for the mega-menu pattern. When
   * provided, the popover content positions relative to this element
   * instead of the trigger button — so every dropdown opens in the
   * same horizontal location regardless of which tab triggered it.
   */
  anchorRef?: React.RefObject<HTMLDivElement | null>
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

  // V17v — modal={false} stops Radix from setting aria-modal + focus
  // trap, which were swallowing link clicks. Hover-controlled popovers
  // don't need focus management. Combined with anchor pointing at the
  // navbar container, this gives a mega-menu that stays centered
  // regardless of which tab triggered it.
  return (
    <Popover.Root open={isActive && gameEntries.length > 0} modal={false}>
      <Popover.Trigger asChild>
        <button
          data-dropdown
          // Touch-tablet support: hover open/close only runs for REAL mouse
          // pointers (pointerType guard filters the synthesized hover a tap
          // produces), and tap/click toggles the popover deterministically.
          // Desktop hover behavior is unchanged; click-to-close on desktop
          // is standard toggle behavior.
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') onHoverStart() }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') onHoverEnd() }}
          onClick={() => (isActive ? onSelect() : onHoverStart())}
          className={cn(
            'flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white whitespace-nowrap',
            isCurrent ? 'bg-white/[0.08] text-white' : 'text-gray-300',
          )}
        >
          {tab.label}
          <ChevronDown className={cn('h-3 w-3 transition-transform', isActive && 'rotate-180')} />
        </button>
      </Popover.Trigger>
      {/* V17v — Anchor the popover content to the shared element
          (the category-tabs container) so all four dropdowns open
          centered over the same point. We render Popover.Anchor
          unconditionally — Radix gracefully falls back to the
          trigger when virtualRef.current is still null. */}
      {anchorRef && (
        <Popover.Anchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      )}
      <Popover.Portal>
        <Popover.Content
          align="center"
          side="bottom"
          // V17w — Real breathing room (12px) between navbar pill and
          // dropdown card. The visible gap is bridged by an invisible
          // pt-3 padding on the motion.div below, which extends the
          // popover's hover area UP into the gap — so cursor crossing
          // the visual gap still counts as hovering the popover.
          sideOffset={4}
          collisionPadding={16}
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // V17w — Block Radix's built-in dismiss on outside
          // interactions. With modal={false} the popover doesn't
          // trap focus, so ANY click (including inside the dropdown
          // content like the search input or a game tile) is routed
          // through Radix's "did the user click outside?" detector.
          // For a hover-controlled mega-menu we don't want Radix to
          // close anything — our hover handlers and the link
          // onClick={onSelect} handle close explicitly.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          className="z-50 outline-none"
          asChild
        >
          <div
            // CSS entrance, not framer (rAF-stall class).
            // V17w — Invisible hover bridge. pt-3 (12px) of transparent
            // padding on top makes the popover's pointer-event area
            // include the visual gap above the dropdown card. Cursor
            // moving from navbar button → dropdown card crosses this
            // bridge and counts as "inside popover," so the close
            // debounce never fires mid-traverse.
            className="animate-fade-in pt-2"
          >
            {/* V17p — Dropdown scaled up to match the navbar's own
                width and breathing room. ~960px wide (capped at 92vw),
                with bigger type and 3-column game grid on the right so
                a 20-game list fits without scrolling on most screens. */}
            {/* V17v — Fixed min-height so all four tabs render at the
                same overall popover height. Currency/Boosting have
                fewer games but the popover doesn't shrink — the empty
                lower area absorbs visually instead of changing layout
                when you hover between tabs. */}
            {/* V21/P7.z — Translucent navbar-matched surface instead of
                flat black, so backdrop-blur actually engages and the
                dropdown reads as glass over the page (same token as the
                search panel). */}
            <div
              // data-dropdown marks the portalled content as "inside" for the
              // document-level outside-tap handler in Navbar — taps/clicks
              // inside the mega-menu stay open, anywhere else dismisses it
              // (the touch counterpart of the mouseleave debounce).
              data-dropdown
              className="w-[min(960px,92vw)] overflow-hidden rounded-2xl border border-white/10 shadow-2xl backdrop-blur-2xl backdrop-saturate-150"
              style={{ backgroundColor: 'rgba(10, 10, 15, 0.92)' }}
            >
              {/* V21/P7.aa — min-h on the GRID (not the card) so the left
                  "Popular" column's background + right border stretch the
                  full height even on tabs with few games. Previously the
                  card had the min-h while the grid only filled its content
                  height, leaving a lighter-bg gap below the short column —
                  read as a stray horizontal divider on Currency/Top
                  Up/Boosting. */}
              {/* min-h capped by 62dvh so tablet-landscape viewports
                  (~620-650px usable) don't force the card past the fold. */}
              <div className="grid min-h-[min(520px,62dvh)] grid-cols-1 items-stretch md:grid-cols-[260px_1fr]">
                {/* LEFT — Popular */}
                <div className="border-b border-white/10 bg-white/[0.02] p-4 md:border-b-0 md:border-r">
                  <div className="mb-3 px-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
                    Popular {tab.label}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {popular.map(({ game, categorySlug }) => (
                      <li key={game.slug}>
                        {/* V17v — SmartLink fixes the scroll-to-top
                            glitch users were seeing when clicking a
                            game in the dropdown. */}
                        <SmartLink
                          href={`/${game.slug}/${categorySlug}`}
                          onClick={onSelect}
                          className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/[0.06]"
                        >
                          {game.image_url ? (
                            <img
                              src={game.image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-contain"
                            />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] font-bold text-gray-300">
                              {game.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate text-[14.5px] font-semibold text-gray-200 group-hover:text-white">
                            {game.name}
                          </span>
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* RIGHT — Searchable */}
                <div className="flex max-h-[min(520px,62dvh)] flex-col p-4">
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={`Search ${tab.label.toLowerCase()}…`}
                      className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-[14px] text-white placeholder:text-gray-500 outline-none transition-colors focus:border-lime-tint-border focus:bg-white/[0.08]"
                    />
                  </div>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-gray-400">
                      All {tab.label}
                    </div>
                    <div className="text-[12px] tabular-nums text-gray-500">
                      {filtered.length} game{filtered.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="-mr-1 flex-1 overflow-y-auto pr-1">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Search className="mb-2 h-5 w-5 text-gray-600" />
                        <p className="text-[13px] text-gray-500">
                          No games match &ldquo;{q}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-2 gap-1 lg:grid-cols-3">
                        {filtered.map(({ game, categorySlug }) => (
                          <li key={game.slug}>
                            <SmartLink
                              href={`/${game.slug}/${categorySlug}`}
                              onClick={onSelect}
                              className="group flex items-center gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-white/[0.06]"
                            >
                              {game.image_url ? (
                                <img
                                  src={game.image_url}
                                  alt=""
                                  className="h-8 w-8 shrink-0 rounded-md object-contain"
                                />
                              ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-gray-300">
                                  {game.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate text-[13.5px] font-semibold text-gray-200 group-hover:text-white">
                                {game.name}
                              </span>
                            </SmartLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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

// V21/P7.u — Placeholder category icons by canonical type. Admin can
// override per game via category_configs.currency_icon_url; this is the
// default art when none is set. Swap the SVGs in
// /public/assets/category-icons/ to change the defaults.
// V21/P7.ae — currentColor mask icon for the profile menu. Drop a new
// SVG into /public/assets/menu-icons/<name>.svg to swap the art; the
// mask inherits the row's text color so hover/active states tint it.
function MenuIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-[18px] w-[18px] shrink-0 bg-current', className)}
      style={{
        WebkitMaskImage: `url(/assets/menu-icons/${name}.svg)`,
        maskImage: `url(/assets/menu-icons/${name}.svg)`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}

function categoryFallbackIcon(
  type: string | undefined,
  slug: string,
): string | null {
  const key = (type || slug || '')
    .toLowerCase()
    .replace(/^buy-/, '')
  const map: Record<string, string> = {
    currency: '/assets/category-icons/currencies.svg',
    items: '/assets/category-icons/items.svg',
    item: '/assets/category-icons/items.svg',
    account: '/assets/category-icons/accounts.svg',
    accounts: '/assets/category-icons/accounts.svg',
    service: '/assets/category-icons/boosting.svg',
    boosting: '/assets/category-icons/boosting.svg',
    boost: '/assets/category-icons/boosting.svg',
    top_up: '/assets/category-icons/top-up.svg',
    'top-up': '/assets/category-icons/top-up.svg',
    topup: '/assets/category-icons/top-up.svg',
    gift_card: '/assets/category-icons/gift-cards.svg',
    'gift-cards': '/assets/category-icons/gift-cards.svg',
    giftcards: '/assets/category-icons/gift-cards.svg',
    limiteds: '/assets/category-icons/limiteds.svg',
    limited: '/assets/category-icons/limiteds.svg',
  }
  return map[key] ?? null
}

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
  catConfigData = [],
  onSubmitFallback,
  expanded = false,
  onExpandedChange,
}: {
  navCatsData: any[]
  catConfigData?: any[]
  onSubmitFallback: (q: string) => void
  /** V21/P7.r — When true, the input fills the navbar row and shows a
   *  close button. The parent collapses the category links + icons. */
  expanded?: boolean
  onExpandedChange?: (v: boolean) => void
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  // V21/P7.v — In-game item / filter-value matches (e.g. "garama",
  // "nfr parrot") fetched from the server (attribute_options). Game and
  // category-name matches stay client-side off navCatsData below.
  const [optionHits, setOptionHits] = useState<AttrOptionHit[]>([])
  // V21/P7.v — True while the server search is in flight so the panel
  // shows a loading state instead of a premature "No matches".
  const [searching, setSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const collapse = useCallback(() => {
    setFocused(false)
    onExpandedChange?.(false)
    // V21/P7.aa — Clearing on collapse resets the bar fully so it doesn't
    // reopen with a stale query / leftover results next time.
    setQ('')
    setOptionHits([])
  }, [onExpandedChange])

  const expand = useCallback(() => {
    onExpandedChange?.(true)
    setFocused(true)
    // Focus after the layout animation kicks off.
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [onExpandedChange])

  // V21/P7.r — Cmd/Ctrl+K opens search; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        expand()
      } else if (e.key === 'Escape' && expanded) {
        collapse()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expand, collapse, expanded])

  // Click-outside closes the panel (and collapses the expanded bar).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // V21/P7.aa — Full reset (clears query + results) so clicking out
        // without searching leaves no lingering half-open search.
        collapse()
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [collapse])

  // V21/P7.t — Build a (game → categories) index where each category
  // carries its display label so we can match BOTH the game name AND
  // the category name. "Robux" → Roblox ▸ Robux. "Garama" → Steal a
  // Brainrot ▸ Items. Each result row is a game with the categories
  // that matched nested under it.
  // Map of `${game_id}:${category_type}` → currency_icon_url.
  const catIconMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of (catConfigData ?? []) as any[]) {
      const url = row?.config?.currency_icon_url
      if (url && row.game_id && row.category_type) {
        m.set(`${row.game_id}:${row.category_type}`, url)
      }
    }
    return m
  }, [catConfigData])

  const gameIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        game: NavGame
        categories: { slug: string; label: string; iconUrl?: string | null }[]
      }
    >()
    for (const row of navCatsData as any[]) {
      const game = row.game
      if (!game?.slug) continue
      // V21/P7.x — Prefer the category's own `name` (e.g. "V-Bucks") so
      // the search label matches the subnav exactly. The metadata label
      // and slug-derived fallback only kick in when name is missing
      // (slug fallback "buy-vbucks" → "Vbucks" was the wrong casing).
      const label =
        (row.name as string) ||
        (row.metadata?.label as string) ||
        (row.metadata?.name as string) ||
        row.slug
          .replace(/^buy-/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
      // V21/P7.u — Icon resolution: admin-uploaded currency_icon_url
      // first (keyed by game_id:category_type), else a static
      // placeholder SVG by category type from
      // /public/assets/category-icons/. Replace those SVGs to swap the
      // default per-category art.
      const catType = row.metadata?.type as string | undefined
      const adminIcon =
        row.game_id && catType
          ? catIconMap.get(`${row.game_id}:${catType}`) ?? null
          : null
      const iconUrl = adminIcon ?? categoryFallbackIcon(catType, row.slug)
      const entry = map.get(game.slug)
      if (entry) {
        entry.categories.push({ slug: row.slug, label, iconUrl })
      } else {
        map.set(game.slug, { game, categories: [{ slug: row.slug, label, iconUrl }] })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.game.sort_order ?? 99) - (b.game.sort_order ?? 99),
    )
  }, [navCatsData, catIconMap])

  const trimmed = q.trim()
  // Each match = a game + the subset of its categories that matched.
  // If the GAME name matches, show all its categories. If only a
  // CATEGORY matches, show just that category nested under the game.
  type CatRow = { slug: string; label: string; iconUrl?: string | null }
  const matches = useMemo(() => {
    if (!trimmed) return [] as { game: NavGame; categories: CatRow[] }[]
    const needle = trimmed.toLowerCase()
    const out: { game: NavGame; categories: CatRow[] }[] = []
    for (const g of gameIndex) {
      const gameHit =
        g.game.name.toLowerCase().includes(needle) ||
        g.game.slug.toLowerCase().includes(needle)
      const catHits = g.categories.filter((c) =>
        c.label.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle),
      )
      if (gameHit) {
        out.push({ game: g.game, categories: g.categories })
      } else if (catHits.length > 0) {
        out.push({ game: g.game, categories: catHits })
      }
    }
    return out.slice(0, 6)
  }, [gameIndex, trimmed])

  // V21/P7.v — Debounced server search over filter VALUES so in-game
  // item names ("garama", "nfr parrot") resolve to game ▸ category with
  // the filter pre-applied. Stale responses are discarded via the
  // `active` guard so a slow earlier query can't clobber a newer one.
  useEffect(() => {
    if (trimmed.length < 2) {
      setOptionHits([])
      setSearching(false)
      return
    }
    let active = true
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const hits = await searchAttributeOptions(trimmed)
        if (active) setOptionHits(hits)
      } catch {
        if (active) setOptionHits([])
      } finally {
        if (active) setSearching(false)
      }
    }, 180)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [trimmed])

  // Flatten into navigable rows (game header + its category links) for
  // keyboard nav. Each row = one category destination. Option hits come
  // after the game/category rows.
  const flatRows = useMemo(
    () => [
      ...matches.flatMap((m) =>
        m.categories.map((c) => ({
          kind: 'category' as const,
          game: m.game,
          category: c,
        })),
      ),
      ...optionHits.map((h) => ({ kind: 'option' as const, hit: h })),
    ],
    [matches, optionHits],
  )

  // Reset highlight when query changes.
  useEffect(() => {
    setHighlightIdx(flatRows.length > 0 ? 0 : -1)
  }, [trimmed, flatRows.length])

  const goToCategory = (game: NavGame, categorySlug: string) => {
    setFocused(false)
    setQ('')
    setOptionHits([])
    onExpandedChange?.(false)
    router.push(`/${game.slug}/${categorySlug}`)
  }

  // V21/P7.v — Option hit → deep-link to its category with the filter
  // pre-applied via ?attr_<slug>=<optionSlug>.
  const goToOption = (h: AttrOptionHit) => {
    setFocused(false)
    setQ('')
    setOptionHits([])
    onExpandedChange?.(false)
    router.push(
      `/${h.gameSlug}/${h.categorySlug}?attr_${h.attrSlug}=${encodeURIComponent(h.optionSlug)}`,
    )
  }

  const goToRow = (row: (typeof flatRows)[number]) => {
    if (row.kind === 'category') goToCategory(row.game, row.category.slug)
    else goToOption(row.hit)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!focused) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(flatRows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = flatRows[highlightIdx] ?? flatRows[0]
      if (row) goToRow(row)
    } else if (e.key === 'Escape') {
      collapse()
    }
  }

  const hasResults = matches.length > 0 || optionHits.length > 0
  const open = focused && (hasResults || trimmed.length > 0)

  return (
    <motion.div
      ref={containerRef}
      layout
      className={cn('relative', expanded && 'w-full')}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { setFocused(true); onExpandedChange?.(true) }}
          onClick={() => { if (!expanded) expand() }}
          onKeyDown={onKeyDown}
          placeholder={expanded ? 'Type to search — e.g. Fortnite, Roblox, Garama…' : 'Type to search…'}
          aria-label="Search games"
          aria-autocomplete="list"
          aria-expanded={open}
          // V21/P7.s — Both states are rounded-full bordered pills. The
          // expanded fill is very faint (white/[0.04]) with a hairline
          // border so the bar has visible bounds without reading as a
          // heavy box-in-box. No lime focus ring (fought the brand).
          className={cn(
            // focus-visible:shadow-none overrides the global lime focus
            // ring (globals.css :focus-visible) — it looked wrong on the
            // search bar.
            // V21/P7.t — rounded-lg (rectangular) so the search reads as
            // a distinct field, not a second pill matching the navbar's
            // rounded-full shape.
            'h-10 rounded-lg border pl-11 text-sm text-white placeholder:text-gray-500 outline-none ring-0 transition-colors focus:outline-none focus:ring-0 focus-visible:shadow-none',
            expanded
              ? 'w-full border-white/[0.14] bg-white/[0.04] pr-11'
              : cn(
                  'w-56 cursor-pointer bg-white/5 pr-3 xl:w-72',
                  focused
                    ? 'border-white/20 bg-white/[0.08]'
                    : 'border-white/10 hover:border-white/20',
                ),
          )}
        />
        {/* Expanded → close (X) collapses the bar. Collapsed w/ text →
            clear (X) just empties it. */}
        {expanded ? (
          <button
            type="button"
            onClick={() => { setQ(''); collapse() }}
            aria-label="Close search"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : q ? (
          <button
            type="button"
            onClick={() => { setQ(''); setFocused(true) }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {/* Result panel */}
      <AnimatePresence>
        {open && (
          <div
            // CSS entrance, not framer (rAF-stall class).
            // V21/P7.t — Translucent navbar-matched surface (not flat
            // black). Width tracks the bar: full when expanded, fixed
            // when collapsed.
            className={cn(
              'animate-fade-in absolute top-full mt-2 overflow-hidden rounded-xl border border-white/[0.12] shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-150',
              expanded ? 'inset-x-0' : 'right-0 w-[440px]',
            )}
            style={{ backgroundColor: 'rgba(10, 10, 15, 0.94)' }}
          >
            <div className="max-h-[420px] overflow-y-auto p-1.5">
              {searching && !hasResults ? (
                // V21/P7.v — In-flight: spinner, never a premature "no
                // matches". The empty state only shows once the search
                // settles with nothing found.
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="mb-2.5 h-6 w-6 animate-spin rounded-full border-2 border-white/[0.12] border-t-lime" />
                  <p className="text-[14px] font-semibold text-gray-300">
                    Searching…
                  </p>
                </div>
              ) : !hasResults ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <Search className="mb-2.5 h-6 w-6 text-gray-600" />
                  <p className="text-[14px] font-semibold text-gray-300">
                    No matches for &ldquo;{trimmed}&rdquo;
                  </p>
                  <p className="mt-1 text-[12.5px] text-gray-500">
                    Try a game, category, or item name.
                  </p>
                </div>
              ) : (
                // V21/P7.t/v — Game header + nested category links, then a
                // grouped "In-Game Items" section for filter-value hits.
                // "Robux" → Roblox ▸ Robux. "Garama" → Steal a Brainrot ▸
                // Items · Garama (deep-links with the filter pre-applied).
                // rowIdx is a single running counter shared across both
                // sections so it stays in lockstep with `flatRows` for
                // keyboard nav.
                (() => {
                  let rowIdx = -1
                  return (
                    <div className="space-y-1">
                      {matches.map((m) => (
                        <div key={m.game.slug}>
                          {/* Game header (non-clickable label row) */}
                          <div className="flex items-center gap-3 px-2.5 pb-1 pt-2.5">
                            {m.game.image_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={m.game.image_url}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-white/10"
                              />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-gray-300">
                                {m.game.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span className="truncate text-[15px] font-bold text-white">
                              {m.game.name}
                            </span>
                          </div>
                          {/* Nested category rows — each with its own admin
                              icon (currency_icon_url) when available. */}
                          <ul>
                            {m.categories.map((c) => {
                              rowIdx += 1
                              const idx = rowIdx
                              const highlighted = idx === highlightIdx
                              return (
                                <li key={c.slug}>
                                  <button
                                    type="button"
                                    onClick={() => goToCategory(m.game, c.slug)}
                                    onMouseEnter={() => setHighlightIdx(idx)}
                                    className={cn(
                                      'flex w-full items-center justify-between gap-3 rounded-lg py-2.5 pl-2.5 pr-2.5 text-left transition-colors',
                                      highlighted ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
                                    )}
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      {/* Category icon, indented under the game. */}
                                      <span className="ml-8 flex h-7 w-7 shrink-0 items-center justify-center">
                                        {c.iconUrl ? (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img
                                            src={c.iconUrl}
                                            alt=""
                                            className="h-7 w-7 rounded-md object-contain"
                                          />
                                        ) : (
                                          <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                                        )}
                                      </span>
                                      <span className="truncate text-[14px] font-semibold text-text-primary">
                                        {c.label}
                                      </span>
                                    </span>
                                    <span className="text-gray-500">
                                      <ArrowRightIcon />
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}

                      {/* V21/P7.v — In-game item / filter-value matches. */}
                      {optionHits.length > 0 && (
                        <div>
                          <div className="px-2.5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                            In-Game Items
                          </div>
                          <ul>
                            {optionHits.map((h) => {
                              rowIdx += 1
                              const idx = rowIdx
                              const highlighted = idx === highlightIdx
                              return (
                                <li key={`${h.gameSlug}|${h.categorySlug}|${h.optionSlug}`}>
                                  <button
                                    type="button"
                                    onClick={() => goToOption(h)}
                                    onMouseEnter={() => setHighlightIdx(idx)}
                                    className={cn(
                                      'flex w-full items-center justify-between gap-3 rounded-lg py-2.5 pl-2.5 pr-2.5 text-left transition-colors',
                                      highlighted ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
                                    )}
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      {h.gameImage ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={h.gameImage}
                                          alt=""
                                          className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-white/10"
                                        />
                                      ) : (
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-gray-300">
                                          {h.gameName.slice(0, 2).toUpperCase()}
                                        </span>
                                      )}
                                      <span className="flex min-w-0 flex-col">
                                        <span className="truncate text-[14px] font-semibold text-text-primary">
                                          {h.optionLabel}
                                        </span>
                                        <span className="truncate text-[12px] text-gray-500">
                                          {h.gameName} · {h.categoryLabel}
                                        </span>
                                      </span>
                                    </span>
                                    <span className="text-gray-500">
                                      <ArrowRightIcon />
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
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
