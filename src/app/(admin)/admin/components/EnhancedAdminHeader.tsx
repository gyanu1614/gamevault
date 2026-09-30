'use client'

/**
 * V56 — Admin header, full rehaul.
 *
 * Built for speed: everything a mod needs within one keystroke or one
 * click, aligned on a strict 40px control row.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ [⌘K search………………]        [queue chips] │ [site] [bell] [avatar] │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * - Search: debounced entity search (users / applications / disputes /
 *   orders) + instant page jump; "/" or ⌘K focuses it from anywhere.
 *   Results deep-link to real routes (orders → ?search=…; users copy
 *   their ID — there is no admin user page).
 * - Queue chips: live counts that answer "what needs me right now" —
 *   pending applications, open disputes, high-severity fraud (only
 *   when non-zero). 30s refresh.
 * - View site: jump to the marketplace in a new tab.
 * - Notifications: unread feed, mark-one/mark-all read, 10s refresh.
 * - Identity: the admin's REAL marketplace avatar (profiles table via
 *   getAvatarUrl), name, role chip, and a compact account menu.
 */

import {
  ArrowSquareOut,
  Bell,
  CaretDown,
  Checks,
  Copy,
  FileText,
  KeyReturn,
  List,
  MagnifyingGlass,
  Package,
  Scales,
  ShieldWarning,
  SignOut,
  User as UserIcon,
  UserCircle,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { orderNumberSearchPattern } from '@/lib/orders/order-number'
import { OPEN_DISPUTE_STATUSES } from '@/lib/admin/status-sets'
import type { AdminProfile } from './AdminChrome'
import { NavIconButton, NavMenuDivider, NavPanel, NavPanelHeader, navMenuIconCls, navMenuRowCls } from '@/components/navbar/NavChrome'

interface EnhancedAdminHeaderProps {
  role: string
  user: { id: string; email?: string }
  profile: AdminProfile | null
  /** Opens the phone/tablet nav drawer. */
  onMenu: () => void
}

/* Quick page jump — searchable from the header, including pages that
   no longer occupy the sidebar (GDPR / INFORM). */
const PAGES: Array<{ label: string; href: string; keywords?: string }> = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Seller Applications', href: '/admin/sellers', keywords: 'apps review' },
  { label: 'Active Sellers', href: '/admin/active-sellers' },
  { label: 'Disputes', href: '/admin/disputes' },
  { label: 'Analytics', href: '/admin/analytics', keywords: 'revenue stats' },
  { label: 'Fraud', href: '/admin/fraud', keywords: 'flags scan' },
  { label: 'Games', href: '/admin/games' },
  { label: 'Moderation', href: '/admin/moderation', keywords: 'listings queue' },
  { label: 'Reviews', href: '/admin/reviews' },
  { label: 'Promo Codes', href: '/admin/promos', keywords: 'discount coupon' },
  { label: 'Notifications', href: '/admin/notifications' },
  { label: 'Activities', href: '/admin/activities', keywords: 'log audit' },
  { label: 'Utilities', href: '/admin/utils', keywords: 'tools' },
  { label: 'Profile', href: '/admin/profile', keywords: 'settings account' },
  { label: 'GDPR Requests', href: '/admin/gdpr', keywords: 'privacy export deletion' },
  { label: 'INFORM Act', href: '/admin/inform', keywords: 'compliance disclosure' },
]

interface EntityResult {
  type: 'user' | 'application' | 'dispute' | 'order'
  id: string
  title: string
  subtitle: string
  link: string | null
}

const RESULT_ICON: Record<EntityResult['type'], PhosphorIcon> = {
  user: UserIcon,
  application: FileText,
  dispute: Scales,
  order: Package,
}

/** The dropdown surface the site navbar uses (NavPanel): fill only, a dark
 *  edge ring + shadow. CSS entrance — framer's JS opacity stalls under heavy
 *  admin trees. */
