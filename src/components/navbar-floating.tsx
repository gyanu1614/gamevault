'use client'

import { lockScroll } from '@/lib/scroll-lock'
import Link from '@/components/navigation/AppLink'
import { SmartLink } from '@/components/global/SmartLink'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Search, Menu, X, ArrowLeft, ChevronRight, Settings, Store, Package, MessageSquare, PanelLeftOpen, PanelLeftClose, Wallet, LayoutDashboard, Activity, Coins, UserCircle2, Swords, Rocket, LifeBuoy, ShoppingCart, LayoutGrid,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { cn } from '@/lib/utils'
import { safeInternalPath } from '@/lib/utils/safe-link'
import { isProtectedPath } from '@/lib/auth/protected-routes'
import { beginLogout } from '@/lib/auth/logout-signal'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { navCategoriesQuery } from '@/lib/nav/nav-categories-query'
import { useSpotlightGames } from '@/features/home/hooks/useSpotlightGames'
import { getMyWalletBalance } from '@/lib/actions/wallet-ledger'
import { searchAttributeOptions, type AttrOptionHit } from '@/lib/actions/search'
import { setStorePaused, getMyStorePaused } from '@/lib/actions/seller-presence'
import { safeBackground } from '@/lib/utils/safe-background'
import { toast } from 'sonner'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import {
  BellIcon,
  ChatCircleDotsIcon,
  ReceiptIcon,
  CaretDownIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
  XIcon,
} from '@phosphor-icons/react'
import { NavIconButton, NavPanel, NavPanelHeader } from '@/components/navbar/NavChrome'
import { ProfileMenu } from '@/components/navbar/ProfileMenu'
import { OrderStatusPill } from '@/components/account/OrderStatusPill'

// 5 fixed nav tabs with their DB type keys
/* Hamburger root on /account/* — the sidebar's destinations, flat.
   sellerOnly rows hide for buyers; page-level tabs carry sub-views. */
const ACCOUNT_MENU_ITEMS = [
  { label: 'Dashboard', href: '/account/dashboard', Icon: LayoutDashboard, sellerOnly: false },
  { label: 'Orders', href: '/account/orders', Icon: ShoppingCart, sellerOnly: false },
  { label: 'Offers', href: '/account/listings', Icon: Package, sellerOnly: true },
  { label: 'Messages', href: '/account/messages', Icon: MessageSquare, sellerOnly: false },
  { label: 'Wallet', href: '/account/wallet', Icon: Wallet, sellerOnly: false },
  { label: 'Founding HQ', href: '/founding', Icon: Rocket, sellerOnly: false },
  { label: 'Settings', href: '/account/settings', Icon: Settings, sellerOnly: false },
] as const

const NAV_TABS = [
  { id: 'currency', label: 'Currency', type: 'currency' },
  { id: 'accounts', label: 'Accounts', type: 'account' },
  { id: 'items',    label: 'Items',    type: 'items' },
  { id: 'boosting', label: 'Boosting', type: 'service' },
]

// App-shell — icon per nav tab for the attached mobile menu rows.
const NAV_TAB_ICONS: Record<string, React.ElementType> = {
  currency: Coins,
  accounts: UserCircle2,
  items: Swords,
  boosting: Rocket,
}

// Mobile marketplace sheet — rows intentionally carry a short promise, not
// just a category label. This gives the full-screen menu the editorial rhythm
// of the reference sheet while keeping each destination one tap away.
// icon → the drop-in-replaceable house category set under
// /public/icons/categories/. currentColor-tinted (lime) via CSS mask so
// the family reads as one theme regardless of the source SVG's own fill.
const MOBILE_SERVICE_ITEMS = [
  { id: 'currency', label: 'Currencies', description: 'Cheapest game currency deals', icon: 'currency', tabId: 'currency' },
  { id: 'items', label: 'Items', description: 'Unlock in-game items fast', icon: 'items', tabId: 'items' },
  { id: 'accounts', label: 'Accounts', description: 'Get game accounts instantly', icon: 'accounts', tabId: 'accounts' },
  { id: 'boosting', label: 'Boosting', description: 'Rank up fast with pro boosting', icon: 'boosting', tabId: 'boosting' },
] as const

// Widened from the const so the row component stays reusable for both
// slide-to-game-list rows (tabId) and direct-link rows (href) even when
// the current list only uses one variant.
type MobileServiceItem = {
  id: string
  label: string
  description: string
  icon: string
  tabId?: string
  href?: string
}

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
      {/* Neutral tile, the house category glyph in soft white (tinted via
          CSS mask, drop-in-replaceable from public/icons/categories). */}
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-bg-overlay">
        <span
          aria-hidden
          className="h-5 w-5 bg-white/85"
          style={{
            maskImage: `url(/icons/categories/${item.icon}.svg)`,
            WebkitMaskImage: `url(/icons/categories/${item.icon}.svg)`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-tight text-white">
          {item.label}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] leading-tight text-text-tertiary">
          {item.description}
        </span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/75" />
    </>
  )

  if (item.tabId) {
    return (
      <button
        type="button"
        onClick={() => onSelect(item.tabId!)}
        className="group flex min-h-[64px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      href={item.href ?? '/browse'}
      onClick={onClose}
      className="group flex min-h-[64px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
    >
      {content}
    </Link>
  )
}

// ── Tier visual config ────────────────────────────────────────────────────────
// Colors/bg/border come from the central rank ladder (@/lib/seller/tiers).
// Only the per-tier Lucide glyph is chosen here.
/**
 * V19/P15.b — `forceScrolled` pins the navbar in its full-width "bar"
 * mode regardless of scroll position. Used by /sell/* and any other
 * surface that wants the navbar to sit flush at top-0 from the start
 * (no floating pill at rest). The framer-motion morph still runs on
 * mount so the visual transition is identical to what scrolling
 * triggers.
 */
/** Game logo for a live-order row: the game's own uploaded logo (games.image_url),
 *  then the static icon map, then a receipt glyph if the image fails to load. */
