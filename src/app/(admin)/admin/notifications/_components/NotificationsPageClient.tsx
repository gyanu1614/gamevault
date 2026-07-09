'use client'

/**
 * /admin/notifications — V53 restyle on the admin kit.
 * Neutral surfaces, lime accent for unread state, semantic per-type
 * icon tints preserved.
 *
 * V54 — Initial data (admin user id + the default "all" tab list) is
 * fetched by the server wrapper (../page.tsx) and seeded into the
 * react-query caches via initialData, so the page arrives fully
 * rendered. Tab switches, mark-as-read invalidations, and the 15s
 * polling refetch all keep working client-side as before.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Loader2, AlertTriangle, User, Shield, FileText } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '../../components/kit'

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
  const map: Record<string, { Icon: any; bg: string; border: string; text: string }> = {
    new_dispute:                  { Icon: AlertTriangle, bg: 'bg-error-bg',      border: 'border-[rgba(255,92,92,0.2)]',   text: 'text-error' },
    new_seller_application:       { Icon: User,          bg: 'bg-info-bg',       border: 'border-[rgba(88,155,255,0.2)]',  text: 'text-info' },
    fraud_alert_high:             { Icon: Shield,        bg: 'bg-error-bg',      border: 'border-[rgba(255,92,92,0.2)]',   text: 'text-error' },
    fraud_alert_medium:           { Icon: Shield,        bg: 'bg-warning-bg',    border: 'border-[rgba(255,178,62,0.2)]',  text: 'text-warning' },
    inform_threshold_crossed:     { Icon: FileText,      bg: 'bg-warning-bg',    border: 'border-[rgba(255,178,62,0.2)]',  text: 'text-warning' },
    inform_disclosure_submitted:  { Icon: FileText,      bg: 'bg-success-bg',    border: 'border-[rgba(63,217,134,0.2)]',  text: 'text-success' },
    system:                       { Icon: Bell,          bg: 'bg-bg-overlay',    border: 'border-border-subtle',           text: 'text-text-secondary' },
  }
  const style = map[type] || map.system
  const Icon = style.Icon

  return (
    <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border', style.bg, style.border)}>
      <Icon className={cn('h-4 w-4', style.text)} />
    </div>
  )
}

export default function NotificationsPageClient({
  initialUserId,
  initialNotifications,
}: {
  initialUserId?: string
  initialNotifications?: any[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('all')
  const [marking, setMarking] = useState(false)

  // Get admin user ID from session
  const { data: userId } = useQuery({
    queryKey: ['admin-user-id'],
    queryFn: async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id
    },
    // V54 — Server-seeded so the notifications query below is enabled
    // (and seeded) on the very first render.
    initialData: initialUserId,
    staleTime: 60_000,
  })

  // Fetch all notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['admin-notifications-page', userId, tab],
    queryFn: async () => {
      if (!userId) return []
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (tab === 'unread') query = query.eq('is_read', false)
      const { data } = await query
      return data || []
    },
    enabled: !!userId,
    refetchInterval: 15000,
    // V54 — Seed only the default "all" view; the unread tab fetches
    // client-side as before (switching back to "all" reuses the cache,
    // so this can never mis-seed the unread key with the full list).
    initialData: tab === 'all' ? initialNotifications : undefined,
    staleTime: 60_000,
  })

  // Unread count
  const unreadCount = notifications?.filter((n: any) => !n.is_read).length ?? 0

  const markAsRead = async (id: string) => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await (supabase
      .from('notifications')
      .update as any)({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-page', userId] })
    queryClient.invalidateQueries({ queryKey: ['admin-unread-notifications', userId] })
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-list', userId] })
  }

  const markAllRead = async () => {
    if (!userId) return
    setMarking(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await (supabase
      .from('notifications')
      .update as any)({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-page', userId] })
    queryClient.invalidateQueries({ queryKey: ['admin-unread-notifications', userId] })
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-list', userId] })
    setMarking(false)
  }

  if (isLoading && !notifications) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-lime" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-overlay-2 hover:text-text-primary disabled:opacity-50"
            >
              {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex rounded-lg border border-border-default bg-bg-raised p-1">
        {(['all', 'unread'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition-colors',
              tab === t ? 'bg-bg-overlay-2 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {t}
            {t === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-lime-pressed px-1.5 py-0.5 text-[10px] font-bold text-text-inverse">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {!notifications || notifications.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-bg-raised p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle bg-bg-overlay">
            <Bell className="h-6 w-6 text-text-tertiary" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-text-primary">
            {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-text-tertiary">
            {tab === 'unread' ? "You're all caught up!" : "Notifications about disputes, applications, and alerts will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {notifications.map((notification: any) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Link
                  href={notification.link || '#'}
                  onClick={() => {
                    if (!notification.is_read) markAsRead(notification.id)
                  }}
                  className={cn(
                    'group flex items-start gap-3 rounded-xl border p-3.5 transition-colors hover:bg-state-hover',
                    notification.is_read
                      ? 'border-border-default bg-bg-raised'
                      : 'border-lime-tint-border bg-lime-tint-bg'
                  )}
                >
                  <NotificationIcon type={notification.type || 'system'} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-semibold leading-tight', notification.is_read ? 'text-text-secondary' : 'text-text-primary')}>
                        {notification.title}
                      </p>
                      <span className="flex-shrink-0 text-[11px] text-text-tertiary">
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                    {notification.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">{notification.message}</p>
                    )}
                  </div>

                  {!notification.is_read && (
                    <button
                      className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Mark as read"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        markAsRead(notification.id)
                      }}
                    >
                      <Check className="h-4 w-4 text-lime-text hover:text-lime" />
                    </button>
                  )}
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
