'use client'

/**
 * Dashboard → Recent Activity: Active / Resolved (SegmentedTabs), latest nine.
 * Its own section so the page streams it in after the numbers above.
 */

import Image from 'next/image'
import Link from '@/components/navigation/AppLink'
import { useState } from 'react'
import { ArrowRight, Scales, ShieldWarning, UserPlus, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { Sk } from '@/components/account/AccountSkeletons'
import { AdminPanel, IconChip, SectionLabel, StatusBadge, type ChipTone } from './kit'
import { SkAdminRows, SkSectionLabel } from './AdminSkeletons'

interface RecentActivity {
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
}

const ACTIVITY_TYPE: Record<RecentActivity['type'], { icon: PhosphorIcon; tone: ChipTone }> = {
  dispute: { icon: Scales, tone: 'error' },
  application: { icon: UserPlus, tone: 'info' },
  fraud: { icon: ShieldWarning, tone: 'warning' },
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

export function RecentActivitySkeleton() {
  return (
    <section className="min-w-0 lg:col-span-3" aria-busy aria-label="Loading">
      <div className="mb-3 flex items-center justify-between">
        <SkSectionLabel className="mb-0" />
        <Sk className="h-[38px] w-40 rounded-lg" />
      </div>
      <SkAdminRows count={5} />
    </section>
  )
}

export function RecentActivityPanel({
  activities,
  failed,
}: {
  activities: RecentActivity[]
  /** The feed query failed: say so instead of "No activities". */
  failed: boolean
}) {
  const [activityFilter, setActivityFilter] = useState<'active' | 'resolved'>('active')

  const filteredActivities = activities.filter((activity) => {
    const s = activity.status?.toLowerCase() ?? ''
    const isResolved = s.includes('resolved') || s.includes('closed')
    return activityFilter === 'resolved' ? isResolved : !isResolved
  })
  const displayedActivities = filteredActivities.slice(0, 9)
  const hasMore = filteredActivities.length > 9

  return (
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
        {failed ? (
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
  )
}
