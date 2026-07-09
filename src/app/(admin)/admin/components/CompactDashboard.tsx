'use client'

import { cn } from '@/lib/utils'
import {
  type LucideIcon,
  FileText,
  Clock,
  AlertTriangle,
  Users,
  Store,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Shield,
  ChevronRight,
  BarChart3,
  UserPlus,
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
import {
  PageHeader,
  AdminPanel,
  StatCard,
  IconChip,
  StatusBadge,
  SectionLabel,
  type ChipTone,
} from './kit'

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
  const quickActions: Array<{
    label: string
    href: string
    icon: LucideIcon
    tone: ChipTone
    count: number
  }> = [
    {
      label: 'Review Applications',
      href: '/admin/sellers?status=pending',
      icon: FileText,
      tone: 'warning',
      count: stats.pendingApplications
    },
    {
      label: 'Cancel Requests',
      href: '/admin/orders?tab=cancellations',
      icon: Ban,
      tone: 'warning',
      count: stats.pendingCancellations
    },
    {
      label: 'View Disputes',
      href: '/admin/disputes',
      icon: MessageSquare,
      tone: 'error',
      count: stats.openDisputes
    },
    {
      label: 'Check Fraud',
      href: '/admin/fraud',
      icon: Shield,
      tone: 'error',
      count: stats.openFraudFlags
    },
    {
      label: 'Active Sellers',
      href: '/admin/active-sellers',
      icon: Store,
      tone: 'info',
      count: stats.activeSellers
    },
  ]

  // Admin pages guide
  const adminPages: Array<{
    title: string
    description: string
    icon: LucideIcon
    href: string
  }> = [
    {
      title: 'Seller Applications',
      description: 'Review and approve new seller registrations',
      icon: FileText,
      href: '/admin/sellers',
    },
    {
      title: 'Active Sellers',
      description: 'Manage and monitor active seller accounts',
      icon: Store,
      href: '/admin/active-sellers',
    },
    {
      title: 'Disputes',
      description: 'Handle buyer-seller disputes and refunds',
      icon: MessageSquare,
      href: '/admin/disputes',
    },
    {
      title: 'Analytics',
      description: 'View platform metrics and insights',
      icon: BarChart3,
      href: '/admin/analytics',
    },
    {
      title: 'Fraud Detection',
      description: 'Monitor and investigate fraud alerts',
      icon: Shield,
      href: '/admin/fraud',
    },
    {
      title: 'INFORM Act',
      description: 'High-value seller compliance tracking',
      icon: BadgeCheck,
      href: '/admin/inform',
    },
    {
      title: 'GDPR',
      description: 'Data privacy and user rights management',
      icon: Lock,
      href: '/admin/gdpr',
    },
    {
      title: 'Games',
      description: 'Manage supported games and categories',
      icon: Gamepad2,
      href: '/admin/games',
    },
    {
      title: 'Moderation',
      description: 'Review listings and user content',
      icon: ClipboardCheck,
      href: '/admin/moderation',
    },
    {
      title: 'Utilities',
      description: 'Admin tools and system utilities',
      icon: Wrench,
      href: '/admin/utils',
    },
  ]

  // System health indicator
  const healthConfig: Record<
    DashboardStats['systemHealth'],
    { label: string; dot: string; text: string }
  > = {
    good: { label: 'Good', dot: 'bg-success', text: 'text-success' },
    warning: { label: 'Warning', dot: 'bg-warning', text: 'text-warning' },
    critical: { label: 'Critical', dot: 'bg-error', text: 'text-error' },
  }
  const health = healthConfig[stats.systemHealth]

  const revenueChange = getRevenueChange()

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Welcome back, ${admin.full_name || admin.username || 'Admin'}`}
        description="Platform overview and quick actions"
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-raised px-3 py-2 text-[12.5px] font-semibold text-text-secondary">
            <span className={cn('h-2 w-2 animate-pulse rounded-full', health.dot)} />
            System <span className={health.text}>{health.label}</span>
          </div>
        }
        className="mb-0"
      />

      {/* Quick Actions */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group relative rounded-xl border border-border-default bg-bg-raised p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-raised-hover"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <IconChip icon={action.icon} tone={action.tone} size="lg" />
                {action.count > 0 && (
                  <span className="text-xl font-bold tabular-nums text-lime-text">
                    {action.count}
                  </span>
                )}
              </div>
              <p className="text-[13px] font-semibold text-text-secondary transition-colors group-hover:text-text-primary">
                {action.label}
              </p>
              <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-text-tertiary transition-colors group-hover:text-text-primary" />
            </Link>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div>
        <SectionLabel>Key Metrics</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Orders"
            value={stats.totalOrders.toLocaleString()}
            sub={`${stats.ordersToday} today`}
            icon={FileText}
            tone="info"
          />
          <StatCard
            label="Active"
            value={stats.activeOrders}
            sub="In progress"
            icon={Clock}
            tone="neutral"
          />
          <StatCard
            label="Revenue"
            value={formatCurrency(stats.totalRevenue)}
            sub="All time"
            icon={DollarSign}
            tone="success"
          />
          <StatCard
            label="This Month"
            value={formatCurrency(stats.revenueThisMonth)}
            sub="vs last month"
            delta={revenueChange}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Users"
            value={stats.totalUsers.toLocaleString()}
            sub={`${stats.usersToday} today`}
            icon={Users}
            tone="neutral"
          />
          <StatCard
            label="Sellers"
            value={stats.activeSellers}
            sub={`${stats.approvedToday} approved today`}
            icon={Store}
            tone="lime"
          />
        </div>
      </div>

      {/* Two Column Layout for Pages Guide and Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Admin Pages Guide */}
        <div>
          <SectionLabel>Admin Pages</SectionLabel>
          <AdminPanel pad={false} className="overflow-hidden">
            <div className="divide-y divide-border-subtle">
              {adminPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-overlay"
                >
                  <IconChip icon={page.icon} tone="neutral" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-text-primary transition-colors group-hover:text-lime-text">
                      {page.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-text-tertiary">
                      {page.description}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary" />
                </Link>
              ))}
            </div>
          </AdminPanel>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel className="mb-0">Recent Activity</SectionLabel>

            {/* Active/Resolved Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-raised p-1">
              <button
                onClick={() => setActivityFilter('active')}
                className={cn(
                  'rounded-md border px-3 py-1 text-[11.5px] font-semibold transition-colors',
                  activityFilter === 'active'
                    ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                )}
              >
                Active
              </button>
              <button
                onClick={() => setActivityFilter('resolved')}
                className={cn(
                  'rounded-md border px-3 py-1 text-[11.5px] font-semibold transition-colors',
                  activityFilter === 'resolved'
                    ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary'
                )}
              >
                Resolved
              </button>
            </div>
          </div>

          <AdminPanel pad={false} className="overflow-hidden">
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
                  <div className="px-4 py-10 text-center">
                    <p className="text-[13px] text-text-tertiary">
                      No {activityFilter} activities
                    </p>
                    {activityFilter === 'active' && (
                      <p className="mt-2 text-xs text-text-tertiary">
                        Check <span className="font-semibold text-text-secondary">Resolved</span> for history
                      </p>
                    )}
                  </div>
                )
              }

              return (
                <div className="divide-y divide-border-subtle">
                  {displayedActivities.map((activity) => {
                    const typeConfig: Record<
                      typeof activity.type,
                      { icon: LucideIcon; tone: ChipTone }
                    > = {
                      dispute: { icon: AlertTriangle, tone: 'error' },
                      application: { icon: UserPlus, tone: 'info' },
                      fraud: { icon: Shield, tone: 'warning' },
                    }
                    const config = typeConfig[activity.type]

                    return (
                      <Link
                        key={activity.id}
                        href={activity.link || '#'}
                        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-overlay"
                      >
                        {/* Icon or Game Logo */}
                        {activity.metadata?.gameIcon ? (
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-overlay">
                            <Image
                              src={activity.metadata.gameIcon}
                              alt={activity.metadata.gameName || 'Game'}
                              width={36}
                              height={36}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <IconChip icon={config.icon} tone={config.tone} />
                        )}

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold text-text-primary">
                            {activity.title}
                          </p>

                          {/* For disputes: show game name, item, amount */}
                          {activity.type === 'dispute' && activity.metadata ? (
                            <div className="mt-1 space-y-0.5">
                              {activity.metadata.gameName && (
                                <p className="text-xs text-text-secondary">
                                  {activity.metadata.gameName}
                                </p>
                              )}
                              {activity.metadata.itemTitle && (
                                <p className="line-clamp-1 text-xs text-text-tertiary">
                                  {activity.metadata.itemTitle}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                {activity.metadata.amount && (
                                  <p className="text-xs font-semibold tabular-nums text-lime-text">
                                    {formatCurrency(activity.metadata.amount)}
                                  </p>
                                )}
                                {activity.metadata.orderNumber && (
                                  <p className="text-xs text-text-tertiary">
                                    #{activity.metadata.orderNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-0.5 line-clamp-1 text-xs text-text-tertiary">
                              {activity.description}
                            </p>
                          )}

                          <p className="mt-1.5 text-[11px] text-text-tertiary">
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
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <StatusBadge status={activity.status} />
                          </div>
                        )}
                      </Link>
                    )
                  })}

                  {/* View All Button */}
                  {hasMore && (
                    <Link
                      href="/admin/activities"
                      className="group flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold text-lime-text transition-colors hover:bg-bg-overlay"
                    >
                      View All Activities
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
              )
            })()}
          </AdminPanel>
        </div>

      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending Reviews" value={stats.pendingReviews} />
        <StatCard label="High Priority Disputes" value={stats.highPriorityDisputes} />
        <StatCard label="High Severity Fraud" value={stats.highSeverityFlags} />
        <StatCard label="Unread Notifications" value={stats.unreadNotifications} />
      </div>
    </div>
  )
}
