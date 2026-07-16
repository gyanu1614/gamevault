'use client'

/**
 * Notifications Page
 *
 * Full notifications inbox at /notifications.
 * Linked from the bell dropdown "View all notifications".
 * Features: All / Unread filter tabs, mark-as-read, mark-all-read, clear-read.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HeroBackdrop } from '@/components/hero-backdrop'

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
function NotificationIcon({ type }: { type: string }) {
  const map: Record<string, { icon: string; bg: string; text: string }> = {
    order_placed:      { icon: '🛍️', bg: 'bg-info-bg',   text: 'text-info' },
    new_order:         { icon: '🛍️', bg: 'bg-info-bg',   text: 'text-info' },
    order_delivered:   { icon: '📦', bg: 'bg-success-bg',  text: 'text-success' },
    order_completed:   { icon: '✅', bg: 'bg-success-bg',  text: 'text-success' },
    order_disputed:    { icon: '⚠️', bg: 'bg-error-bg',    text: 'text-error' },
    order_message:     { icon: '💬', bg: 'bg-lime-tint-bg', text: 'text-lime-text' },
    order_refunded:    { icon: '💸', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
    chargeback_opened: { icon: '⚠️', bg: 'bg-error-bg',    text: 'text-error' },
    message:           { icon: '💬', bg: 'bg-lime-tint-bg', text: 'text-lime-text' },
    review:            { icon: '⭐', bg: 'bg-warning-bg', text: 'text-warning' },
    payout:            { icon: '💰', bg: 'bg-success-bg', text: 'text-success' },
    system:            { icon: '🔔', bg: 'bg-white/10',   text: 'text-text-secondary' },
  }
  const style = map[type] || map.system
  return (
    <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl', style.bg)}>
      {style.icon}
    </div>
  )
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('all')
  const [marking, setMarking] = useState(false)

  // Fetch all notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-page', user?.id, tab],
    queryFn: async () => {
      if (!user?.id) return []
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        // Workstream E — chat messages live under the Messages badge, not the
        // notifications inbox. Filter out legacy 'new_message' rows here too.
        .neq('type', 'new_message')
        .order('created_at', { ascending: false })
        .limit(50)
      if (tab === 'unread') query = query.eq('is_read', false)
      const { data } = await query
      return data || []
    },
    enabled: !!user,
    refetchInterval: 15000,
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
    queryClient.invalidateQueries({ queryKey: ['notifications-page', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-list', user?.id] })
  }

  const markAllRead = async () => {
    if (!user) return
    setMarking(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await (supabase
      .from('notifications')
      .update as any)({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['notifications-page', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-list', user?.id] })
    setMarking(false)
  }

  // V61 — redirect in an effect (render-body router.replace is a React
  // anti-pattern and loses the return path).
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent('/notifications')}`)
    }
  }, [authLoading, user, router])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <HeroBackdrop name="marketplace">
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        {/* Back + Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            aria-label="Go back"
            className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-border-subtle bg-white/[0.03] text-text-secondary transition-colors hover:border-border-default hover:bg-white/[0.06] hover:text-text-primary"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[28px] font-extrabold leading-tight text-text-primary">Notifications</h1>
            <p className="mt-0.5 text-[13.5px] text-text-secondary">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-bg-overlay-2 disabled:opacity-60"
              onClick={markAllRead}
              disabled={marking}
            >
              {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5 text-lime-text" />}
              Mark All Read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg border border-border-subtle bg-bg-overlay p-1">
          {(['all', 'unread'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 rounded-md py-2 text-[13.5px] font-semibold capitalize transition-colors',
                tab === t ? 'bg-white/[0.10] text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              {t}
              {t === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 rounded-md border border-lime-tint-border bg-lime-tint-bg px-1.5 py-0.5 text-[10.5px] font-bold text-lime-text">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-lime-text" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl border border-border-subtle bg-bg-overlay">
              <Bell className="h-7 w-7 text-text-tertiary" />
            </div>
            <h3 className="mb-1 text-[16px] font-bold text-text-primary">
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-[13.5px] text-text-tertiary">
              {tab === 'unread' ? "You're all caught up!" : "We'll notify you about orders, messages, and more."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notification: any) => (
              <div key={notification.id} className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <Link
                  href={notification.link || '#'}
                  onClick={() => {
                    if (!notification.is_read) markAsRead(notification.id)
                  }}
                  className={cn(
                    'group relative block overflow-hidden rounded-lg border p-4 transition-colors',
                    'border-border-subtle bg-white/[0.03] hover:border-border-default hover:bg-white/[0.06]',
                  )}
                >
                  {/* Top sheen */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent)]"
                  />
                  <div className="relative flex items-start gap-3.5">
                    <NotificationIcon type={notification.type || 'system'} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-[14.5px] font-semibold leading-snug', notification.is_read ? 'text-text-secondary' : 'text-text-primary')}>
                          {notification.title}
                          {!notification.is_read && (
                            <span aria-hidden className="ml-2 inline-block h-2 w-2 rounded-full bg-lime align-middle shadow-[0_0_8px_rgba(198,255,61,0.8)]" />
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
                              className="grid h-6 w-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/10 hover:text-text-primary"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                markAsRead(notification.id)
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
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
