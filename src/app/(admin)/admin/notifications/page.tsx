'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Loader2, AlertTriangle, User, Shield, FileText, TrendingUp } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

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
    new_dispute:                  { Icon: AlertTriangle, bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400' },
    new_seller_application:       { Icon: User,          bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400' },
    fraud_alert_high:             { Icon: Shield,        bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400' },
    fraud_alert_medium:           { Icon: Shield,        bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400' },
    inform_threshold_crossed:     { Icon: FileText,      bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  text: 'text-yellow-400' },
    inform_disclosure_submitted:  { Icon: FileText,      bg: 'bg-green-500/10',   border: 'border-green-500/20',   text: 'text-green-400' },
    system:                       { Icon: Bell,          bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400' },
  }
  const style = map[type] || map.system
  const Icon = style.Icon

  return (
    <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border', style.bg, style.border)}>
      <Icon className={cn('h-4 w-4', style.text)} />
    </div>
  )
}

export default function AdminNotificationsPage() {
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
  })

  // Unread count
  const unreadCount = notifications?.filter((n: any) => !n.is_read).length ?? 0

  const markAsRead = async (id: string) => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex rounded-lg bg-white/[0.03] p-1">
        {(['all', 'unread'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors',
              tab === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300'
            )}
          >
            {t}
            {t === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {!notifications || notifications.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
            <Bell className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-white">
            {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-gray-500">
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
                    'group flex items-start gap-3 rounded-xl border p-3.5 transition-all hover:bg-white/[0.03]',
                    notification.is_read
                      ? 'border-white/[0.06] bg-transparent'
                      : 'border-violet-500/20 bg-violet-500/[0.05]'
                  )}
                >
                  <NotificationIcon type={notification.type || 'system'} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-semibold leading-tight', notification.is_read ? 'text-gray-300' : 'text-white')}>
                        {notification.title}
                      </p>
                      <span className="flex-shrink-0 text-[11px] text-gray-500">
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                    {notification.message && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-400">{notification.message}</p>
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
                      <Check className="h-4 w-4 text-violet-400 hover:text-violet-300" />
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
