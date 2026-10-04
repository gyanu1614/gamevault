'use client'

/**
 * Admin dashboard (account-section design, 2026-09-30 overhaul).
 *
 *   Header + system health
 *   Quick Actions   the queues, as cards: a swipeable row on phones, a grid
 *                   from sm. The count takes its queue's colour only when
 *                   something is waiting.
 *   Key Metrics     one panel with hairlines (StatStrip), not six boxes.
 *   Recent Activity Active / Resolved (SegmentedTabs), latest nine.
 *   Other Pages     admin pages that are NOT in the sidebar (Reviews,
 *                   Activities, Notifications, GDPR, INFORM Act): the sidebar
 *                   already lists the rest, so the old ten-row guide repeated it.
 *   Queue Health    the second row of counts.
 */

import Image from 'next/image'
import Link from '@/components/navigation/AppLink'
import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CaretRight,
  ClockCounterClockwise,
  FileText,
  IdentificationBadge,
  LockKey,
  Prohibit,
  Scales,
  ShieldWarning,
  Star,
  Storefront,
  UserPlus,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/lib/actions/admin-dashboard'
import { StatStrip, type Stat } from '@/components/account/AccountSurface'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { AdminPanel, IconChip, PageHeader, SectionLabel, StatusBadge, type ChipTone } from './kit'

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
  /** The feed query failed: say so instead of "No activities". */
  activityFailed?: boolean
  admin: any
}

