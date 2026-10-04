'use client'

/**
 * /admin/activities — every dispute, application and fraud alert in one feed.
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
import { CalendarBlank, CaretLeft, CaretRight, Scales, ShieldWarning, UserPlus, Warning } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import {
  AdminEmpty,
  AdminLoadingRows,
  FilterChip,
  FilterRow,
  PageHeader,
  StatusBadge,
  type AdminIcon,
  type ChipTone,
} from '../../components/kit'
import { GameTile } from '../../components/GameTile'

// The activity array shape as returned by the getAllActivities action.
type ActivityList = NonNullable<Awaited<ReturnType<typeof getAllActivities>>['activities']>
type TypeFilter = 'all' | 'dispute' | 'application' | 'fraud'
type StatusFilter = 'all' | 'active' | 'resolved'

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

const TYPE_CONFIG: Record<Exclude<TypeFilter, 'all'>, { icon: AdminIcon; tile: string; label: string }> = {
  dispute: { icon: Scales, tile: 'bg-error-bg text-error', label: 'Disputes' },
  application: { icon: UserPlus, tile: 'bg-warning-bg text-warning', label: 'Applications' },
  fraud: { icon: ShieldWarning, tile: 'bg-white/[0.06] text-text-secondary', label: 'Fraud Alerts' },
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export default function ActivitiesPageClient({
  initialActivities,
}: {
  // undefined = the server fetch failed; fall back to the client-side
  // fetch (loading → error state) exactly as before.
  initialActivities?: ActivityList
}) {
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

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

  const isResolved = (status?: string | null) =>
    !!status && (status.toLowerCase().includes('resolved') || status.toLowerCase().includes('closed'))

  const statusMatches = (activity: ActivityList[number]) =>
    statusFilter === 'all' ||
    (statusFilter === 'resolved' ? isResolved(activity.status) : !isResolved(activity.status))

  const filteredActivities =
    data?.filter((activity) => (filter === 'all' || activity.type === filter) && statusMatches(activity)) || []

  const countFor = (type: TypeFilter) =>
    (data ?? []).filter((a) => (type === 'all' || a.type === type) && statusMatches(a)).length

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <PageHeader
          className="mb-0 mt-2 sm:mb-0"
          title="All Activities"
          description="Disputes, seller applications and fraud alerts, newest first. Refreshes every 30 seconds."
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs<TypeFilter>
          tabs={[
            { id: 'all', label: <>All <TabCount n={countFor('all')} /></> },
            ...(Object.keys(TYPE_CONFIG) as Exclude<TypeFilter, 'all'>[]).map((key) => ({
              id: key,
              label: (
                <>
                  {TYPE_CONFIG[key].label} <TabCount n={countFor(key)} />
                </>
              ),
            })),
          ]}
          value={filter}
          onChange={setFilter}
          layoutId="activities-type"
          ariaLabel="Activity type"
        />
        <FilterRow label="Status">
          {(['all', 'active', 'resolved'] as const).map((s) => (
            <FilterChip key={s} selected={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      <div role="tabpanel" id={`activities-type-panel-${filter}`} aria-labelledby={`activities-type-tab-${filter}`}>
        {isLoading ? (
          <AdminLoadingRows rows={6} />
        ) : error ? (
          <AdminEmpty icon={Warning} tone="error" title="Couldn't Load Activities" hint="Try again in a moment." />
        ) : filteredActivities.length === 0 ? (
          <AdminEmpty icon={CalendarBlank} title="No Activities Found" hint="Nothing matches these filters." />
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
            {filteredActivities.map((activity) => {
              const config = TYPE_CONFIG[activity.type]
              const Icon = config.icon
              const meta = activity.metadata

              return (
                <li key={activity.id}>
                  <Link
                    href={activity.link || '#'}
                    className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:gap-4"
                  >
                    {meta?.gameIcon ? (
                      <GameTile src={meta.gameIcon} name={meta.gameName} className="h-10 w-10" />
                    ) : (
                      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', config.tile)}>
                        <Icon aria-hidden weight="bold" className="h-5 w-5" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-[13.5px] font-semibold text-text-primary">{activity.title}</p>
                        {activity.status && (
                          <StatusBadge status={activity.status} tone={activityTone(activity.status)} className="shrink-0" />
                        )}
                      </div>

                      {/* Disputes: game, item, amount, order */}
                      {activity.type === 'dispute' && meta ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-text-tertiary">
                          {meta.amount ? (
                            <span className="font-semibold tabular-nums text-text-primary">{formatCurrency(meta.amount)}</span>
                          ) : null}
                          {meta.gameName && <span className="text-text-secondary">{meta.gameName}</span>}
                          {meta.itemTitle && <span className="truncate">{meta.itemTitle}</span>}
                          {meta.orderNumber && <span className="font-mono text-[12px]">#{meta.orderNumber}</span>}
                        </div>
                      ) : (
                        <p className="mt-0.5 text-[12.5px] text-text-tertiary">{activity.description}</p>
                      )}

                      <p className="mt-1.5 text-[12px] text-text-tertiary">{formatWhen(activity.timestamp)}</p>
                    </div>

                    <CaretRight
                      aria-hidden
                      weight="bold"
                      className="mt-3 hidden h-4 w-4 shrink-0 text-text-disabled transition-colors group-hover:text-text-secondary sm:block"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
