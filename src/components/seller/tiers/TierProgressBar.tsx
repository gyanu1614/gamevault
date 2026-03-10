/**
 * TierProgressBar
 *
 * Shows how close a seller is to the NEXT tier across four metrics:
 *   • Completed sales
 *   • Average rating
 *   • Account age (days)
 *   • Completion rate
 *
 * All data comes from get_seller_tier_info() via the parent page.
 */

'use client'

import { cn } from '@/lib/utils'

interface SellerStats {
  totalSales: number
  rating: number | null
  accountAgeDays: number
  completionRate: number
}

interface NextTierRequirements {
  tier: string
  displayName: string
  minSales: number
  minRating: number | null
  minAgeDays: number
  minCompletionRate: number | null
}

interface TierProgressBarProps {
  stats: SellerStats
  nextTier: NextTierRequirements | null
  className?: string
}

interface MetricBarProps {
  label: string
  current: number
  required: number
  format?: (v: number) => string
  met: boolean
}

function MetricBar({ label, current, required, format, met }: MetricBarProps) {
  const pct = Math.min((current / required) * 100, 100)
  const fmt = format ?? ((v) => String(v))

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={cn('font-medium tabular-nums', met ? 'text-emerald-400' : 'text-white')}>
          {fmt(current)}{' '}
          <span className="text-zinc-500">/ {fmt(required)}</span>
          {met && <span className="ml-1 text-emerald-400">✓</span>}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            met ? 'bg-emerald-500' : 'bg-violet-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function TierProgressBar({
  stats,
  nextTier,
  className,
}: TierProgressBarProps) {
  if (!nextTier) {
    return (
      <div className={cn('rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-center', className)}>
        <p className="text-sm font-semibold text-violet-400">Diamond Tier</p>
        <p className="mt-1 text-xs text-zinc-500">You have reached the highest tier</p>
      </div>
    )
  }

  const metrics = [
    {
      label: 'Completed Sales',
      current: stats.totalSales,
      required: nextTier.minSales,
      met: stats.totalSales >= nextTier.minSales,
    },
    ...(nextTier.minRating !== null
      ? [
          {
            label: 'Average Rating',
            current: stats.rating ?? 0,
            required: nextTier.minRating,
            format: (v: number) => v.toFixed(1),
            met: (stats.rating ?? 0) >= nextTier.minRating,
          },
        ]
      : []),
    {
      label: 'Account Age (days)',
      current: stats.accountAgeDays,
      required: nextTier.minAgeDays,
      met: stats.accountAgeDays >= nextTier.minAgeDays,
    },
    ...(nextTier.minCompletionRate !== null
      ? [
          {
            label: 'Completion Rate',
            current: stats.completionRate,
            required: nextTier.minCompletionRate,
            format: (v: number) => `${v.toFixed(1)}%`,
            met: stats.completionRate >= nextTier.minCompletionRate,
          },
        ]
      : []),
  ]

  const allMet = metrics.every((m) => m.met)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Progress to {nextTier.displayName}
        </p>
        {allMet && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
            Eligible — upgrade pending daily cron
          </span>
        )}
      </div>
      <div className="space-y-3">
        {metrics.map((m) => (
          <MetricBar key={m.label} {...m} />
        ))}
      </div>
    </div>
  )
}
