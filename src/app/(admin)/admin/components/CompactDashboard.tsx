'use client'

import { cn } from '@/lib/utils'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Store,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Shield,
  ChevronRight,
  BarChart3,
  AlertOctagon,
  UserPlus,
  Eye,
  Settings,
  Zap,
  Gamepad2,
  Lock,
  BadgeCheck,
  ClipboardCheck,
  Wrench,
  ArrowRight,
  Ban
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import type { DashboardStats } from '@/lib/actions/admin-dashboard'

interface CompactDashboardProps {
  stats: DashboardStats
  activities: Array<{
    id: string
    type: 'dispute' | 'application' | 'fraud'
    title: string
    description: string
    timestamp: string
    status?: string
    severity?: 'low' | 'medium' | 'high'
    link?: string
    metadata?: {
      gameName?: string
      gameIcon?: string
      itemTitle?: string
      amount?: number
      currency?: string
      orderNumber?: string
    }
  }>
  admin: any
}

export default function CompactDashboard({ stats, activities, admin }: CompactDashboardProps) {
  const [activityFilter, setActivityFilter] = useState<'active' | 'resolved'>('active')

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Helper to calculate percentage change
  const getRevenueChange = () => {
    if (stats.revenueLastMonth === 0) return 0
    return ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth) * 100
  }

  // Quick action buttons
  const quickActions = [
    {
      label: 'Review Applications',
      href: '/admin/sellers?status=pending',
      icon: FileText,
      color: 'from-yellow-500 to-orange-500',
      count: stats.pendingApplications
    },
    {
      label: 'Cancel Requests',
      href: '/admin/orders?tab=cancellations',
      icon: Ban,
      color: 'from-amber-500 to-orange-500',
      count: stats.pendingCancellations
    },
    {
      label: 'View Disputes',
      href: '/admin/disputes',
      icon: MessageSquare,
      color: 'from-red-500 to-pink-500',
      count: stats.openDisputes
    },
    {
      label: 'Check Fraud',
      href: '/admin/fraud',
      icon: Shield,
      color: 'from-purple-500 to-violet-500',
      count: stats.openFraudFlags
    },
    {
      label: 'Active Sellers',
      href: '/admin/active-sellers',
      icon: Store,
      color: 'from-blue-500 to-cyan-500',
      count: stats.activeSellers
    },
  ]

  // Admin pages guide
  const adminPages = [
    {
      title: 'Seller Applications',
      description: 'Review and approve new seller registrations',
      icon: FileText,
      href: '/admin/sellers',
      color: 'text-yellow-400'
    },
    {
      title: 'Active Sellers',
      description: 'Manage and monitor active seller accounts',
      icon: Store,
      href: '/admin/active-sellers',
      color: 'text-purple-400'
    },
    {
      title: 'Disputes',
      description: 'Handle buyer-seller disputes and refunds',
      icon: MessageSquare,
      href: '/admin/disputes',
      color: 'text-orange-400'
    },
    {
      title: 'Analytics',
      description: 'View platform metrics and insights',
      icon: BarChart3,
      href: '/admin/analytics',
      color: 'text-blue-400'
    },
    {
      title: 'Fraud Detection',
      description: 'Monitor and investigate fraud alerts',
      icon: Shield,
      href: '/admin/fraud',
      color: 'text-red-400'
    },
    {
      title: 'INFORM Act',
      description: 'High-value seller compliance tracking',
      icon: BadgeCheck,
      href: '/admin/inform',
      color: 'text-indigo-400'
    },
    {
      title: 'GDPR',
      description: 'Data privacy and user rights management',
      icon: Lock,
      href: '/admin/gdpr',
      color: 'text-green-400'
    },
    {
      title: 'Games',
      description: 'Manage supported games and categories',
      icon: Gamepad2,
      href: '/admin/games',
      color: 'text-cyan-400'
    },
    {
      title: 'Moderation',
      description: 'Review listings and user content',
      icon: ClipboardCheck,
      href: '/admin/moderation',
      color: 'text-pink-400'
    },
    {
      title: 'Utilities',
      description: 'Admin tools and system utilities',
      icon: Wrench,
      href: '/admin/utils',
      color: 'text-gray-400'
    },
  ]

  // System health indicator
  const healthConfig = {
    good: { label: 'Good', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    warning: { label: 'Warning', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  }
  const health = healthConfig[stats.systemHealth]

  const revenueChange = getRevenueChange()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {admin.full_name || admin.username || 'Admin'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Platform overview and quick actions</p>
        </div>

        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
          health.bg, health.border, health.color
        )}>
          <div className={cn("h-2 w-2 rounded-full animate-pulse", health.color.replace('text-', 'bg-'))} />
          System {health.label}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                    action.color,
                    "bg-opacity-10"
                  )}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  {action.count > 0 && (
                    <span className="text-xl font-bold text-white">{action.count}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-300">{action.label}</p>
                <ChevronRight className="h-4 w-4 text-gray-600 absolute bottom-3 right-3 group-hover:text-white transition-colors" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Total Orders */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-sm text-gray-500">Orders</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalOrders.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">{stats.ordersToday} today</p>
          </div>

          {/* Active Orders */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.activeOrders}</p>
            <p className="text-xs text-gray-600 mt-1">In progress</p>
          </div>

          {/* Total Revenue */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
              <p className="text-sm text-gray-500">Revenue</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs text-gray-600 mt-1">All time</p>
          </div>

          {/* This Month Revenue */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-sm text-gray-500">This Month</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(stats.revenueThisMonth)}</p>
            <p className={cn(
              "text-xs mt-1",
              revenueChange >= 0 ? "text-green-400" : "text-red-400"
            )}>
              {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}% vs last
            </p>
          </div>

          {/* Total Users */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-sm text-gray-500">Users</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">{stats.usersToday} today</p>
          </div>

          {/* Active Sellers */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Store className="h-4 w-4 text-violet-400" />
              </div>
              <p className="text-sm text-gray-500">Sellers</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.activeSellers}</p>
            <p className="text-xs text-gray-600 mt-1">{stats.approvedToday} approved today</p>
          </div>

        </div>
      </div>

      {/* Two Column Layout for Pages Guide and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Admin Pages Guide */}
        <div>
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Admin Pages</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 space-y-2">
            {adminPages.map((page) => {
              const Icon = page.icon
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all group"
                >
                  <div className="h-9 w-9 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                    <Icon className={cn("h-5 w-5", page.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                      {page.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {page.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors flex-shrink-0 mt-1" />
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Recent Activity</h2>

            {/* Active/Resolved Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <button
                onClick={() => setActivityFilter('active')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  activityFilter === 'active'
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "text-gray-500 hover:text-gray-400"
                )}
              >
                Active
              </button>
              <button
                onClick={() => setActivityFilter('resolved')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  activityFilter === 'resolved'
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : "text-gray-500 hover:text-gray-400"
                )}
              >
                Resolved
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            {(() => {
              // Filter activities based on resolved status
              const filteredActivities = activities.filter(activity => {
                const isResolved = activity.status?.toLowerCase().includes('resolved') ||
                                  activity.status?.toLowerCase().includes('closed')
                return activityFilter === 'resolved' ? isResolved : !isResolved
              })

              // Limit to 9 activities
              const displayedActivities = filteredActivities.slice(0, 9)
              const hasMore = filteredActivities.length > 9

              if (displayedActivities.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">
                      No {activityFilter} activities
                    </p>
                    {activityFilter === 'active' && (
                      <p className="text-xs text-gray-600 mt-2">
                        Check <span className="text-green-400">Resolved</span> for history
                      </p>
                    )}
                  </div>
                )
              }

              return (
                <div className="space-y-2">
                  {displayedActivities.map((activity) => {
                    const typeConfig = {
                      dispute: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                      application: { icon: UserPlus, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                      fraud: { icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                    }
                    const config = typeConfig[activity.type]
                    const Icon = config.icon

                    return (
                      <Link
                        key={activity.id}
                        href={activity.link || '#'}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all group"
                      >
                        {/* Icon or Game Logo */}
                        {activity.metadata?.gameIcon ? (
                          <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.03] border border-white/[0.06]">
                            <Image
                              src={activity.metadata.gameIcon}
                              alt={activity.metadata.gameName || 'Game'}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", config.bg)}>
                            <Icon className={cn("h-5 w-5", config.color)} />
                          </div>
                        )}

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">
                            {activity.title}
                          </p>

                          {/* For disputes: show game name, item, amount */}
                          {activity.type === 'dispute' && activity.metadata ? (
                            <div className="mt-1 space-y-0.5">
                              {activity.metadata.gameName && (
                                <p className="text-xs text-gray-400">
                                  {activity.metadata.gameName}
                                </p>
                              )}
                              {activity.metadata.itemTitle && (
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {activity.metadata.itemTitle}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                {activity.metadata.amount && (
                                  <p className="text-xs font-medium text-violet-400">
                                    {formatCurrency(activity.metadata.amount)}
                                  </p>
                                )}
                                {activity.metadata.orderNumber && (
                                  <p className="text-xs text-gray-600">
                                    #{activity.metadata.orderNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {activity.description}
                            </p>
                          )}

                          <p className="text-xs text-gray-600 mt-1.5">
                            {new Date(activity.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>

                        {/* Status Badge */}
                        {activity.status && (
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={cn(
                              "text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap",
                              activity.status.toLowerCase().includes('resolved') && "bg-green-500/20 text-green-400 border border-green-500/30",
                              activity.status.toLowerCase().includes('closed') && "bg-gray-500/20 text-gray-400 border border-gray-500/30",
                              activity.status.toLowerCase().includes('open') && "bg-red-500/20 text-red-400 border border-red-500/30",
                              activity.status.toLowerCase().includes('review') && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
                              activity.status.toLowerCase().includes('awaiting') && "bg-orange-500/20 text-orange-400 border border-orange-500/30",
                              activity.status.toLowerCase().includes('escalated') && "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                              activity.status.toLowerCase().includes('pending') && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                              activity.status.toLowerCase().includes('approved') && "bg-green-500/20 text-green-400 border border-green-500/30",
                              activity.status.toLowerCase().includes('rejected') && "bg-red-500/20 text-red-400 border border-red-500/30"
                            )}>
                              {activity.status}
                            </span>
                          </div>
                        )}
                      </Link>
                    )
                  })}

                  {/* View All Button */}
                  {hasMore && (
                    <Link
                      href="/admin/activities"
                      className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-500/30 transition-all group mt-2"
                    >
                      <span className="text-sm font-medium text-violet-400 group-hover:text-violet-300">
                        View All Activities
                      </span>
                      <ArrowRight className="h-4 w-4 text-violet-400 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  )}
                </div>
              )
            })()}
          </div>
        </div>

      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
          <p className="text-sm text-gray-500 mb-2">Pending Reviews</p>
          <p className="text-2xl font-bold text-white">{stats.pendingReviews}</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
          <p className="text-sm text-gray-500 mb-2">High Priority Disputes</p>
          <p className="text-2xl font-bold text-white">{stats.highPriorityDisputes}</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
          <p className="text-sm text-gray-500 mb-2">High Severity Fraud</p>
          <p className="text-2xl font-bold text-white">{stats.highSeverityFlags}</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
          <p className="text-sm text-gray-500 mb-2">Unread Notifications</p>
          <p className="text-2xl font-bold text-white">{stats.unreadNotifications}</p>
        </div>

      </div>
    </div>
  )
}