function LiveOrderGameIcon({ game }: { game?: { slug?: string | null; image_url?: string | null } | null }) {
  const [failed, setFailed] = useState(false)
  const src = game?.image_url || (game?.slug ? getGameIcon(game.slug) : null)
  return (
    <div className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-[8px] bg-white/[0.06]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          width={44}
          height={44}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <ReceiptIcon size={17} weight="bold" aria-hidden className="text-text-secondary" />
      )}
    </div>
  )
}

/** Live-order row (Live Orders panel): game icon, title, the orders-list
 *  status pill (shared labels), total. Fill-only row. */
function LiveOrderRow({ order, onNavigate }: { order: any; onNavigate: () => void }) {
  return (
    <Link
      href={`/account/orders/${order.id}`}
      onClick={onNavigate}
      className="group flex items-center gap-3.5 rounded-[8px] px-3 py-3 transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
    >
      <LiveOrderGameIcon game={(order.listing as any)?.game} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text-primary">
          {(order.listing as any)?.title || 'Order'}
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <OrderStatusPill status={order.status} className="h-5 px-1.5 text-[11px]" />
          <span className="text-[12.5px] tabular-nums text-text-tertiary">
            ${Number(order.total_amount).toFixed(2)}
          </span>
        </div>
      </div>
      <CaretRightIcon size={12} weight="bold" aria-hidden className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
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

  // Mirror of the account drawer's open state (AccountSidebar broadcasts it)
  // so the trigger icon can morph open ⇄ close like a real panel toggle.
  const [accountSidebarOpen, setAccountSidebarOpen] = useState(false)
  useEffect(() => {
    const onState = (e: Event) => setAccountSidebarOpen(!!(e as CustomEvent<boolean>).detail)
    window.addEventListener('dm:account-sidebar-state', onState)
    return () => window.removeEventListener('dm:account-sidebar-state', onState)
  }, [])

  // The account sidebar's Logout asks the navbar to run the sign-out flow.
  const logoutRef = useRef<(() => Promise<void>) | null>(null)
  useEffect(() => {
    const onLogout = () => { void logoutRef.current?.() }
    window.addEventListener('dm:logout', onLogout)
    return () => window.removeEventListener('dm:logout', onLogout)
  }, [])

  // Mobile: the bar floats transparent over the hero at the very top ONLY
  // on the homepage. Marketplace/category pages (which have a sub-navbar)
  // keep the solid bar so the two-bar unit reads as one solid block.
  const overHero = pathname === '/'
  // Marketplace category pages (/{game}/{category}) render GameSubNav right
  // below the navbar. On those, the navbar drops its bottom hairline so the
  // navbar + sub-nav merge into one seamless solid block on mobile.
  const hasSubNav = /^\/[^/]+\/[^/]+$/.test(pathname || '')
  const [menuRoot, setMenuRoot] = useState<'account' | 'browse'>('browse')
  useEffect(() => {
    if (mobileMenuOpen) setMenuRoot(inAccountArea && user ? 'account' : 'browse')
  }, [mobileMenuOpen, inAccountArea, user])

  // Admin-curated spotlight games for the mobile menu grid. Only fetched
  // once the menu opens so it costs nothing for users who never open it.
  const { data: spotlightGames = [] } = useSpotlightGames()

  // Live filter for the category sub-screen's game list. Cleared whenever
  // the sub-screen changes (or the whole menu closes) so each category
  // opens on a fresh, unfiltered list.
  const [mobileGameSearch, setMobileGameSearch] = useState('')
  useEffect(() => {
    setMobileGameSearch('')
  }, [mobileMenuTab])

  // Homepage hero chips (and future surfaces) deep-open the menu at a
  // category sub-screen via this event — app-like, no route hop. From md up
  // the category menus are the desktop dropdowns, so it opens that instead.
  useEffect(() => {
    const onOpenCategory = (e: Event) => {
      const tabId = (e as CustomEvent<string>).detail
      if (!NAV_TABS.some((t) => t.id === tabId)) return
      if (window.matchMedia('(min-width: 768px)').matches) {
        setActiveDropdown(tabId)
        return
      }
      setMobileMenuTab(tabId)
      setMobileMenuOpen(true)
    }
    window.addEventListener('dm:open-category', onOpenCategory)
    return () => window.removeEventListener('dm:open-category', onOpenCategory)
  }, [])

  // Lock body scroll while the mobile menu is open — otherwise the page
  // scrolls behind the fixed panel and the user loses their place.
  useEffect(() => {
    if (!mobileMenuOpen) return
    return lockScroll()
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
    return lockScroll()
  }, [notificationsOpen, activityOpen, userMenuOpen])

  // The navbar is always the full-width bar, pinned at every width (the
  // floating pill and hide-on-scroll are both retired). The only state is
  // whether it paints a fill: everywhere except the homepage it is filled
  // from the start (`overHero` is false).
  //
  // On the homepage the hero is a scroll film (two full-screen beats), so
  // "the page moved" is the wrong trigger: the bar would fill over the
  // hero's own art. It stays transparent until the first rendered
  // `data-nav-fill-at` marker is about to slide under it — the statement's
  // SafeDrop line, so the fill arrives before that text meets the bar
  // (Popular Games carries a marker too, as the fallback when the statement
  // isn't rendered, e.g. reduced motion). No marker → plain scroll threshold.
  const [pastHero, setPastHero] = useState(false)
  useEffect(() => {
    if (!overHero) return
    let frame = 0
    const check = () => {
      frame = 0
      // First marker that is actually laid out (display:none has no boxes).
      const marker = Array.from(document.querySelectorAll('[data-nav-fill-at]')).find(
        (el) => el.getClientRects().length > 0,
      )
      if (!marker) {
        setPastHero(window.scrollY > 40)
        return
      }
      const barHeight =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 60
      // A little lead, so the fill is in place before the text reaches it.
      setPastHero(marker.getBoundingClientRect().top <= barHeight + 24)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [overHero, pathname])

  // The one case where the bar paints nothing: over the homepage hero,
  // until Popular Games reaches it.
  const transparentOverHero = overHero && !forceScrolled && !pastHero

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
    // A `.then()` with no `.catch()` here was JAVASCRIPT-NEXTJS-5: on a flaky
    // mobile connection the server-action POST rejects with WebKit's opaque
    // "TypeError: Load failed" and, with nothing handling it, reaches Sentry as
    // an unhandled rejection. Offline Mode is an enrichment — degrade to the
    // safe default (store online) rather than break the navbar.
    void safeBackground(() => getMyStorePaused(), false, 'navbar:storePaused').then((v) => {
      if (active) setOfflineMode(v)
    })
    return () => { active = false }
  }, [user?.id, user?.isApprovedSeller])

  // V21/P7.ae — Toggle store online/offline. Optimistic flip with
  // rollback on failure.
  const toggleOfflineMode = useCallback(async () => {
    if (pendingOffline) return
    const next = !offlineMode
    setOfflineMode(next)
    setPendingOffline(true)
    // A rejected POST here (same "Load failed" transport failure) would skip
    // setPendingOffline(false) and leave the toggle permanently stuck, so the
    // network failure degrades into the existing rollback path.
    const res = await safeBackground(
      () => setStorePaused(next),
      { success: false as const },
      'navbar:setStorePaused',
    )
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
        .select('*', { count: 'exact' })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false).limit(1)

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
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false)
        // Workstream E — chat messages live under the Messages badge, not the
        // bell. Exclude legacy 'new_message' rows so they stop polluting the
        // bell count.
        .neq('type', 'new_message').limit(1)

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
          .select('id, order_number, status, total_amount, created_at, listing:listings!orders_listing_id_fkey(title, game:games(slug, image_url))')
          .eq('buyer_id', user.id)
          .in('status', ACTIVE_BUYING)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, listing:listings!orders_listing_id_fkey(title, game:games(slug, image_url))')
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
  // Ledger-backed store credit (wallet-ledger); the legacy wallet_balances
  // float table is archived and must not be read.
  const { data: navWalletBalance } = useQuery({
    queryKey: ['wallet-balance-navbar', user?.id],
    queryFn: async () => {
      const result = await getMyWalletBalance()
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
  // Shared with the homepage hero search (same key, one cached fetch).
  const { data: navCatsData } = useQuery({
    ...navCategoriesQuery,
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
      const type = cat.type
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

  // Sign-out, shared by the user menu below and the account sidebar's Logout
  // (which dispatches `dm:logout`, the same way it toggles via
  // `dm:toggle-account-sidebar`), so both show the same overlay and redirect.
  const performLogout = async () => {
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
  }
  logoutRef.current = performLogout

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
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--color-bg-raised)_80%,transparent)] ring-1 ring-white/10">
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
      <nav
        style={{ top: 'var(--chrome-top)' }}
        className="fixed left-0 right-0 z-50 flex justify-center"
      >
        <div className="w-full">
          <div
            ref={navBarRef}
            className={cn(
              'relative flex items-center justify-between gap-2 border-x-0 border-t-0 px-3 py-2 sm:gap-3 sm:px-6',
              'transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out',
              // App-shell mobile bar: fixed 60px, square, edge-to-edge.
              'max-lg:h-[60px] max-lg:py-0',
              // Transparent over the homepage hero film until Popular Games
              // reaches the bar, so the art reads behind the chrome. A scrim
              // below keeps the logo and icons legible on bright art.
              // max-sm:backdrop-blur-0 is invisible but load-bearing: any
              // backdrop-filter makes this bar the containing block for its
              // `fixed top-full` phone sheets (profile, notifications,
              // activity), so they hang flush under the bar. Without it, at
              // the top of the homepage `top-full` resolved against the
              // viewport and the sheet opened below the bottom of the screen.
              transparentOverHero
                ? 'border-b border-b-transparent bg-transparent shadow-none max-sm:backdrop-blur-0'
                : cn(
                    'border-b backdrop-blur-2xl backdrop-saturate-150',
                    // Pages with a sub-navbar drop the hairline so navbar +
                    // sub-nav read as one block with a single bottom edge.
                    hasSubNav ? 'border-b-transparent' : 'border-b-[rgba(255,255,255,0.08)]',
                    'bg-[var(--navbar-bg,rgba(29,30,35,0.78))]',
                    'shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_8px_24px_-12px_rgba(0,0,0,0.7)]',
                  ),
            )}
          >
            {/* Legibility scrim — only while the bar is transparent over the
                hero. Keeps the logo and icons readable on bright art. */}
            {transparentOverHero && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[140%] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent)]"
              />
            )}

            {/* App-shell — Mobile Menu Button now sits LEFT of the logo
                below lg ([hamburger][logo+wordmark]…). lg:hidden means the
                desktop DOM renders nothing here, exactly as before (the
                hamburger previously lived at the end of the right cluster,
                also lg:hidden). 44px touch target; visible through lg (not
                md) so 760-1023px tablets keep the in-menu search. */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-[8px] text-gray-300 transition-transform transition-duration-[120ms] hover:bg-white/10 hover:text-white active:scale-[0.96] active:brightness-95 lg:hidden"
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
              {accountSidebarAvailable && user ? (
                // Account pages: a real panel toggle that morphs with the
                // drawer state (GameBoost-style), animated via framer.
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={accountSidebarOpen ? 'panel-close' : 'panel-open'}
                    initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="grid"
                  >
                    {accountSidebarOpen ? (
                      <PanelLeftClose className="h-[18px] w-[18px]" />
                    ) : (
                      <PanelLeftOpen className="h-[18px] w-[18px]" />
                    )}
                  </motion.span>
                </AnimatePresence>
              ) : mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
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
                src="/brand/logo-mark-white.avif"
                alt="DropMarket"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 max-lg:h-7 max-lg:w-7"
              />
              <span className="inline-block font-bold text-white max-lg:text-[15px]">DropMarket</span>
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
                    showPill={activeDropdown ? activeDropdown === tab.id : currentNavTabId === tab.id}
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
                  <div className="h-10 w-10 animate-pulse rounded-[8px] bg-white/10 max-lg:h-9 max-lg:w-9" />
                  <div className="h-10 w-10 animate-pulse rounded-[8px] bg-white/10 max-lg:h-9 max-lg:w-9" />
                  <div className="h-10 w-10 animate-pulse rounded-[8px] bg-white/10 max-lg:h-9 max-lg:w-9" />
                </>
              )}

              {user && (
                <>
                  {/* Phones: straight to Messages (desktop has its own link
                      below, after the bell). */}
                  <NavIconButton
                    href="/account/messages"
                    icon={ChatCircleDotsIcon}
                    label="Messages"
                    count={unreadCount}
                    className="lg:hidden"
                  />

                  {/* Notifications */}
                  <div className="relative" data-dropdown>
                    <NavIconButton
                      icon={BellIcon}
                      label="Notifications"
                      count={unreadNotificationCount}
                      active={notificationsOpen}
                      onClick={() => {
                        setNotificationsOpen(!notificationsOpen)
                        setActivityOpen(false)
                        setUserMenuOpen(false)
                        setMobileMenuOpen(false)
                      }}
                    />

                    {notificationsOpen && (
                      <NavPanel onClose={() => setNotificationsOpen(false)}>
                        <NavPanelHeader
                          title="Notifications"
                          aside={
                            unreadNotificationCount > 0 ? (
                              <span className="inline-flex h-6 items-center rounded-md bg-white/[0.07] px-2 text-[12px] font-semibold tabular-nums text-text-secondary">
                                {unreadNotificationCount} Unread
                              </span>
                            ) : undefined
                          }
                        />

                        {recentNotifications.length === 0 ? (
                          <div className="py-12 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/characters/sleepy-pup.webp"
                              alt=""
                              aria-hidden
                              width={112}
                              height={112}
                              className="mx-auto mb-3 h-28 w-auto select-none object-contain"
                            />
                            <p className="text-[14.5px] font-semibold text-text-primary">You&apos;re all caught up!</p>
                            <p className="mt-1 text-[13px] text-text-tertiary">No new notifications</p>
                          </div>
                        ) : (
                          <div className="min-h-0 max-h-[420px] space-y-1 overflow-y-auto overscroll-contain px-2.5 pb-2.5 pt-2">
                            {recentNotifications.map((notification: any) => (
                              <div key={notification.id} className="group relative rounded-[8px] transition-colors hover:bg-white/[0.05]">
                                <Link
                                  href={safeInternalPath(notification.link)}
                                  onClick={() => {
                                    markAsRead(notification.id)
                                    setNotificationsOpen(false)
                                  }}
                                  className="flex items-start gap-3.5 rounded-[8px] px-3 py-3 pr-11 focus-visible:bg-white/[0.05] focus-visible:outline-none"
                                >
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white/[0.06] text-text-secondary">
                                    <BellIcon size={17} weight="bold" aria-hidden />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[14px] font-semibold text-text-primary">
                                      {notification.title}
                                    </span>
                                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-text-secondary">
                                      {notification.message}
                                    </span>
                                    <span className="mt-1 block text-[12px] text-text-tertiary">
                                      {new Date(notification.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </span>
                                </Link>
                                {/* Dismiss: a sibling of the link (a button
                                    can't live inside an anchor). Shows on
                                    hover/focus with a mouse; always on touch. */}
                                <button
                                  type="button"
                                  aria-label="Dismiss notification"
                                  className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-[6px] text-text-tertiary transition-[opacity,background-color,color] hover:bg-white/10 hover:text-text-primary focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <XIcon size={14} weight="bold" aria-hidden />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="shrink-0 border-t border-white/[0.07] p-2.5">
                          <Link
                            href="/notifications"
                            onClick={() => setNotificationsOpen(false)}
                            className="flex h-10 items-center justify-center rounded-[8px] text-[13.5px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                          >
                            View All Notifications
                          </Link>
                        </div>
                      </NavPanel>
                    )}
                  </div>

                  {/* Messages — desktop (phones use the shortcut above). */}
                  <NavIconButton
                    href="/account/messages"
                    icon={ChatCircleDotsIcon}
                    label="Messages"
                    count={unreadCount}
                    className="hidden lg:grid"
                  />

                  {/* Live Orders */}
                  <div className="relative" data-dropdown>
                    <NavIconButton
                      icon={ReceiptIcon}
                      label="Live Orders"
                      count={totalActiveOrders}
                      active={activityOpen}
                      onClick={() => {
                        setActivityOpen(!activityOpen)
                        setNotificationsOpen(false)
                        setUserMenuOpen(false)
                        setMobileMenuOpen(false)
                      }}
                    />

                    {activityOpen && (
                      <NavPanel onClose={() => setActivityOpen(false)}>
                        <NavPanelHeader
                          title="Live Orders"
                          aside={
                            <Link
                              href="/account/orders"
                              onClick={() => setActivityOpen(false)}
                              className="group inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                            >
                              View All
                              <CaretRightIcon size={11} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          }
                        />

                        {/* One view: Buying above Selling; a section renders
                            only when it has orders. */}
                        {activeOrders.buying.length === 0 && activeOrders.selling.length === 0 ? (
                          <div className="py-12 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/characters/box-cat.webp"
                              alt=""
                              aria-hidden
                              width={112}
                              height={112}
                              className="mx-auto mb-3 h-28 w-auto select-none object-contain"
                            />
                            <p className="text-[14.5px] font-semibold text-text-primary">No active orders</p>
                            <p className="mt-1 text-[13px] text-text-tertiary">Orders in progress will appear here</p>
                          </div>
                        ) : (
                          <div className="min-h-0 max-h-[460px] overflow-y-auto overscroll-contain px-2.5 pb-2.5 pt-2">
                            {[
                              { title: 'Buying', orders: activeOrders.buying },
                              { title: 'Selling', orders: activeOrders.selling },
                            ]
                              .filter((section) => section.orders.length > 0)
                              .map((section, i) => (
                                <div key={section.title} className={cn(i > 0 && 'mt-2 border-t border-white/[0.07] pt-2')}>
                                  <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2 text-[12.5px] font-medium text-text-tertiary">
                                    {section.title}
                                    <span className="tabular-nums">({section.orders.length})</span>
                                  </div>
                                  <div className="space-y-1">
                                    {section.orders.map((order: any) => (
                                      <LiveOrderRow key={order.id} order={order} onNavigate={() => setActivityOpen(false)} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </NavPanel>
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
                <div className="h-10 w-10 animate-pulse rounded-full bg-white/10 max-lg:h-9 max-lg:w-9 lg:w-[62px] lg:rounded-[8px]" />
              ) : user ? (
                <div className="relative" data-dropdown>
                  {/* Avatar + caret on desktop, avatar alone on phones. */}
                  <button
                    type="button"
                    aria-label="Account menu"
                    aria-expanded={userMenuOpen}
                    onClick={() => {
                      setUserMenuOpen(!userMenuOpen)
                      setNotificationsOpen(false)
                      setActivityOpen(false)
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      'group flex h-10 items-center gap-1.5 rounded-[8px] p-1 transition-[background-color,transform] duration-150 hover:bg-white/[0.07] active:scale-[0.96] lg:pr-2',
                      'max-lg:h-9 max-lg:w-9 max-lg:justify-center max-lg:rounded-full max-lg:p-0',
                      userMenuOpen && 'bg-white/[0.09]',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-white/15"
                    />
                    <CaretDownIcon
                      size={12}
                      weight="bold"
                      aria-hidden
                      className={cn(
                        'hidden text-white/55 transition-[transform,color] duration-200 group-hover:text-white/85 lg:block',
                        userMenuOpen && 'rotate-180 text-white/85',
                      )}
                    />
                  </button>

                  {userMenuOpen && (
                    <NavPanel
                      onClose={() => setUserMenuOpen(false)}
                      width="sm:w-[340px]"
                      position="sm:-right-6 sm:mt-[25px]"
                    >
                      <ProfileMenu
                        user={user}
                        isAdmin={isAdmin}
                        walletBalance={navWalletBalance != null ? Number(navWalletBalance.available_balance ?? 0) : null}
                        unreadMessages={unreadCount}
                        offlineMode={offlineMode}
                        pendingOffline={pendingOffline}
                        onToggleOffline={toggleOfflineMode}
                        onNavigate={() => setUserMenuOpen(false)}
                        onLogout={() => void performLogout()}
                      />
                    </NavPanel>
                  )}
                </div>
              ) : (
                // V17 — Buttons open the AuthDialog modal instead of
                // navigating to /login or /signup. Modal handles the
                // smooth in/out transition; URL stays at the current
                // page so the user never loses their browsing context.
                <div className="flex items-center gap-2">
                  {/* Log In shows at every width (owner call 2026-09-28):
                      returning buyers on phones shouldn't have to find it
                      inside the Sign Up dialog. Tighter padding on phones
                      so both fit beside the logo. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => authDialog.open('login')}
                    className="inline-flex h-9 rounded-[8px] px-2.5 text-gray-300 hover:bg-white/10 hover:text-white sm:px-3"
                  >
                    Log In
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => authDialog.open('signup')}
                    className="h-9 rounded-[8px] bg-white px-3 text-black hover:bg-white/90 font-medium"
                  >
                    Sign Up
                  </Button>
                </div>
              )}

              {/* App-shell — Mobile Menu Button moved to the far LEFT of
                  the bar (before the logo, above) for the
                  [hamburger][logo]……[bell][avatar] mobile order. */}
            </div>
          </div>
        </div>
      </nav>

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
              <div className="relative flex h-full flex-col overflow-hidden bg-[var(--color-bg-base)] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.9)]">

                {/* Header: the navbar's own wordmark (white, no lime) + a close
                    button on a quiet fill. Same 60px as the bar it replaces. */}
                <div className="relative z-10 flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
                  <Link
                    href="/"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setMobileMenuTab(null)
                    }}
                    className="flex items-center gap-2.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/logo-mark-white.avif" alt="" width={96} height={96} className="h-7 w-7" />
                    <span className="text-[16px] font-bold tracking-[-0.01em] text-white">DropMarket</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setMobileMenuTab(null)
                    }}
                    aria-label="Close menu"
                    className="grid h-10 w-10 place-items-center rounded-md bg-white/[0.06] text-white/75 transition-[background-color,color,transform] hover:bg-white/[0.10] hover:text-white active:scale-95"
                  >
                    <X aria-hidden className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {/* SCREEN 1 — service index. */}
                  <div
                    aria-hidden={mobileMenuTab !== null}
                    className={cn(
                      'absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-8 pt-6 transition-transform transition-duration-[320ms] ease-gv [-webkit-overflow-scrolling:touch]',
                      mobileMenuTab !== null && 'pointer-events-none -translate-x-full',
                    )}
                  >
                    <RevealGroup className="space-y-7">
                    {/* ACCOUNT ROOT — retained for the account-aware menu path. */}
                    {menuRoot === 'account' && (
                      <RevealItem>
                        <section>
                          <div className="mb-2.5 px-1">
                            <h2 className="text-[15px] font-semibold text-white">My Account</h2>
                            <p className="mt-0.5 text-[12.5px] text-text-tertiary">Manage your DropMarket account</p>
                          </div>
                          <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
                            {ACCOUNT_MENU_ITEMS.filter((i) => !i.sellerOnly || user?.isApprovedSeller).map(
                              ({ label, href, Icon }) => (
                                <Link
                                  key={href}
                                  href={href}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="group flex min-h-[56px] w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
                                >
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-bg-overlay">
                                    <Icon className="h-[18px] w-[18px] text-white/80" aria-hidden />
                                  </span>
                                  <span className="flex-1 truncate text-[15px] font-medium text-white">{label}</span>
                                  <ChevronRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
                                </Link>
                              ),
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setMenuRoot('browse')}
                            className="group mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-lg bg-bg-raised px-3.5 text-left transition-colors hover:bg-bg-raised-hover"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-bg-overlay">
                              <LayoutGrid className="h-[18px] w-[18px] text-white/80" aria-hidden />
                            </span>
                            <span className="flex-1 text-[15px] font-medium text-white">Browse Marketplace</span>
                            <ChevronRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
                          </button>
                        </section>
                      </RevealItem>
                    )}

                    {menuRoot === 'browse' && spotlightGames.length > 0 && (
                      <RevealItem>
                        {/* Popular Games — admin-curated (games.is_spotlight).
                            One card, hairlines between games; each game shows
                            its sections as slim pills. */}
                        <section>
                          <h2 className="mb-2.5 px-1 text-[15px] font-semibold text-white">Popular Games</h2>
                          <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
                            {spotlightGames.slice(0, 4).map((game) => (
                              <div key={game.slug} className="group flex items-center gap-3 px-3.5 py-3">
                                {/* Pills sit OUTSIDE the game Link (anchors
                                    can't nest) but visually inside the row. */}
                                <Link
                                  href={game.href}
                                  onClick={() => {
                                    setMobileMenuOpen(false)
                                    setMobileMenuTab(null)
                                  }}
                                  className="flex shrink-0 items-center"
                                  aria-label={game.name}
                                >
                                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-bg-overlay ring-1 ring-white/[0.08]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={game.iconSrc}
                                      alt=""
                                      width={44}
                                      height={44}
                                      loading="lazy"
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                  </span>
                                </Link>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={game.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false)
                                      setMobileMenuTab(null)
                                    }}
                                    className="block truncate text-[15px] font-semibold leading-tight text-white"
                                  >
                                    {game.name}
                                  </Link>
                                  {game.categoryLinks.length > 0 && (
                                    <div className="mt-1.5 flex flex-nowrap gap-1.5 overflow-hidden">
                                      {game.categoryLinks.slice(0, 3).map((cat) => (
                                        <Link
                                          key={cat.slug}
                                          href={`/${game.slug}/${cat.slug}`}
                                          onClick={() => {
                                            setMobileMenuOpen(false)
                                            setMobileMenuTab(null)
                                          }}
                                          className="inline-flex h-6 shrink-0 items-center rounded-md bg-white/[0.07] px-2 text-[12px] font-medium leading-none text-text-secondary transition-[background-color,color,transform] hover:bg-white/[0.12] hover:text-white active:scale-[0.97]"
                                        >
                                          <span className="max-w-[84px] truncate">
                                            {cat.label.replace(/\s*\(.*?\)\s*/g, '')}
                                          </span>
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <Link
                                  href={game.href}
                                  onClick={() => {
                                    setMobileMenuOpen(false)
                                    setMobileMenuTab(null)
                                  }}
                                  aria-hidden
                                  tabIndex={-1}
                                  className="grid h-8 w-6 shrink-0 place-items-center"
                                >
                                  <ChevronRight aria-hidden className="h-4 w-4 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/75" />
                                </Link>
                              </div>
                            ))}
                          </div>
                        </section>
                      </RevealItem>
                    )}

                    {menuRoot === 'browse' && (
                      <RevealItem>
                        <section>
                          <div className="mb-2.5 px-1">
                            <h2 className="text-[15px] font-semibold text-white">Services</h2>
                            <p className="mt-0.5 text-[12.5px] text-text-tertiary">Everything you need to play more</p>
                          </div>
                          <div className="divide-y divide-white/[0.07] overflow-hidden rounded-lg bg-bg-raised">
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
                        </section>
                      </RevealItem>
                    )}

                    <RevealItem>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href="/account/wallet"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex h-10 items-center justify-center gap-2 rounded-md bg-bg-raised text-[13px] font-semibold text-white/80 transition-colors hover:bg-bg-raised-hover hover:text-white"
                        >
                          <Wallet className="h-4 w-4" aria-hidden /> Wallet
                        </Link>
                        <Link
                          href="/support"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex h-10 items-center justify-center gap-2 rounded-md bg-bg-raised text-[13px] font-semibold text-white/80 transition-colors hover:bg-bg-raised-hover hover:text-white"
                        >
                          <LifeBuoy className="h-4 w-4" aria-hidden /> Support
                        </Link>
                      </div>

                      {!loading && !user && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false)
                              authDialog.open('login')
                            }}
                            className="h-10 rounded-md bg-bg-raised text-[13px] font-semibold text-white transition-colors hover:bg-bg-raised-hover"
                          >
                            Log In
                          </button>
                          {/* Same white Sign Up as the navbar bar. */}
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false)
                              authDialog.open('signup')
                            }}
                            className="h-10 rounded-md bg-white text-[13px] font-semibold text-black transition-colors hover:bg-white/90"
                          >
                            Sign Up
                          </button>
                        </div>
                      )}
                    </RevealItem>
                    </RevealGroup>
                  </div>

                  {/* SCREEN 2 — game list. */}
                  {(() => {
                    const tab = NAV_TABS.find((t) => t.id === mobileMenuTab)
                    const allEntries = tab ? gamesByType[tab.type] || [] : []
                    const needle = mobileGameSearch.trim().toLowerCase()
                    const entries = needle
                      ? allEntries.filter(({ game }) =>
                          game.name.toLowerCase().includes(needle) ||
                          game.slug.toLowerCase().includes(needle),
                        )
                      : allEntries
                    return (
                      <div
                        aria-hidden={mobileMenuTab === null}
                        className={cn(
                          'absolute inset-0 flex flex-col bg-[var(--color-bg-base)] transition-transform transition-duration-[320ms] ease-gv',
                          mobileMenuTab === null && 'pointer-events-none translate-x-full',
                        )}
                      >
                        {/* Header (GameBoost pattern, owner 2026-09-28): "← Items"
                            on its own row, then a full-width RECTANGULAR search
                            over this category's games. */}
                        <div className="shrink-0 px-4 pb-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setMobileMenuTab(null)}
                            aria-label="Back To Menu"
                            className="-ml-1 flex h-11 items-center gap-3 pr-2 text-white transition-colors active:scale-[0.98]"
                          >
                            <ArrowLeft className="h-5 w-5 text-white/70" />
                            <span className="text-[17px] font-semibold">{tab?.label ?? 'Games'}</span>
                          </button>
                          <div className="relative mt-1 flex h-10 items-center overflow-hidden rounded-md bg-bg-raised ring-1 ring-transparent transition-shadow focus-within:ring-white/20">
                            <Search aria-hidden className="pointer-events-none absolute left-3 h-[17px] w-[17px] text-white/45" />
                            <input
                              type="search"
                              value={mobileGameSearch}
                              onChange={(e) => setMobileGameSearch(e.target.value)}
                              placeholder="Search for a game"
                              aria-label={`Search ${tab?.label ?? 'games'}`}
                              className="h-full w-full bg-transparent pl-10 pr-3 text-[16px] text-white outline-none placeholder:text-white/45 [&::-webkit-search-cancel-button]:hidden"
                            />
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [-webkit-overflow-scrolling:touch]">
                          {entries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <Search className="mb-2 h-5 w-5 text-white/30" />
                              <p className="text-[13px] text-white/45">{needle ? 'No matches' : 'No games here yet'}</p>
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
                                // Clean rows: no divider lines, no counts, just the
                                // game and an arrow (owner, 2026-09-28).
                                className="group -mx-2 flex h-14 items-center gap-3 rounded-md px-2 transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
                              >
                                {game.image_url && game.image_url !== '' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={game.image_url} alt="" className="h-9 w-9 shrink-0 rounded-[8px] object-cover ring-1 ring-white/[0.10]" />
                                ) : (
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white/[0.08] text-[9px] font-bold text-white/45">
                                    {game.name.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                                <span className="flex-1 truncate text-[15px] font-medium text-white/85">{game.name}</span>
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

      {/* Spacer — clears the fixed bar so page content starts below it.
          The homepage skips it on purpose: there the bar is a transparent
          overlay and the hero art runs up behind it to the top of the page. */}
      {!overHero && <div className="h-[60px] lg:h-[84px]" />}
    </>
  )
}

// Category Dropdown Component
function CategoryDropdown({
  tab,
  gameEntries,
  isActive,
  isCurrent = false,
  showPill = false,
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
  /** The shared highlight sits on this tab: the open one, else the current
   *  page's. One pill (layoutId) slides between tabs. */
  showPill?: boolean
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
  const reduceMotion = useReducedMotion()

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
          aria-expanded={isActive}
          className={cn(
            'relative flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3.5 text-[14px] font-medium transition-colors',
            showPill || isCurrent ? 'text-white' : 'text-white/75 hover:text-white',
          )}
        >
          {showPill && (
            <motion.span
              layoutId="nav-tab-pill"
              aria-hidden
              className="absolute inset-0 rounded-[8px] bg-white/[0.08]"
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
            />
          )}
          <span className="relative">{tab.label}</span>
          <CaretDownIcon
            size={12}
            weight="bold"
            aria-hidden
            className={cn('relative text-white/50 transition-transform duration-200', isActive && 'rotate-180 text-white/80')}
          />
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
            {/* V53 — OPAQUE surface. This was rgba(10,10,15,0.92) + blur to
                read as glass, but the 8% that came through was enough to show
                the hero headline and cover art straight through the menu, and
                the backdrop-blur that was supposed to mush it isn't engaging
                here (the menu is portalled beneath framer-transformed navbar
                ancestors, which resets the backdrop root). Rather than fight
                the backdrop root, the fill is now solid — transparency becomes
                impossible regardless of what's behind it. blur/saturate
                dropped with it: both are inert once the fill is opaque (same
                reasoning as the mobile menu surface above). */}
            <div
              // data-dropdown marks the portalled content as "inside" for the
              // document-level outside-tap handler in Navbar — taps/clicks
              // inside the mega-menu stay open, anywhere else dismisses it
              // (the touch counterpart of the mouseleave debounce).
              data-dropdown
              className="w-[min(960px,92vw)] overflow-hidden rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_56px_-16px_rgba(0,0,0,0.85)]"
              style={{ backgroundColor: 'var(--navbar-dropdown-bg, #1D1E23)' }}
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
              <div className="grid min-h-[min(480px,62dvh)] grid-cols-1 items-stretch md:grid-cols-[252px_1fr]">
                {/* LEFT — Popular: a darker well so the two halves read
                    apart without an outline. */}
                <div className="bg-bg-well p-3">
                  <div className="px-2.5 pb-2 pt-1.5 text-[13px] font-semibold text-text-tertiary">
                    Popular
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {popular.map(({ game, categorySlug }) => (
                      <li key={game.slug}>
                        {/* SmartLink fixes the scroll-to-top glitch on
                            same-route navigations. */}
                        <SmartLink
                          href={`/${game.slug}/${categorySlug}`}
                          onClick={onSelect}
                          className="group flex items-center gap-3 rounded-[8px] p-2 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                        >
                          {game.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={game.image_url}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 shrink-0 rounded-[8px] object-contain"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.07] text-[12px] font-bold text-text-secondary">
                              {game.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-text-primary">
                            {game.name}
                          </span>
                          <CaretRightIcon
                            size={12}
                            weight="bold"
                            aria-hidden
                            className="shrink-0 -translate-x-1 text-text-tertiary opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                          />
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* RIGHT — Searchable */}
                <div className="flex max-h-[min(480px,62dvh)] flex-col p-4">
                  <div className="relative mb-3">
                    <MagnifyingGlassIcon
                      size={16}
                      weight="bold"
                      aria-hidden
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      name="nav-game-search"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`Search ${tab.label} games`}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search Games…"
                      className="h-10 w-full rounded-md bg-white/[0.05] pl-10 pr-3 text-[14px] text-white outline-none transition-colors placeholder:text-text-tertiary focus:bg-white/[0.08] focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <div className="text-[13px] font-semibold text-text-tertiary">All Games</div>
                    <div className="text-[12.5px] tabular-nums text-text-tertiary">
                      {filtered.length} {filtered.length === 1 ? 'Game' : 'Games'}
                    </div>
                  </div>
                  <div className="-mr-1 flex-1 overflow-y-auto overscroll-contain pr-1">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <MagnifyingGlassIcon size={20} weight="bold" aria-hidden className="mb-2 text-text-tertiary" />
                        <p className="text-[13.5px] text-text-tertiary">
                          No games match &ldquo;{q}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-2 gap-0.5 lg:grid-cols-3">
                        {filtered.map(({ game, categorySlug }) => (
                          <li key={game.slug}>
                            <SmartLink
                              href={`/${game.slug}/${categorySlug}`}
                              onClick={onSelect}
                              className="group flex items-center gap-2.5 rounded-[8px] p-2 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                            >
                              {game.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={game.image_url}
                                  alt=""
                                  width={32}
                                  height={32}
                                  loading="lazy"
                                  className="h-8 w-8 shrink-0 rounded-md object-contain"
                                />
                              ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.07] text-[11px] font-bold text-text-secondary">
                                  {game.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate text-[14px] font-medium text-text-secondary transition-colors group-hover:text-text-primary">
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
function categoryFallbackIcon(
  type: string | undefined,
  slug: string,
): string | null {
  const key = (type || slug || '')
    .toLowerCase()
    .replace(/^buy-/, '')
  // New house set lives in /public/icons/categories/ (single-color glyphs,
  // rendered platinum via CSS mask below). gift-cards/limiteds have no new
  // art yet, so they fall back to the legacy colored set.
  const map: Record<string, string> = {
    currency: '/icons/categories/currency.svg',
    items: '/icons/categories/items.svg',
    item: '/icons/categories/items.svg',
    account: '/icons/categories/accounts.svg',
    accounts: '/icons/categories/accounts.svg',
    service: '/icons/categories/boosting.svg',
    boosting: '/icons/categories/boosting.svg',
    boost: '/icons/categories/boosting.svg',
    top_up: '/icons/categories/top-up.svg',
    'top-up': '/icons/categories/top-up.svg',
    topup: '/icons/categories/top-up.svg',
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
        row.slug
          .replace(/^buy-/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
      // V21/P7.u — Icon resolution: admin-uploaded currency_icon_url
      // first (keyed by game_id:category_type), else a static
      // placeholder SVG by category type from
      // /public/assets/category-icons/. Replace those SVGs to swap the
      // default per-category art.
      const catType = row.type as string | undefined
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

  // Stable id linking the search combobox to the results listbox it controls.
  const listboxId = useId()

  return (
    <motion.div
      ref={containerRef}
      layout
      className={cn('relative', expanded && 'w-full')}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
    >
      <div className="relative">
        <MagnifyingGlassIcon
          size={18}
          weight="bold"
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/55"
        />
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
          // role=combobox: aria-expanded/aria-autocomplete are not valid on the
          // input's implicit `textbox` role. This input is the search combobox
          // trigger, so declaring the role is the accurate fix.
          role="combobox"
          aria-controls={listboxId}
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
            // Fill only (no resting border), like every other field.
            'h-10 rounded-[8px] pl-11 text-[14px] text-white placeholder:text-white/45 outline-none transition-[background-color,box-shadow] focus:outline-none focus-visible:shadow-none',
            expanded
              ? 'w-full bg-white/[0.07] pr-11 ring-1 ring-white/15'
              : cn(
                  'w-56 cursor-pointer pr-3 xl:w-72',
                  focused ? 'bg-white/[0.09] ring-1 ring-white/15' : 'bg-white/[0.06] hover:bg-white/[0.08]',
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
            id={listboxId}
            role="listbox"
            // CSS entrance, not framer (rAF-stall class).
            // V53 — Opaque, matching the mega-menu fix above: this sits in the
            // same transformed navbar subtree, so its backdrop-blur doesn't
            // engage either and the 6% it let through showed page content
            // behind the results. Width tracks the bar: full when expanded,
            // fixed when collapsed.
            className={cn(
              'animate-fade-in absolute top-full mt-2 overflow-hidden rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_56px_-16px_rgba(0,0,0,0.85)]',
              expanded ? 'inset-x-0' : 'right-0 w-[440px]',
            )}
            style={{ backgroundColor: 'var(--navbar-dropdown-bg, #1D1E23)' }}
          >
            <div className="max-h-[420px] overflow-y-auto p-2">
              {searching && !hasResults ? (
                // V21/P7.v — In-flight: spinner, never a premature "no
                // matches". The empty state only shows once the search
                // settles with nothing found.
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="mb-2.5 h-6 w-6 animate-spin rounded-full border-2 border-white/[0.12] border-t-white/70" />
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
                                      'flex w-full items-center justify-between gap-3 rounded-[8px] py-2.5 pl-2.5 pr-2.5 text-left transition-colors',
                                      highlighted ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
                                    )}
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      {/* Category icon, indented under the game.
                                          New house-set glyphs (single-color) render
                                          platinum via CSS mask; admin/legacy art
                                          stays a colored image. */}
                                      <span className="ml-8 flex h-7 w-7 shrink-0 items-center justify-center">
                                        {c.iconUrl ? (
                                          c.iconUrl.startsWith('/icons/categories/') ? (
                                            <span
                                              aria-hidden
                                              className="h-[18px] w-[18px] bg-[linear-gradient(180deg,#ffffff,#d8dde1)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
                                              style={{
                                                maskImage: `url(${c.iconUrl})`,
                                                WebkitMaskImage: `url(${c.iconUrl})`,
                                                maskSize: 'contain',
                                                WebkitMaskSize: 'contain',
                                                maskRepeat: 'no-repeat',
                                                WebkitMaskRepeat: 'no-repeat',
                                                maskPosition: 'center',
                                                WebkitMaskPosition: 'center',
                                              }}
                                            />
                                          ) : (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                              src={c.iconUrl}
                                              alt=""
                                              className="h-7 w-7 rounded-md object-contain"
                                            />
                                          )
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
                                      'flex w-full items-center justify-between gap-3 rounded-[8px] py-2.5 pl-2.5 pr-2.5 text-left transition-colors',
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
