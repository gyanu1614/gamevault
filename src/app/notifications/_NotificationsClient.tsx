'use client'

/**
 * Notifications Page
 *
 * Full notifications inbox at /notifications.
 * Linked from the bell dropdown "View all notifications".
 * Features: All / Unread filter tabs, mark-as-read, mark-all-read, clear-read.
 *
 * STATE-008 — the client island. The route's server page.tsx now resolves the
 * session and redirects anonymous visitors BEFORE this ships, so the
 * useEffect + router.replace that used to be the only access gate is gone
 * (Pass 0 flagged that this route had no server gate at all). Everything left
 * here is genuinely interactive: filter tabs, mark-read mutations, live
 * refetch.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BellIcon,
  CheckIcon,
  ChecksIcon,
  ArrowLeftIcon,
  CircleNotchIcon,
  ShoppingBagIcon,
  PackageIcon,
  CheckCircleIcon,
  WarningIcon,
  ChatCircleDotsIcon,
  ArrowCounterClockwiseIcon,
  StarIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { POLL_MS, foregroundPoll } from '@/lib/polling/intervals'
import { cn } from '@/lib/utils'
import { safeInternalPath } from '@/lib/utils/safe-link'
import { HeroBackdrop } from '@/components/hero-backdrop'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'

type Tab = 'all' | 'unread'

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Icon + color per notification type
/** One icon per kind, in a neutral tile; the glyph carries the tone. */
function NotificationIcon({ type }: { type: string }) {
  const map: Record<string, { Icon: typeof BellIcon; tone: string }> = {
    order_placed: { Icon: ShoppingBagIcon, tone: 'text-info' },
    new_order: { Icon: ShoppingBagIcon, tone: 'text-info' },
    order_delivered: { Icon: PackageIcon, tone: 'text-success' },
    order_completed: { Icon: CheckCircleIcon, tone: 'text-success' },
    order_disputed: { Icon: WarningIcon, tone: 'text-error' },
    order_message: { Icon: ChatCircleDotsIcon, tone: 'text-text-primary' },
    order_refunded: { Icon: ArrowCounterClockwiseIcon, tone: 'text-cyan-400' },
    chargeback_opened: { Icon: WarningIcon, tone: 'text-error' },
    message: { Icon: ChatCircleDotsIcon, tone: 'text-text-primary' },
    review: { Icon: StarIcon, tone: 'text-warning' },
    review_received: { Icon: StarIcon, tone: 'text-warning' },
    payout: { Icon: WalletIcon, tone: 'text-success' },
    system: { Icon: BellIcon, tone: 'text-text-secondary' },
  }
  const { Icon, tone } = map[type] || map.system
  return (
    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-white/[0.05]">
      <Icon size={18} weight="bold" aria-hidden className={tone} />
    </span>
  )
}

/** The row shape the server shell prefetches and seeds this island with. */
export interface InitialNotification {
  id: string
  title: string | null
  message: string | null
  type: string
  link: string | null
  is_read: boolean
  created_at: string
}

interface Props {
  /** Resolved server-side, so the list can query without waiting on useAuth. */
  userId: string
  /** First page, fetched on the server — renders on first paint. */
  initialNotifications: InitialNotification[]
}

