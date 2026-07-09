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
  Bell,
  Search,
  LogOut,
  FileText,
  MessageSquare,
  Shield,
  ExternalLink,
  User as UserIcon,
  Settings,
  ChevronDown,
  Copy,
  Package,
  CheckCheck,
  CornerDownLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import { getAvatarUrl } from '@/lib/utils/avatar'
import type { AdminProfile } from './AdminChrome'

interface EnhancedAdminHeaderProps {
  role: string
  user: { id: string; email?: string }
  profile: AdminProfile | null
  /** Sidebar rail state; shifts the fixed header's left edge. */
  collapsed?: boolean
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
  { label: 'Settings', href: '/admin/settings' },
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

const RESULT_ICON: Record<EntityResult['type'], typeof UserIcon> = {
  user: UserIcon,
  application: FileText,
  dispute: MessageSquare,
  order: Package,
}

/** CSS entrance — framer's JS-driven opacity stalls under the admin
 *  tree (same bug family as the analytics freeze); these tailwindcss-
 *  animate classes are pure CSS and always complete. */
const PANEL_IN = 'animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150'

/** Solid kit surface for every header dropdown. */
const PANEL =
  'absolute right-0 mt-2 rounded-xl border border-border-default bg-[#131318] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden z-50'

export default function EnhancedAdminHeader({
  role,
  user,
  profile,
  collapsed = false,
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
        supabase.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
        supabase.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'high'),
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
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
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
          .ilike('order_number', `%${query}%`)
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

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 h-20 z-40 transition-[left] duration-300 ease-out',
        collapsed ? 'lg:left-[4.5rem]' : 'lg:left-[14.3rem]',
      )}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl border-b border-white/[0.06]" />

      <div className="relative flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        {/* ── Search ─────────────────────────────────────────────── */}
        <div ref={searchRef} className="relative w-full max-w-lg">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search users, orders, disputes, pages…"
              className={cn(
                'h-10 w-full rounded-lg border bg-white/[0.04] pl-9 pr-14 text-[13px] text-text-primary',
                'placeholder:text-text-disabled transition-colors',
                'border-white/[0.06] hover:border-white/[0.12]',
                'focus:border-lime focus:outline-none',
              )}
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border-subtle bg-bg-overlay px-1.5 py-0.5 text-[10px] font-semibold text-text-tertiary">
              ⌘K
            </kbd>
          </div>

          {searchOpen && hasSearchContent && (
              <div
                className={cn(
                  'absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border-default bg-[#131318] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]',
                  PANEL_IN,
                )}
              >
                <div className="max-h-[420px] overflow-y-auto p-1.5">
                  {/* Page jumps */}
                  {pageMatches.length > 0 && (
                    <>
                      <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                        Pages
                      </div>
                      {pageMatches.map((p) => (
                        <button
                          key={p.href}
                          type="button"
                          onClick={() => {
                            router.push(p.href)
                            closeSearch()
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-overlay"
                        >
                          <span className="text-[13px] font-medium text-text-primary">{p.label}</span>
                          <CornerDownLeft className="h-3.5 w-3.5 text-text-disabled" />
                        </button>
                      ))}
                    </>
                  )}

                  {/* Entities */}
                  {searchResults.length > 0 && (
                    <>
                      <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                        Results
                      </div>
                      {searchResults.map((result) => {
                        const Icon = RESULT_ICON[result.type]
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            type="button"
                            onClick={() => onResultClick(result)}
                            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-overlay"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-overlay">
                              <Icon className="h-4 w-4 text-text-secondary" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-text-primary">
                                {result.title}
                              </span>
                              <span className="block truncate text-[11.5px] text-text-tertiary">
                                {result.subtitle}
                              </span>
                            </span>
                            {result.type === 'user' && (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-text-tertiary">
                                <Copy className="h-3 w-3" /> ID
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </>
                  )}

                  {searching && searchResults.length === 0 && (
                    <div className="px-2.5 py-4 text-center text-[12px] text-text-tertiary">
                      Searching…
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* ── Right cluster ──────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Queue chips — live "needs me" counts */}
          <div className="hidden items-center gap-1.5 lg:flex">
            <QueueChip
              href="/admin/sellers?status=pending"
              icon={FileText}
              count={quickStats?.pendingApplications ?? 0}
              label="pending"
              tone="warning"
            />
            <QueueChip
              href="/admin/disputes"
              icon={MessageSquare}
              count={quickStats?.openDisputes ?? 0}
              label="disputes"
              tone="error"
            />
            {(quickStats?.highSeverityFraud ?? 0) > 0 && (
              <QueueChip
                href="/admin/fraud"
                icon={Shield}
                count={quickStats!.highSeverityFraud}
                label="fraud"
                tone="error"
                pulse
              />
            )}
          </div>

          <div className="mx-1.5 hidden h-6 w-px bg-white/[0.08] lg:block" />

          {/* View site */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the marketplace"
            className="flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden xl:inline">View site</span>
          </a>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowUserMenu(false)
              }}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-text-inverse ring-2 ring-[#0c0c11]">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

              {showNotifications && (
                <div className={cn(PANEL, PANEL_IN, 'w-96')}>
                  <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                    <h3 className="text-[13.5px] font-semibold text-text-primary">Notifications</h3>
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-lime-text transition-colors hover:text-text-primary"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {recent.length === 0 ? (
                      <div className="p-10 text-center">
                        <Bell className="mx-auto mb-3 h-8 w-8 text-text-disabled" />
                        <p className="text-[13px] text-text-tertiary">All caught up</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border-subtle">
                        {recent.map((n: any) => (
                          <Link
                            key={n.id}
                            href={n.link || '/admin/notifications'}
                            onClick={() => {
                              markAsRead(n.id)
                              setShowNotifications(false)
                            }}
                            className="block px-4 py-3 transition-colors hover:bg-bg-overlay"
                          >
                            <p className="text-[13px] font-medium text-text-primary">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[12px] text-text-secondary">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[11px] text-text-tertiary">
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
                  <div className="border-t border-border-subtle p-2">
                    <Link
                      href="/admin/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="block rounded-lg py-2 text-center text-[12.5px] font-semibold text-lime-text transition-colors hover:bg-bg-overlay"
                    >
                      View all notifications
                    </Link>
                  </div>
                </div>
              )}
          </div>

          {/* Identity */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowNotifications(false)
              }}
              className="flex h-10 items-center gap-2.5 rounded-lg px-1.5 transition-colors hover:bg-white/[0.06]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-border-strong"
              />
              <span className="hidden min-w-0 flex-col items-start md:flex">
                <span className="max-w-[120px] truncate text-[13px] font-semibold leading-tight text-text-primary">
                  {displayName}
                </span>
                <span className="text-[10.5px] font-medium capitalize leading-tight text-lime-text">
                  {role.replace('_', ' ')}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'hidden h-3.5 w-3.5 text-text-tertiary transition-transform md:block',
                  showUserMenu && 'rotate-180',
                )}
              />
            </button>

              {showUserMenu && (
                <div className={cn(PANEL, PANEL_IN, 'w-64')}>
                  <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarSrc}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover ring-1 ring-border-strong"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-text-primary">
                        {displayName}
                      </p>
                      <p className="truncate text-[11.5px] text-text-tertiary">{user.email}</p>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <MenuItem
                      icon={UserIcon}
                      label="Profile"
                      onClick={() => {
                        setShowUserMenu(false)
                        router.push('/admin/profile')
                      }}
                    />
                    {role === 'super_admin' && (
                      <MenuItem
                        icon={Settings}
                        label="Admin settings"
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/admin/settings')
                        }}
                      />
                    )}
                    <MenuItem
                      icon={ExternalLink}
                      label="View marketplace"
                      onClick={() => {
                        setShowUserMenu(false)
                        window.open('/', '_blank', 'noopener,noreferrer')
                      }}
                    />
                    <div className="mx-2 my-1.5 h-px bg-border-subtle" />
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-error transition-colors hover:bg-error-bg"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </header>
  )
}

/* ── Queue chip ────────────────────────────────────────────────── */

function QueueChip({
  href,
  icon: Icon,
  count,
  label,
  tone,
  pulse = false,
}: {
  href: string
  icon: typeof FileText
  count: number
  label: string
  tone: 'warning' | 'error'
  pulse?: boolean
}) {
  const tones = {
    warning: 'border-[rgba(251,191,36,0.25)] bg-warning-bg text-warning hover:border-[rgba(251,191,36,0.45)]',
    error: 'border-[rgba(248,113,113,0.25)] bg-error-bg text-error hover:border-[rgba(248,113,113,0.45)]',
  }
  return (
    <Link
      href={href}
      className={cn(
        'flex h-10 items-center gap-2 rounded-lg border px-3 transition-colors',
        tones[tone],
        pulse && 'animate-pulse',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[14px] font-bold tabular-nums">{count}</span>
      <span className="hidden text-[12px] font-medium opacity-80 xl:inline">{label}</span>
    </Link>
  )
}

/* ── Menu item ─────────────────────────────────────────────────── */

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof UserIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