const COUNT_TEXT: Record<ChipTone, string> = {
  neutral: 'text-text-primary',
  lime: 'text-lime-text',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-text-primary',
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

const ACTIVITY_TYPE: Record<'dispute' | 'application' | 'fraud', { icon: PhosphorIcon; tone: ChipTone }> = {
  dispute: { icon: Scales, tone: 'error' },
  application: { icon: UserPlus, tone: 'info' },
  fraud: { icon: ShieldWarning, tone: 'warning' },
}

/** Admin pages the sidebar doesn't list (reachable here and from search). */
const OTHER_PAGES: Array<{ title: string; description: string; icon: PhosphorIcon; href: string }> = [
  { title: 'Reviews', description: 'Buyer reviews and their moderation', icon: Star, href: '/admin/reviews' },
  { title: 'Activities', description: 'The full activity log', icon: ClockCounterClockwise, href: '/admin/activities' },
  { title: 'Notifications', description: 'Everything sent to your admin inbox', icon: Bell, href: '/admin/notifications' },
  { title: 'GDPR Requests', description: 'Data export and deletion requests', icon: LockKey, href: '/admin/gdpr' },
  { title: 'INFORM Act', description: 'High-volume seller compliance', icon: IdentificationBadge, href: '/admin/inform' },
]

export default function CompactDashboard({ stats, activities, activityFailed, admin }: CompactDashboardProps) {
  const [activityFilter, setActivityFilter] = useState<'active' | 'resolved'>('active')

  const revenueChange =
    stats.revenueLastMonth === 0 ? 0 : ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth) * 100

  const quickActions: Array<{ label: string; href: string; icon: PhosphorIcon; tone: ChipTone; count: number }> = [
    { label: 'Review Applications', href: '/admin/sellers?status=pending', icon: FileText, tone: 'warning', count: stats.pendingApplications },
    { label: 'Cancel Requests', href: '/admin/orders?tab=cancellations', icon: Prohibit, tone: 'warning', count: stats.pendingCancellations },
    { label: 'View Disputes', href: '/admin/disputes', icon: Scales, tone: 'error', count: stats.openDisputes },
    { label: 'Check Fraud', href: '/admin/fraud', icon: ShieldWarning, tone: 'error', count: stats.openFraudFlags },
    { label: 'Active Sellers', href: '/admin/active-sellers', icon: Storefront, tone: 'info', count: stats.activeSellers },
  ]

  const health = {
    good: { label: 'Good', dot: 'bg-success', text: 'text-success' },
    warning: { label: 'Warning', dot: 'bg-warning', text: 'text-warning' },
    critical: { label: 'Critical', dot: 'bg-error', text: 'text-error' },
  }[stats.systemHealth]

  const keyMetrics: Stat[] = [
    { label: 'Orders', value: stats.totalOrders.toLocaleString(), hint: `${stats.ordersToday} today` },
    { label: 'Active Orders', value: stats.activeOrders.toLocaleString(), hint: 'In progress' },
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue), hint: 'All time' },
    {
      label: 'This Month',
      value: formatCurrency(stats.revenueThisMonth),
      hint: (
        <span className="inline-flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-semibold tabular-nums',
              revenueChange >= 0 ? 'text-success' : 'text-error',
            )}
          >
            {revenueChange >= 0 ? (
              <ArrowUpRight aria-hidden weight="bold" className="h-3 w-3" />
            ) : (
              <ArrowDownRight aria-hidden weight="bold" className="h-3 w-3" />
            )}
            {Math.abs(revenueChange).toFixed(1)}%
          </span>
          vs last month
        </span>
      ),
    },
    { label: 'Users', value: stats.totalUsers.toLocaleString(), hint: `${stats.usersToday} today` },
    { label: 'Active Sellers', value: stats.activeSellers.toLocaleString(), hint: `${stats.approvedToday} approved today` },
  ]

  const queueHealth: Stat[] = [
    { label: 'Pending Reviews', value: stats.pendingReviews },
    { label: 'High Priority Disputes', value: stats.highPriorityDisputes },
    { label: 'High Severity Fraud', value: stats.highSeverityFlags },
    { label: 'Unread Notifications', value: stats.unreadNotifications },
  ]

  const filteredActivities = activities.filter((activity) => {
    const s = activity.status?.toLowerCase() ?? ''
    const isResolved = s.includes('resolved') || s.includes('closed')
    return activityFilter === 'resolved' ? isResolved : !isResolved
  })
  const displayedActivities = filteredActivities.slice(0, 9)
  const hasMore = filteredActivities.length > 9

  return (
    <div className="space-y-7 sm:space-y-8">
      <PageHeader
        title={`Welcome back, ${admin.full_name || admin.username || 'Admin'}`}
        description="Platform overview and quick actions"
        actions={
          <div className="flex h-9 items-center gap-2 rounded-md bg-bg-raised px-3 text-[13px] font-medium text-text-secondary">
            <span className={cn('h-2 w-2 rounded-full', health.dot)} aria-hidden />
            System <span className={cn('font-semibold', health.text)}>{health.label}</span>
          </div>
        }
        className="mb-0 sm:mb-0"
      />

      {/* Quick Actions — swipe row on phones, grid from sm */}
      <section>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex w-[44%] min-w-[152px] shrink-0 snap-start flex-col rounded-lg bg-bg-raised p-4 transition-colors hover:bg-bg-raised-hover sm:w-auto sm:min-w-0"
            >
              <div className="flex items-start justify-between gap-2">
                <IconChip icon={action.icon} tone={action.tone} size="lg" />
                <span
                  className={cn(
                    'text-[22px] font-bold leading-none tabular-nums',
                    action.count > 0 ? COUNT_TEXT[action.tone] : 'text-text-disabled',
                  )}
                >
                  {action.count.toLocaleString()}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-[13.5px] font-semibold text-text-secondary transition-colors group-hover:text-text-primary">
                  {action.label}
                </p>
                <CaretRight
                  aria-hidden
                  weight="bold"
                  className="h-4 w-4 shrink-0 text-text-tertiary transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text-primary"
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Key Metrics — one panel, hairlines between cells */}
      <section>
        <SectionLabel>Key Metrics</SectionLabel>
        <StatStrip stats={keyMetrics} className="md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6" />
      </section>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-5 lg:gap-6">
        {/* Recent Activity */}
        <section className="min-w-0 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionLabel className="mb-0">Recent Activity</SectionLabel>
            <SegmentedTabs
              tabs={[
                { id: 'active', label: 'Active' },
                { id: 'resolved', label: 'Resolved' },
              ]}
              value={activityFilter}
              onChange={setActivityFilter}
              layoutId="admin-dashboard-activity"
              ariaLabel="Activity filter"
            />
          </div>

          <AdminPanel pad={false} className="overflow-hidden">
            {activityFailed ? (
              <div className="px-4 py-10 text-center" role="alert">
                <p className="text-[13.5px] text-error">Couldn’t load activity. Refresh to try again.</p>
              </div>
            ) : displayedActivities.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-[13.5px] font-medium text-text-secondary">No {activityFilter} activity</p>
                {activityFilter === 'active' && (
                  <p className="mt-1.5 text-[12.5px] text-text-tertiary">
                    Older items are under <span className="font-semibold text-text-secondary">Resolved</span>.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {displayedActivities.map((activity) => {
                  const config = ACTIVITY_TYPE[activity.type]
                  return (
                    <Link
                      key={activity.id}
                      href={activity.link || '#'}
                      className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
                    >
                      {activity.metadata?.gameIcon ? (
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-bg-overlay">
                          <Image
                            src={activity.metadata.gameIcon}
                            alt={activity.metadata.gameName || 'Game'}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <IconChip icon={config.icon} tone={config.tone} size="lg" />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-text-primary">{activity.title}</p>

                        {activity.type === 'dispute' && activity.metadata ? (
                          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                            {activity.metadata.gameName && (
                              <span className="text-text-secondary">{activity.metadata.gameName}</span>
                            )}
                            {activity.metadata.itemTitle && (
                              <span className="min-w-0 truncate text-text-tertiary">{activity.metadata.itemTitle}</span>
                            )}
                            {!!activity.metadata.amount && (
                              <span className="font-semibold tabular-nums text-text-primary">
                                {formatCurrency(activity.metadata.amount)}
                              </span>
                            )}
                            {activity.metadata.orderNumber && (
                              <span className="text-text-tertiary">#{activity.metadata.orderNumber}</span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-0.5 line-clamp-1 text-[12.5px] text-text-tertiary">{activity.description}</p>
                        )}

                        <p className="mt-1 text-[12px] text-text-tertiary">
                          {new Date(activity.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {activity.status && <StatusBadge status={activity.status} className="shrink-0" />}
                    </Link>
                  )
                })}

                {hasMore && (
                  <Link
                    href="/admin/activities"
                    className="group flex h-12 items-center justify-center gap-2 text-[13.5px] font-semibold text-text-primary transition-colors hover:bg-white/[0.03]"
                  >
                    View All Activity
                    <ArrowRight aria-hidden weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            )}
          </AdminPanel>
        </section>

        {/* Other Pages — the ones the sidebar doesn't list */}
        <section className="min-w-0 lg:col-span-2">
          <SectionLabel className="flex h-[38px] items-center">Other Pages</SectionLabel>
          <AdminPanel pad={false} className="overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {OTHER_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <IconChip icon={page.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-text-primary">{page.title}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">{page.description}</p>
                  </div>
                  <CaretRight
                    aria-hidden
                    weight="bold"
                    className="h-4 w-4 shrink-0 text-text-tertiary transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text-primary"
                  />
                </Link>
              ))}
            </div>
          </AdminPanel>
        </section>
      </div>

      <section>
        <SectionLabel>Queue Health</SectionLabel>
        <StatStrip stats={queueHealth} />
      </section>
    </div>
  )
}