export default function NotificationsClient({ userId, initialNotifications }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('all')
  const [marking, setMarking] = useState(false)

  // Fetch all notifications. Keyed on the server-resolved userId so the query
  // runs immediately rather than waiting for the client session to resolve.
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-page', userId, tab],
    // The 'all' tab is exactly what the server already fetched, so it paints
    // from initialData; 'unread' is a filtered refetch.
    initialData: tab === 'all' ? initialNotifications : undefined,
    queryFn: async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      let query = supabase
        .from('notifications')
        // STATE-012 — explicit columns: this is a client query, so every
        // unused column would cross the network into the browser.
        .select('id, title, message, type, link, is_read, created_at')
        .eq('user_id', userId)
        // Workstream E — chat messages live under the Messages badge, not the
        // notifications inbox. Filter out legacy 'new_message' rows here too.
        .neq('type', 'new_message')
        .order('created_at', { ascending: false })
        .limit(50)
      if (tab === 'unread') query = query.eq('is_read', false)
      const { data } = await query
      return data || []
    },
    // The navbar's notifications realtime channel invalidates this key on
    // INSERT; the poll is a visible-tab-only fallback.
    ...foregroundPoll(POLL_MS.notificationsPage),
  })

  // Unread count
  const unreadCount = notifications?.filter((n: any) => !n.is_read).length ?? 0

  const markAsRead = async (id: string) => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await (supabase
      .from('notifications')
      .update as any)({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['notifications-page', userId] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications', userId] })
  }

  const markAllRead = async () => {
    setMarking(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await (supabase
      .from('notifications')
      .update as any)({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['notifications-page', userId] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications', userId] })
    setMarking(false)
  }

  // The server page.tsx gates this route and resolves the session (STATE-008),
  // so there is no client-side redirect and no auth-shaped spinner: by the time
  // this renders the user is known and the first page of rows is already here.

  return (
    <HeroBackdrop name="marketplace">
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        {/* Back + Header */}
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            aria-label="Go back"
            className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-white/[0.05] text-text-secondary transition-colors hover:bg-white/[0.09] hover:text-text-primary"
            onClick={() => router.back()}
          >
            <ArrowLeftIcon size={18} weight="bold" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[28px] font-extrabold leading-tight text-text-primary">Notifications</h1>
            <p className="mt-0.5 text-[13.5px] text-text-secondary">{unreadCount > 0 ? `${unreadCount} Unread` : 'All caught up'}</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-white/[0.06] px-3.5 text-[13.5px] font-semibold text-text-primary transition-colors hover:bg-white/[0.1] disabled:opacity-60"
              onClick={markAllRead}
              disabled={marking}
            >
              {marking ? (
                <CircleNotchIcon size={14} weight="bold" aria-hidden className="animate-spin" />
              ) : (
                <ChecksIcon size={15} weight="bold" aria-hidden />
              )}
              Mark All Read
            </button>
          )}
        </div>

        {/* Tabs — the Messages tab bar. */}
        <SegmentedTabs<Tab>
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'unread', label: <>Unread{unreadCount > 0 && <TabCount n={unreadCount} />}</> },
          ]}
          value={tab}
          onChange={setTab}
          layoutId="notifications-tabs"
          ariaLabel="Notifications"
          className="mb-5"
        />

        {/* List */}
        {isLoading ? (
          <div className="space-y-2" aria-busy aria-label="Loading notifications">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3.5 rounded-lg bg-bg-raised p-4">
                <div className="skeleton h-10 w-10 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="skeleton h-4 w-1/2 rounded" />
                  <div className="skeleton h-3.5 w-4/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl bg-white/[0.05]">
              <BellIcon size={26} weight="bold" aria-hidden className="text-text-tertiary" />
            </div>
            <h3 className="mb-1 text-[16px] font-bold text-text-primary">
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-[13.5px] text-text-tertiary">
              {tab === 'unread' ? "You're all caught up!" : "We'll notify you about orders, messages, and more."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification: any) => (
              <div key={notification.id} className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <Link
                  href={safeInternalPath(notification.link)}
                  onClick={() => {
                    if (!notification.is_read) markAsRead(notification.id)
                  }}
                  // Fill-only row (card-surface system); unread rows sit one
                  // step lighter so they read first.
                  className={cn(
                    'group relative block rounded-lg p-4 transition-colors',
                    notification.is_read ? 'bg-bg-raised hover:bg-bg-raised-hover' : 'bg-bg-raised-hover hover:bg-bg-overlay',
                  )}
                >
                  <div className="relative flex items-start gap-3.5">
                    <NotificationIcon type={notification.type || 'system'} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-[14.5px] font-semibold leading-snug', notification.is_read ? 'text-text-secondary' : 'text-text-primary')}>
                          {notification.title}
                          {!notification.is_read && (
                            <span aria-hidden className="ml-2 inline-block h-2 w-2 rounded-full bg-white align-middle" />
                          )}
                        </p>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className="text-[12px] text-text-tertiary">
                            {timeAgo(notification.created_at)}
                          </span>
                          {!notification.is_read && (
                            <button
                              type="button"
                              aria-label="Mark as read"
                              className="-my-1.5 -mr-1.5 grid h-9 w-9 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/10 hover:text-text-primary"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                markAsRead(notification.id)
                              }}
                            >
                              <CheckIcon size={14} weight="bold" aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>
                      {notification.message && (
                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{notification.message}</p>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </HeroBackdrop>
  )
}
