'use client'

/**
 * /admin/activities — V53 restyle on the admin kit.
 * Neutral surfaces, lime accent for active filters, semantic status
 * colors via the kit StatusBadge.
 *
 * V54 — The activity feed is fetched by the server wrapper (../page.tsx)
 * via the same getAllActivities() action and seeded into react-query via
 * initialData, so the page arrives fully rendered. Type/status filters
 * are purely client-side; the 30s polling refetch keeps working.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllActivities } from '@/lib/actions/admin-dashboard'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  UserPlus,
  Shield,
  ArrowLeft,
  Filter,
  Calendar
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { PageHeader, StatusBadge, type ChipTone } from '../../components/kit'

// The activity array shape as returned by the getAllActivities action.
type ActivityList = NonNullable<Awaited<ReturnType<typeof getAllActivities>>['activities']>

// Free-form status strings → kit badge tone (preserves the old
// `.includes` matching semantics).
function activityTone(status: string): ChipTone {
  const s = status.toLowerCase()
  if (s.includes('resolved') || s.includes('approved')) return 'success'
  if (s.includes('closed')) return 'neutral'
  if (s.includes('rejected') || s.includes('open')) return 'error'
  if (s.includes('review') || s.includes('awaiting') || s.includes('escalated')) return 'warning'
  if (s.includes('pending')) return 'info'
  return 'neutral'
}

const FILTER_BTN = 'px-3 py-1 text-xs font-semibold rounded-md transition-colors'
const FILTER_ACTIVE = 'border border-lime-tint-border bg-lime-tint-bg text-lime-text'
const FILTER_IDLE = 'text-text-tertiary hover:text-text-secondary'

export default function ActivitiesPageClient({
  initialActivities,
}: {
  // undefined = the server fetch failed; fall back to the client-side
  // fetch (loading → error state) exactly as before.
  initialActivities?: ActivityList
}) {
  const [filter, setFilter] = useState<'all' | 'dispute' | 'application' | 'fraud'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-all-activities'],
    queryFn: async () => {
      const result = await getAllActivities()
      if (!result.success) throw new Error(result.error)
      return result.activities || []
    },
    refetchInterval: 30000,
    // V54 — Server-seeded: the page arrives rendered (no "Loading
    // activities…" flash on refresh). initialData counts as fresh for
    // staleTime, so no immediate client refetch either; the 30s polling
    // interval still refreshes as before.
    initialData: initialActivities,
    staleTime: 60_000,
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const filteredActivities = data?.filter(activity => {
    // Type filter
    if (filter !== 'all' && activity.type !== filter) return false

    // Status filter
    if (statusFilter !== 'all') {
      const isResolved = activity.status?.toLowerCase().includes('resolved') ||
                        activity.status?.toLowerCase().includes('closed')
      if (statusFilter === 'resolved' && !isResolved) return false
      if (statusFilter === 'active' && isResolved) return false
    }

    return true
  }) || []

  const typeConfig = {
    dispute: { icon: AlertTriangle, color: 'text-error', bg: 'bg-error-bg', label: 'Disputes' },
    application: { icon: UserPlus, color: 'text-warning', bg: 'bg-warning-bg', label: 'Applications' },
    fraud: { icon: Shield, color: 'text-lime-text', bg: 'bg-lime-tint-bg', label: 'Fraud Alerts' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-overlay transition-colors hover:bg-bg-overlay-2"
        >
          <ArrowLeft className="h-4 w-4 text-text-secondary" />
        </Link>
        <PageHeader
          className="mb-0"
          title="All Activities"
          description={`${filteredActivities.length} ${statusFilter === 'all' ? '' : statusFilter} activities`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-tertiary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Type:</span>
          <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-raised p-1">
            <button
              onClick={() => setFilter('all')}
              className={cn(FILTER_BTN, filter === 'all' ? FILTER_ACTIVE : FILTER_IDLE)}
            >
              All
            </button>
            {Object.entries(typeConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={cn(FILTER_BTN, filter === key ? FILTER_ACTIVE : FILTER_IDLE)}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Status:</span>
          <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-raised p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(FILTER_BTN, statusFilter === 'all' ? FILTER_ACTIVE : FILTER_IDLE)}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={cn(FILTER_BTN, statusFilter === 'active' ? FILTER_ACTIVE : FILTER_IDLE)}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={cn(FILTER_BTN, statusFilter === 'resolved' ? FILTER_ACTIVE : FILTER_IDLE)}
            >
              Resolved
            </button>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="rounded-xl border border-border-default bg-bg-raised">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-lime border-r-transparent"></div>
            <p className="mt-3 text-sm text-text-tertiary">Loading activities...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-sm text-error">Failed to load activities</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
            <p className="text-sm text-text-tertiary">No activities found</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filteredActivities.map((activity) => {
              const config = typeConfig[activity.type]
              const Icon = config.icon

              return (
                <Link
                  key={activity.id}
                  href={activity.link || '#'}
                  className="group flex items-start gap-4 p-4 transition-colors hover:bg-state-hover"
                >
                  {/* Icon or Game Logo */}
                  {activity.metadata?.gameIcon ? (
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-overlay">
                      <Image
                        src={activity.metadata.gameIcon}
                        alt={activity.metadata.gameName || 'Game'}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-border-subtle', config.bg)}>
                      <Icon className={cn('h-6 w-6', config.color)} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary">
                          {activity.title}
                        </p>

                        {/* For disputes: show game name, item, amount */}
                        {activity.type === 'dispute' && activity.metadata ? (
                          <div className="mt-1.5 space-y-1">
                            {activity.metadata.gameName && (
                              <p className="text-sm text-text-secondary">
                                {activity.metadata.gameName}
                              </p>
                            )}
                            {activity.metadata.itemTitle && (
                              <p className="text-sm text-text-tertiary">
                                {activity.metadata.itemTitle}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-3">
                              {activity.metadata.amount && (
                                <p className="text-sm font-semibold tabular-nums text-lime-text">
                                  {formatCurrency(activity.metadata.amount)}
                                </p>
                              )}
                              {activity.metadata.orderNumber && (
                                <p className="text-xs text-text-tertiary">
                                  Order #{activity.metadata.orderNumber}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-text-tertiary">
                            {activity.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-text-tertiary">
                          {new Date(activity.timestamp).toLocaleString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      {/* Status Badge */}
                      {activity.status && (
                        <StatusBadge
                          status={activity.status}
                          tone={activityTone(activity.status)}
                          className="flex-shrink-0 whitespace-nowrap"
                        />
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
