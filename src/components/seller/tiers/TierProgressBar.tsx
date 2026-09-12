/**
 * TierProgressBar — compact horizontal strip showing progress to the next
 * rank across the four trailing-90-day metrics the rank engine judges.
 * Rectangular checkout-modal language: one bordered panel, 4-up metric grid.
 */

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { tierLabel } from '@/lib/seller/tiers'
import type { MyTierInfo } from '@/lib/actions/seller-tiers'

interface TierProgressBarProps {
  tierInfo: MyTierInfo
  className?: string
}

function Metric({
  label,
  current,
  required,
  format,
  met,
  index,
}: {
  label: string
  current: number
  required: number
  format?: (v: number) => string
  met: boolean
  index: number
}) {
  const reduce = useReducedMotion()
  const pct = required <= 0 ? 100 : Math.min((current / required) * 100, 100)
  const fmt = format ?? ((v: number) => String(v))

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-zinc-300">{label}</span>
        <span
          className={cn(
            'whitespace-nowrap text-[12px] font-semibold tabular-nums',
            met ? 'text-emerald-400' : 'text-white',
          )}
        >
          {fmt(current)} <span className="font-normal text-zinc-400">/ {fmt(required)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-white/[0.08]">
        <motion.div
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 22, delay: 0.35 + index * 0.08 }}
          className={cn(
            'h-full',
            met
              ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]'
              : 'bg-lime shadow-[0_0_12px_rgba(198,255,61,0.4)]',
          )}
          style={reduce ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  )
}

const money = (v: number) => `$${Math.round(v).toLocaleString()}`
const pctFmt = (v: number) => `${v}%`

export default function TierProgressBar({ tierInfo, className }: TierProgressBarProps) {
  if (!tierInfo.next_tier) {
    return (
      <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
        <span className="text-[13px] font-semibold text-white">
          {tierLabel(tierInfo.current_tier)} is the top rank.
        </span>
        <span className="text-[12px] text-zinc-400">Stay above its bar to keep it.</span>
      </div>
    )
  }

  // No reviews in the window counts as passing the rating bar.
  const positiveCurrent = tierInfo.window_positive_pct
  const positiveRequired = tierInfo.next_positive_rating_min
  const positiveMet =
    positiveRequired == null || positiveCurrent == null || positiveCurrent >= positiveRequired

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-white">
          Next Rank: {tierLabel(tierInfo.next_tier)}
        </h2>
        <span className="text-[10.5px] uppercase tracking-wider text-zinc-400">Last 90 Days</span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        <Metric
          index={0}
          label="Sales"
          current={tierInfo.window_gmv}
          required={tierInfo.next_gmv_90d_min ?? 0}
          format={money}
          met={tierInfo.window_gmv >= (tierInfo.next_gmv_90d_min ?? 0)}
        />
        <Metric
          index={1}
          label="Orders"
          current={tierInfo.window_orders}
          required={tierInfo.next_orders_90d_min ?? 0}
          met={tierInfo.window_orders >= (tierInfo.next_orders_90d_min ?? 0)}
        />
        {positiveRequired != null && (
          <Metric
            index={2}
            label="Rating"
            current={positiveCurrent ?? 100}
            required={positiveRequired}
            format={pctFmt}
            met={positiveMet}
          />
        )}
        {tierInfo.next_completion_min != null && (
          <Metric
            index={3}
            label="Completion"
            current={tierInfo.window_completion_pct}
            required={tierInfo.next_completion_min}
            format={pctFmt}
            met={tierInfo.window_completion_pct >= tierInfo.next_completion_min}
          />
        )}
      </div>

      {positiveRequired != null && positiveCurrent == null && (
        <p className="text-[11px] text-zinc-400">No reviews yet. Counts as passed.</p>
      )}
    </div>
  )
}
