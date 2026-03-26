'use client'

import { Bell, Search, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import type { AdminRole } from '@/lib/actions/admin-permissions'

interface AdminHeaderProps {
  role: string
  user: {
    id: string
    email?: string
  }
}

export default function AdminHeader({ role, user }: AdminHeaderProps) {
  // For display purposes, extract name from email or use default
  const displayName = user.email?.split('@')[0] || 'Admin'
  const displayInitial = user.email?.[0]?.toUpperCase() || 'A'

  const admin = {
    id: user.id,
    email: user.email || '',
    username: displayName,
    full_name: displayName,
    avatar_url: null,
    role: role as AdminRole,
  }
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  // Get unread notification count
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
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  // Get recent UNREAD notifications for dropdown
  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications-list', user.id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) return []
      return data || []
    },
    refetchInterval: 10000,
  })

  const unreadNotificationCount = notificationCount || 0
  const recentNotifications = notifications || []

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    const supabase = createClient()
    const { error } = await (supabase
      .from('notifications')
      .update as any)({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    queryClient.invalidateQueries({ queryKey: ['admin-notifications-list', user.id] })
    queryClient.invalidateQueries({ queryKey: ['admin-unread-notifications', user.id] })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/admin/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-60 h-16 z-40">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xl border-b border-white/[0.1]" />

      <div className="relative h-full px-4 lg:px-8 flex items-center justify-between">
        {/* Left Side - Search Bar */}
        <div className="flex-1 max-w-xl">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className={cn(
                  "h-4 w-4 transition-colors duration-200",
                  searchFocused ? "text-white" : "text-gray-500"
                )} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search users, applications, disputes..."
                className={cn(
                  "w-full pl-10 pr-4 py-2 bg-white/[0.05] rounded-lg",
                  "text-white placeholder-gray-500",
                  "border transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
                  searchFocused
                    ? "border-violet-500/50 bg-white/[0.08]"
                    : "border-white/[0.1] hover:border-white/[0.2]"
                )}
              />
            </div>
          </form>
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center space-x-4 ml-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowUserMenu(false)
              }}
              className="relative p-2 rounded-lg hover:bg-white/[0.1] transition-all duration-200 group"
            >
              <Bell className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              {unreadNotificationCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full flex items-center justify-center"
                >
                  <span className="text-[10px] text-white font-medium">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                </motion.span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-80 bg-black/90 backdrop-blur-xl rounded-xl border border-white/[0.1] shadow-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-white/[0.1]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                      {unreadNotificationCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-full">
                          {unreadNotificationCount} new
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No new notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.05]">
                        {recentNotifications.map((notification: any) => (
                          <Link
                            key={notification.id}
                            href={notification.link || '#'}
                            onClick={() => {
                              markAsRead(notification.id)
                              setShowNotifications(false)
                            }}
                            className="block p-4 hover:bg-white/[0.05] cursor-pointer transition-colors"
                          >
                            <p className="text-sm font-medium text-white">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notification.created_at).toLocaleDateString('en-US', {
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
                  <div className="p-3 border-t border-white/[0.1]">
                    <Link
                      href="/admin/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="block w-full text-center text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors"
                    >
                      View all notifications
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowNotifications(false)
              }}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/[0.1] transition-all duration-200"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {admin.full_name?.[0] || admin.username?.[0] || admin.email[0].toUpperCase()}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">
                  {admin.full_name || admin.username || 'Admin'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {admin.role.replace('_', ' ')}
                </p>
              </div>
            </button>

            {/* User Dropdown */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-56 bg-black/90 backdrop-blur-xl rounded-xl border border-white/[0.1] shadow-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-white/[0.1]">
                    <p className="text-sm font-medium text-white">
                      {admin.full_name || admin.username || 'Admin'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{admin.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        router.push('/admin/profile')
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/[0.1] rounded-lg transition-colors"
                    >
                      Profile Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}