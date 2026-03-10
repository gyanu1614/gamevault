'use client'

import { Bell, Search, LogOut, AlertTriangle, FileText, MessageSquare, Shield, TrendingUp, Zap, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import type { AdminRole } from '@/lib/actions/admin-permissions'

interface EnhancedAdminHeaderProps {
  role: string
  user: {
    id: string
    email?: string
  }
}

export default function EnhancedAdminHeader({ role, user }: EnhancedAdminHeaderProps) {
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
  const [showQuickStats, setShowQuickStats] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Refs for dropdowns
  const notificationsRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const quickStatsRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (quickStatsRef.current && !quickStatsRef.current.contains(event.target as Node)) {
        setShowQuickStats(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Get quick stats
  const { data: quickStats } = useQuery({
    queryKey: ['admin-quick-stats', user.id],
    queryFn: async () => {
      const supabase = createClient()

      const [pendingApps, openDisputes, highFraud, activeOrders] = await Promise.all([
        supabase.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
        supabase.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'high'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'paid', 'processing']),
      ])

      return {
        pendingApplications: pendingApps.count || 0,
        openDisputes: openDisputes.count || 0,
        highSeverityFraud: highFraud.count || 0,
        activeOrders: activeOrders.count || 0,
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

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
    refetchInterval: 10000,
  })

  // Get recent notifications
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

  // Search function
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    const supabase = createClient()
    const results: any[] = []

    // Search users
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, email, full_name')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(3)

    users?.forEach(user => {
      results.push({
        type: 'user',
        id: user.id,
        title: user.username || user.email,
        subtitle: user.full_name || user.email,
        link: `/admin/users/${user.id}`,
      })
    })

    // Search seller applications
    const { data: applications } = await supabase
      .from('seller_applications')
      .select('id, display_name, email, status')
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(3)

    applications?.forEach(app => {
      results.push({
        type: 'application',
        id: app.id,
        title: app.display_name,
        subtitle: `Application - ${app.status}`,
        link: `/admin/sellers/${app.id}`,
      })
    })

    // Search disputes
    const { data: disputes } = await supabase
      .from('disputes')
      .select('id, title, reason, status')
      .or(`title.ilike.%${query}%,reason.ilike.%${query}%`)
      .limit(3)

    disputes?.forEach(dispute => {
      results.push({
        type: 'dispute',
        id: dispute.id,
        title: dispute.title || 'Untitled Dispute',
        subtitle: `${dispute.reason} - ${dispute.status}`,
        link: `/admin/disputes/${dispute.id}`,
      })
    })

    // Search orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .ilike('order_number', `%${query}%`)
      .limit(3)

    orders?.forEach(order => {
      results.push({
        type: 'order',
        id: order.id,
        title: `Order #${order.order_number}`,
        subtitle: `Status: ${order.status}`,
        link: `/admin/analytics`,
      })
    })

    setSearchResults(results)
  }

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 300)
    } else {
      setSearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
      setShowSearchResults(false)
    }
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'user': return '👤'
      case 'application': return '📝'
      case 'dispute': return '⚠️'
      case 'order': return '📦'
      default: return '📄'
    }
  }

  const unreadNotificationCount = notificationCount || 0
  const recentNotifications = notifications || []

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[14.3rem] h-20 z-40">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl border-b border-white/[0.06]" />

      <div className="relative h-full px-4 lg:px-6 flex items-center justify-between gap-4">

        {/* Left Side - Search Bar */}
        <div className="flex-1 max-w-md relative">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  searchFocused ? "text-violet-400" : "text-gray-500"
                )} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  setSearchFocused(true)
                  setShowSearchResults(true)
                }}
                onBlur={() => {
                  setSearchFocused(false)
                  setTimeout(() => setShowSearchResults(false), 200)
                }}
                placeholder="Search everything..."
                className={cn(
                  "w-full pl-8 pr-3 py-1.5 bg-white/[0.04] rounded-lg",
                  "text-white text-xs placeholder-gray-500",
                  "border transition-all",
                  "focus:outline-none focus:ring-1 focus:ring-violet-500/50",
                  searchFocused
                    ? "border-violet-500/30 bg-white/[0.06]"
                    : "border-white/[0.06] hover:border-white/[0.12]"
                )}
              />
            </div>
          </form>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-black/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.link}
                    className="block px-3 py-2.5 hover:bg-white/[0.05] border-b border-white/[0.04] last:border-0 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg">{getResultIcon(result.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{result.title}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{result.subtitle}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-white/[0.06] bg-white/[0.02]">
                <button
                  onClick={() => {
                    router.push(`/admin/search?q=${encodeURIComponent(searchQuery)}`)
                    setShowSearchResults(false)
                  }}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-medium"
                >
                  View all results →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center - Quick Stats */}
        <div className="hidden xl:flex items-center gap-3">
          <Link
            href="/admin/sellers?status=pending"
            className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-all shadow-lg shadow-yellow-500/5"
          >
            <FileText className="h-5 w-5 text-yellow-400" />
            <span className="text-base font-bold text-yellow-300">{quickStats?.pendingApplications || 0}</span>
            <span className="text-sm text-yellow-400/80 font-medium">pending</span>
          </Link>

          <Link
            href="/admin/disputes"
            className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition-all shadow-lg shadow-orange-500/5"
          >
            <MessageSquare className="h-5 w-5 text-orange-400" />
            <span className="text-base font-bold text-orange-300">{quickStats?.openDisputes || 0}</span>
            <span className="text-sm text-orange-400/80 font-medium">disputes</span>
          </Link>

          {(quickStats?.highSeverityFraud || 0) > 0 && (
            <Link
              href="/admin/fraud"
              className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all animate-pulse shadow-lg shadow-red-500/10"
            >
              <Shield className="h-5 w-5 text-red-400" />
              <span className="text-base font-bold text-red-300">{quickStats?.highSeverityFraud}</span>
              <span className="text-sm text-red-400/80 font-medium">fraud</span>
            </Link>
          )}
        </div>

        {/* Right Side - Actions */}
        <div className="flex items-center gap-2">

          {/* Quick Actions Dropdown */}
          <div className="relative hidden md:block" ref={quickStatsRef}>
            <button
              onClick={() => {
                setShowQuickStats(!showQuickStats)
                setShowNotifications(false)
                setShowUserMenu(false)
              }}
              className="p-2.5 rounded-xl hover:bg-white/[0.06] transition-all group"
            >
              <Zap className="h-5 w-5 text-gray-400 group-hover:text-violet-400 transition-colors" />
            </button>

            <AnimatePresence>
              {showQuickStats && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-3 w-72 bg-black/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-white/[0.06]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Quick Actions</h3>
                  </div>
                  <div className="p-2 space-y-1">
                    <Link
                      href="/admin/sellers?status=pending"
                      onClick={() => setShowQuickStats(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                    >
                      <FileText className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm text-white">Review Applications</span>
                    </Link>
                    <Link
                      href="/admin/disputes"
                      onClick={() => setShowQuickStats(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                    >
                      <MessageSquare className="h-4 w-4 text-orange-400" />
                      <span className="text-sm text-white">Handle Disputes</span>
                    </Link>
                    <Link
                      href="/admin/fraud"
                      onClick={() => setShowQuickStats(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                    >
                      <Shield className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-white">Check Fraud Alerts</span>
                    </Link>
                    <Link
                      href="/admin/analytics"
                      onClick={() => setShowQuickStats(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                    >
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-white">View Analytics</span>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowUserMenu(false)
                setShowQuickStats(false)
              }}
              className="relative p-2.5 rounded-xl hover:bg-white/[0.06] transition-all group"
            >
              <Bell className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-violet-500 rounded-full flex items-center justify-center ring-2 ring-black">
                  <span className="text-[10px] text-white font-bold">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-3 w-96 bg-black/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                      {unreadNotificationCount > 0 && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-full">
                          {unreadNotificationCount} new
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <div className="p-12 text-center">
                        <Bell className="h-10 w-10 text-gray-600 mx-auto mb-4" />
                        <p className="text-sm text-gray-500">No new notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {recentNotifications.map((notification: any) => (
                          <Link
                            key={notification.id}
                            href={notification.link || '#'}
                            onClick={() => {
                              markAsRead(notification.id)
                              setShowNotifications(false)
                            }}
                            className="block p-4 hover:bg-white/[0.04] cursor-pointer transition-colors"
                          >
                            <p className="text-sm font-medium text-white">{notification.title}</p>
                            <p className="text-xs text-gray-400 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-1.5">
                              {new Date(notification.created_at).toLocaleString('en-US', {
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
                  <div className="p-3 border-t border-white/[0.06]">
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
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowNotifications(false)
                setShowQuickStats(false)
              }}
              className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] transition-all"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center border border-violet-400/20">
                <span className="text-white text-sm font-bold">{displayInitial}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 hidden md:block" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-3 w-72 bg-black/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-white/[0.06]">
                    <p className="text-sm font-medium text-white">{admin.full_name || admin.username}</p>
                    <p className="text-xs text-gray-500 mt-1">{admin.email}</p>
                    <p className="text-xs text-violet-400 mt-1.5 capitalize">{admin.role.replace('_', ' ')}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        router.push('/admin/settings')
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                    >
                      Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
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
