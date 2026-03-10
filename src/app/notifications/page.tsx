'use client'

/**
 * Notifications Page
 *
 * Full notifications inbox at /notifications.
 * Linked from the bell dropdown "View all notifications".
 * Features: All / Unread filter tabs, mark-as-read, mark-all-read, clear-read.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  const map: Record<string, { icon: string; bg: string; text: string }> = {
    order_placed:    { icon: '🛍️', bg: 'bg-blue-500/20',   text: 'text-blue-400' },
    order_delivered: { icon: '📦', bg: 'bg-green-500/20',  text: 'text-green-400' },
    order_completed: { icon: '✅', bg: 'bg-green-500/20',  text: 'text-green-400' },
    order_disputed:  { icon: '⚠️', bg: 'bg-red-500/20',    text: 'text-red-400' },
    message:         { icon: '💬', bg: 'bg-violet-500/20', text: 'text-violet-400' },
    review:          { icon: '⭐', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    payout:          { icon: '💰', bg: 'bg-emerald-500/20','text': 'text-emerald-400' },
    system:          { icon: '🔔', bg: 'bg-gray-500/20',   text: 'text-gray-400' },
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
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)
    queryClient.invalidateQueries({ queryKey: ['notifications-page', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-list', user?.id] })
    setMarking(false)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (!user) {
    router.replace('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        {/* Back + Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm text-gray-400">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full text-xs text-gray-400 hover:bg-white/10 hover:text-white"
              onClick={markAllRead}
              disabled={marking}
            >
              {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-xl bg-white/[0.04] p-1">
          {(['all', 'unread'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors',
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

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
              <Bell className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-white">
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-gray-400">
              {tab === 'unread' ? "You're all caught up!" : "We'll notify you about orders, messages, and more."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {notifications.map((notification: any) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 6 }}
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
                      'group flex items-start gap-3 rounded-xl border p-4 transition-all hover:bg-white/[0.04]',
                      notification.is_read
                        ? 'border-white/[0.05] bg-transparent'
                        : 'border-violet-500/20 bg-violet-500/[0.06]'
                    )}
                  >
                    <NotificationIcon type={notification.type || 'system'} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm font-semibold leading-snug', notification.is_read ? 'text-gray-300' : 'text-white')}>
                          {notification.title}
                        </p>
                        <span className="flex-shrink-0 text-xs text-gray-500">
                          {timeAgo(notification.created_at)}
                        </span>
                      </div>
                      {notification.message && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{notification.message}</p>
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
    </div>
  )
}
