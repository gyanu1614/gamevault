'use client'

/**
 * /admin/notifications — the admin's own notification inbox.
 *
 * V54 — Initial data (admin user id + the default "all" tab list) is
 * fetched by the server wrapper (../page.tsx) and seeded into the
 * react-query caches via initialData, so the page arrives fully
 * rendered. Tab switches, mark-as-read invalidations, and the 15s
 * polling refetch all keep working client-side as before.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Checks, CircleNotch, FileText, Scales, ShieldWarning, UserPlus } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { AdminEmpty, AdminLoadingRows, PageHeader, adminBtn, type AdminIcon } from '../../components/kit'

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

// Icon + tint per notification type
const TYPE_STYLE: Record<string, { Icon: AdminIcon; tile: string }> = {
  new_dispute:                 { Icon: Scales,        tile: 'bg-error-bg text-error' },
  new_seller_application:      { Icon: UserPlus,      tile: 'bg-info-bg text-info' },
  fraud_alert_high:            { Icon: ShieldWarning, tile: 'bg-error-bg text-error' },
  fraud_alert_medium:          { Icon: ShieldWarning, tile: 'bg-warning-bg text-warning' },
  inform_threshold_crossed:    { Icon: FileText,      tile: 'bg-warning-bg text-warning' },
  inform_disclosure_submitted: { Icon: FileText,      tile: 'bg-success-bg text-success' },
  system:                      { Icon: Bell,          tile: 'bg-white/[0.06] text-text-secondary' },
}

function NotificationIcon({ type }: { type: string }) {
  const { Icon, tile } = TYPE_STYLE[type] || TYPE_STYLE.system
  return (
    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', tile)}>
      <Icon aria-hidden weight="bold" className="h-[18px] w-[18px]" />
    </span>
  )
}

export default function NotificationsPageClient({
  initialUserId,
  initialNotifications,
}: {
  initialUserId?: string
  initialNotifications?: any[]
}) {
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
    await (supabase
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
    await (supabase
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

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
        className="mb-0 sm:mb-0"
        actions={
          unreadCount > 0 ? (
            <button type="button" onClick={markAllRead} disabled={marking} className={adminBtn.secondary}>
              {marking ? (
                <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <Checks aria-hidden weight="bold" className="h-4 w-4" />
              )}
              Mark All Read
            </button>
          ) : undefined
        }
      />

      <SegmentedTabs<Tab>
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'unread', label: <>Unread {unreadCount > 0 && <TabCount n={unreadCount} />}</> },
        ]}
        value={tab}
        onChange={setTab}
        layoutId="admin-notifications-tabs"
        ariaLabel="Notifications"
      />

      <div role="tabpanel" id={`admin-notifications-tabs-panel-${tab}`} aria-labelledby={`admin-notifications-tabs-tab-${tab}`}>
        {isLoading && !notifications ? (
          <AdminLoadingRows rows={6} />
        ) : !notifications || notifications.length === 0 ? (
          <AdminEmpty
            icon={Bell}
            title={tab === 'unread' ? 'No Unread Notifications' : 'No Notifications Yet'}
            hint={
              tab === 'unread'
                ? "You're all caught up."
                : 'Notifications about disputes, applications and alerts will appear here.'
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
            <AnimatePresence initial={false}>
              {notifications.map((notification: any) => (
                <motion.li
                  key={notification.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="group relative"
                >
                  <Link
                    href={notification.link || '#'}
                    onClick={() => {
                      if (!notification.is_read) markAsRead(notification.id)
                    }}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]',
                      !notification.is_read && 'bg-white/[0.02] pr-14',
                    )}
                  >
                    <NotificationIcon type={notification.type || 'system'} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'flex items-center gap-2 text-[13.5px] font-semibold leading-snug',
                            notification.is_read ? 'text-text-secondary' : 'text-text-primary',
                          )}
                        >
                          {!notification.is_read && (
                            <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-lime" />
                          )}
                          {notification.title}
                        </p>
                        <span className="shrink-0 pt-px text-[12px] text-text-tertiary">
                          {timeAgo(notification.created_at)}
                        </span>
                      </div>
                      {notification.message && (
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-text-tertiary">
                          {notification.message}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Outside the link (no button inside an anchor); always shown on touch */}
                  {!notification.is_read && (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      title="Mark as read"
                      onClick={() => markAsRead(notification.id)}
                      className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-text-tertiary transition-[opacity,background-color,color] hover:bg-white/[0.08] hover:text-text-primary focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Check aria-hidden weight="bold" className="h-4 w-4" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  )
}