const SEARCH_PANEL =
  'absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl bg-[#1D1E23] ' +
  'shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_28px_64px_-16px_rgba(0,0,0,0.9)] ' +
  'animate-in fade-in-0 slide-in-from-top-1 duration-150'

export default function EnhancedAdminHeader({
  role,
  user,
  profile,
  onMenu,
}: EnhancedAdminHeaderProps) {
  const displayName =
    profile?.full_name || profile?.username || user.email?.split('@')[0] || 'Admin'
  const username = profile?.username || user.email?.split('@')[0] || 'admin'
  const avatarSrc = getAvatarUrl(profile?.avatar_url, username)

  const router = useRouter()
  const queryClient = useQueryClient()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<EntityResult[]>([])
  const [searching, setSearching] = useState(false)
  /** Phones: the search field takes over the whole bar while open. */
  const [mobileSearch, setMobileSearch] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // "/" or ⌘K focuses search from anywhere in the admin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
        setMobileSearch(false)
        setShowNotifications(false)
        setShowUserMenu(false)
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Queue counts — "what needs me right now". 30s refresh.
  const { data: quickStats } = useQuery({
    queryKey: ['admin-quick-stats', user.id],
    queryFn: async () => {
      const supabase = createClient()
      const [pendingApps, openDisputes, highFraud] = await Promise.all([
        supabase.from('seller_applications').select('*', { count: 'exact' }).eq('status', 'pending').limit(1),
        supabase.from('disputes').select('*', { count: 'exact' }).in('status', OPEN_DISPUTE_STATUSES).limit(1),
        supabase.from('fraud_flags').select('*', { count: 'exact' }).eq('status', 'open').eq('severity', 'high').limit(1),
      ])
      return {
        pendingApplications: pendingApps.count || 0,
        openDisputes: openDisputes.count || 0,
        highSeverityFraud: highFraud.count || 0,
      }
    },
    refetchInterval: 30000,
  })

  // Unread notifications — count + latest five. 10s refresh.
  const { data: notificationCount } = useQuery({
    queryKey: ['admin-unread-notifications', user.id],
    queryFn: async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false).limit(1)
      return count || 0
    },
    refetchInterval: 10000,
  })

  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications-list', user.id],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5)
      return data || []
    },
    refetchInterval: 10000,
  })

  // Entity search — users, applications, disputes, orders.
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const supabase = createClient()
    const results: EntityResult[] = []

    const [{ data: users }, { data: applications }, { data: disputes }, { data: orders }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, email, full_name')
          .or(`username.ilike.%${query}%,email.ilike.%${query}%,full_name.ilike.%${query}%`)
          .limit(3) as any,
        supabase
          .from('seller_applications')
          .select('id, display_name, email, status')
          .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(3) as any,
        supabase
          .from('disputes')
          .select('id, title, reason, status')
          .or(`title.ilike.%${query}%,reason.ilike.%${query}%`)
          .limit(3) as any,
        supabase
          .from('orders')
          .select('id, order_number, status')
          .ilike('order_number_search', orderNumberSearchPattern(query))
          .limit(3) as any,
      ])

    users?.forEach((u: any) =>
      results.push({
        type: 'user',
        id: u.id,
        title: u.username || u.email,
        subtitle: u.full_name || u.email || 'User',
        // No admin user page exists — clicking copies the ID instead.
        link: null,
      }),
    )
    applications?.forEach((app: any) =>
      results.push({
        type: 'application',
        id: app.id,
        title: app.display_name,
        subtitle: `Application · ${app.status}`,
        link: `/admin/sellers/${app.id}`,
      }),
    )
    disputes?.forEach((d: any) =>
      results.push({
        type: 'dispute',
        id: d.id,
        title: d.title || 'Untitled dispute',
        subtitle: `${d.reason} · ${d.status}`,
        link: `/admin/disputes/${d.id}`,
      }),
    )
    orders?.forEach((o: any) =>
      results.push({
        type: 'order',
        id: o.id,
        title: `Order #${o.order_number}`,
        subtitle: `Status · ${o.status}`,
        link: `/admin/orders?search=${encodeURIComponent(o.order_number)}`,
      }),
    )

    setSearchResults(results)
    setSearching(false)
  }, [])

  // Debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => performSearch(searchQuery), 300)
    } else {
      setSearchResults([])
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery, performSearch])

  const pageMatches = searchQuery.trim()
    ? PAGES.filter((p) =>
        `${p.label} ${p.keywords ?? ''}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ).slice(0, 4)
    : []

  const closeSearch = () => {
    setSearchOpen(false)
    setMobileSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const onResultClick = (result: EntityResult) => {
    if (result.link) {
      router.push(result.link)
      closeSearch()
    } else {
      navigator.clipboard.writeText(result.id)
      toast.success('User ID copied to clipboard')
    }
  }

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient()
    await (supabase.from('notifications').update as any)({
      is_read: true,
      read_at: new Date().toISOString(),
    }).eq('id', notificationId)
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-list', user.id] })
    queryClient.invalidateQueries({ queryKey: ['admin-unread-notifications', user.id] })
  }

  const markAllRead = async () => {
    const supabase = createClient()
    await (supabase.from('notifications').update as any)({
      is_read: true,
      read_at: new Date().toISOString(),
    })
      .eq('user_id', user.id)
      .eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-list', user.id] })
    queryClient.invalidateQueries({ queryKey: ['admin-unread-notifications', user.id] })
    toast.success('All notifications marked as read')
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const unread = notificationCount || 0
  const recent = notifications || []
  const hasSearchContent =
    searchQuery.trim().length > 0 && (searchResults.length > 0 || pageMatches.length > 0 || searching)

  const searchField = (
    <div className="relative">
      <MagnifyingGlass
        aria-hidden
        weight="bold"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
      />
      <input
        ref={searchInputRef}
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setSearchOpen(true)}
        placeholder="Search users, orders, disputes, pages…"
        aria-label="Search the admin"
        className={cn(
          'h-10 w-full rounded-md border border-transparent bg-bg-raised pl-9 pr-3 text-base text-text-primary sm:pr-14 sm:text-[13.5px]',
          'placeholder:text-text-disabled transition-colors hover:border-white/[0.08]',
          'focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold text-text-tertiary sm:block">
        ⌘K
      </kbd>
    </div>
  )

  const searchResultsPanel = searchOpen && hasSearchContent && (
    <div className={SEARCH_PANEL}>
      <div className="max-h-[min(420px,70dvh)] overflow-y-auto p-1.5">
        {pageMatches.length > 0 && (
          <>
            <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-medium text-text-tertiary">Pages</p>
            {pageMatches.map((p) => (
              <button
                key={p.href}
                type="button"
                onClick={() => {
                  router.push(p.href)
                  closeSearch()
                }}
                className="flex h-10 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span className="text-[13.5px] font-medium text-text-primary">{p.label}</span>
                <KeyReturn aria-hidden weight="bold" className="h-3.5 w-3.5 text-text-disabled" />
              </button>
            ))}
          </>
        )}

        {searchResults.length > 0 && (
          <>
            <p className="px-2.5 pb-1 pt-2 text-[12px] font-medium text-text-tertiary">Results</p>
            {searchResults.map((result) => {
              const Icon = RESULT_ICON[result.type]
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => onResultClick(result)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.05]">
                    <Icon aria-hidden weight="bold" className="h-4 w-4 text-text-secondary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-text-primary">{result.title}</span>
                    <span className="block truncate text-[12px] text-text-tertiary">{result.subtitle}</span>
                  </span>
                  {result.type === 'user' && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-text-tertiary">
                      <Copy aria-hidden weight="bold" className="h-3 w-3" /> ID
                    </span>
                  )}
                </button>
              )
            })}
          </>
        )}

        {searching && searchResults.length === 0 && (
          <p className="px-2.5 py-4 text-center text-[12.5px] text-text-tertiary">Searching…</p>
        )}
      </div>
    </div>
  )

  return (
    <header
      className={cn(
        // Any backdrop-filter makes the bar the containing block for the
        // NavPanel phone sheets (`fixed top-full`), so they hang flush under it.
        'sticky top-0 z-30 bg-[rgba(var(--color-bg-base-rgb),0.9)] backdrop-blur-xl',
        'lg:pt-3',
      )}
    >
      <div className="relative flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        {/* Phones: the search takes over the bar */}
        {mobileSearch ? (
          <div ref={searchRef} className="flex w-full items-center gap-2 sm:hidden">
            <div className="relative min-w-0 flex-1">
              {searchField}
              {searchResultsPanel}
            </div>
            <button
              type="button"
              onClick={closeSearch}
              className="h-10 shrink-0 rounded-md px-2 text-[14px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onMenu}
              aria-label="Open menu"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-text-primary transition-colors hover:bg-white/[0.07] active:scale-[0.94] lg:hidden"
            >
              <List aria-hidden weight="bold" className="h-[21px] w-[21px]" />
            </button>

            {/* sm+: inline search */}
            <div ref={searchRef} className="relative hidden w-full max-w-md sm:block">
              {searchField}
              {searchResultsPanel}
            </div>

            <div className="flex-1" />

            {/* Right cluster */}
            <div className="flex shrink-0 items-center gap-1">
              <div className="hidden items-center gap-1.5 lg:flex">
                <QueueChip
                  href="/admin/sellers?status=pending"
                  icon={FileText}
                  count={quickStats?.pendingApplications ?? 0}
                  label="Pending"
                  tone="warning"
                />
                <QueueChip
                  href="/admin/disputes"
                  icon={Scales}
                  count={quickStats?.openDisputes ?? 0}
                  label="Disputes"
                  tone="error"
                />
                {(quickStats?.highSeverityFraud ?? 0) > 0 && (
                  <QueueChip
                    href="/admin/fraud"
                    icon={ShieldWarning}
                    count={quickStats!.highSeverityFraud}
                    label="Fraud"
                    tone="error"
                  />
                )}
                <div className="mx-1.5 h-6 w-px bg-white/[0.08]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileSearch(true)
                  setSearchOpen(true)
                  requestAnimationFrame(() => searchInputRef.current?.focus())
                }}
                aria-label="Search"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white sm:hidden"
              >
                <MagnifyingGlass aria-hidden weight="bold" className="h-5 w-5" />
              </button>

              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open the marketplace"
                title="Open the marketplace"
                className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white sm:grid"
              >
                <ArrowSquareOut aria-hidden weight="bold" className="h-[20px] w-[20px]" />
              </a>

              {/* Notifications */}
              <div ref={notificationsRef} className="sm:relative">
                <NavIconButton
                  icon={Bell}
                  label="Notifications"
                  count={unread}
                  active={showNotifications}
                  onClick={() => {
                    setShowNotifications((v) => !v)
                    setShowUserMenu(false)
                  }}
                />
                {showNotifications && (
                  <NavPanel onClose={() => setShowNotifications(false)} width="sm:w-[380px]" position="sm:right-0 sm:mt-3">
                    <NavPanelHeader
                      title="Notifications"
                      aside={
                        unread > 0 ? (
                          <button
                            type="button"
                            onClick={markAllRead}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                          >
                            <Checks aria-hidden weight="bold" className="h-4 w-4" />
                            Mark All Read
                          </button>
                        ) : null
                      }
                    />
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {recent.length === 0 ? (
                        <div className="px-6 py-10 text-center">
                          <Bell aria-hidden weight="bold" className="mx-auto mb-3 h-7 w-7 text-text-disabled" />
                          <p className="text-[13.5px] text-text-tertiary">All caught up</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.06]">
                          {recent.map((n: any) => (
                            <Link
                              key={n.id}
                              href={n.link || '/admin/notifications'}
                              onClick={() => {
                                markAsRead(n.id)
                                setShowNotifications(false)
                              }}
                              className="block px-4 py-3 transition-colors hover:bg-white/[0.05]"
                            >
                              <p className="text-[13.5px] font-medium text-text-primary">{n.title}</p>
                              <p className="mt-0.5 line-clamp-2 text-[12.5px] text-text-secondary">{n.message}</p>
                              <p className="mt-1 text-[11.5px] text-text-tertiary">
                                {new Date(n.created_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 border-t border-white/[0.07] p-2">
                      <Link
                        href="/admin/notifications"
                        onClick={() => setShowNotifications(false)}
                        className="flex h-10 items-center justify-center rounded-lg text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]"
                      >
                        View All Notifications
                      </Link>
                    </div>
                  </NavPanel>
                )}
              </div>

              {/* Identity */}
              <div ref={userMenuRef} className="sm:relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu((v) => !v)
                    setShowNotifications(false)
                  }}
                  aria-expanded={showUserMenu}
                  aria-label="Account menu"
                  className={cn(
                    'flex h-10 items-center gap-2.5 rounded-lg pl-1 pr-1 transition-colors hover:bg-white/[0.06] md:pr-2',
                    showUserMenu && 'bg-white/[0.07]',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <span className="hidden min-w-0 flex-col items-start md:flex">
                    <span className="max-w-[120px] truncate text-[13px] font-semibold leading-tight text-text-primary">
                      {displayName}
                    </span>
                    <span className="text-[11.5px] font-medium capitalize leading-tight text-text-tertiary">
                      {role.replace('_', ' ')}
                    </span>
                  </span>
                  <CaretDown
                    aria-hidden
                    weight="bold"
                    className={cn('hidden h-3.5 w-3.5 text-text-tertiary transition-transform md:block', showUserMenu && 'rotate-180')}
                  />
                </button>

                {showUserMenu && (
                  <NavPanel onClose={() => setShowUserMenu(false)} width="sm:w-[280px]" position="sm:right-0 sm:mt-3">
                    <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarSrc} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-text-primary">{displayName}</p>
                        <p className="truncate text-[12px] text-text-tertiary">{user.email}</p>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <MenuItem
                        icon={UserCircle}
                        label="Profile"
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/admin/profile')
                        }}
                      />
                      <MenuItem
                        icon={ArrowSquareOut}
                        label="View Marketplace"
                        onClick={() => {
                          setShowUserMenu(false)
                          window.open('/', '_blank', 'noopener,noreferrer')
                        }}
                      />
                      <NavMenuDivider />
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className={cn(navMenuRowCls, 'text-error hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] hover:text-error')}
                      >
                        <SignOut aria-hidden weight="bold" className="h-[18px] w-[18px] shrink-0" />
                        Log Out
                      </button>
                    </div>
                  </NavPanel>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

/* ── Queue chip: a live "needs me" count. Fill only, no outline. ── */

function QueueChip({
  href,
  icon: Icon,
  count,
  label,
  tone,
}: {
  href: string
  icon: PhosphorIcon
  count: number
  label: string
  tone: 'warning' | 'error'
}) {
  return (
    <Link
      href={href}
      title={`${count} ${label}`}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-md px-2.5 transition-[filter,background-color] hover:brightness-125',
        // Colour only when something is waiting; zero reads calm.
        count === 0
          ? 'bg-white/[0.05] text-text-tertiary hover:text-text-secondary'
          : tone === 'warning'
            ? 'bg-warning-bg text-warning'
            : 'bg-error-bg text-error',
      )}
    >
      <Icon aria-hidden weight="bold" className="h-4 w-4" />
      <span className="text-[13.5px] font-bold tabular-nums">{count}</span>
      <span className="hidden text-[12.5px] font-medium xl:inline">{label}</span>
    </Link>
  )
}

/* ── Account menu row (the site navbar's row) ── */

function MenuItem({ icon: Icon, label, onClick }: { icon: PhosphorIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={navMenuRowCls}>
      <Icon aria-hidden weight="bold" className={cn('h-[18px] w-[18px]', navMenuIconCls)} />
      {label}
    </button>
  )
}
