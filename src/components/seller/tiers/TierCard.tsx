'use client'

/**
 * TierCard — one rank column in the /account/tiers 5-up ladder.
 *
 * Rectangular checkout-modal surface, receipt-style internals:
 *   • fixed section skeleton (header / fee / requirements / perk) so all five
 *     cards align on the same horizontal lines regardless of content
 *   • dotted leader lines between requirement labels and values
 *   • per-rank accent strip + radial tint (ladder tokens from tiers.ts)
 *   • current rank carries the lime ring + glow; spring stagger + hover lift
 */

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { SellerTier } from './TierBadge'
import RankIcon from './RankIcon'
import { Check, Minus } from 'lucide-react'

export interface TierConfig {
  tier: SellerTier
  display_name: string
  description: string | null
  /** Trailing-90-day requirements (rank engine window). */
  gmv_90d_min: number
  orders_90d_min: number
  positive_rating_min: number | null
  min_completion_rate: number | null
  /** Rank fee multiplier (1.00 … 0.80); top-ups exempt. */
  fee_multiplier: number
  /** Effective items/currency rate (display). */
  commission_rate: number
  listing_limit: number | null
  banner_access: boolean
  badge_color: string
  sort_order: number
}

interface TierCardProps {
  config: TierConfig
  isCurrent?: boolean
  isEligible?: boolean
  /** 0-based position for the entrance stagger. */
  index?: number
  className?: string
}

/** Solid accent per rank for strips/tints (ladder tokens are tint classes). */
const ACCENT_HEX: Record<string, string> = {
  bronze: '#fb923c',
  silver: '#d4d4d8',
  gold: '#facc15',
  diamond: '#67e8f9',
  legendary: '#c6ff3d',
}

/** Requirement row with a dotted leader between label and value. */
function Req({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-[12px] text-zinc-400">{label}</span>
      <span
        aria-hidden="true"
        className="mb-[3px] flex-1 self-end border-b border-dotted border-white/[0.16]"
      />
      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white">{value}</span>
    </div>
  )
}

export default function TierCard({
  config,
  isCurrent = false,
  isEligible = false,
  index = 0,
  className,
}: TierCardProps) {
  const reduce = useReducedMotion()
  const accent = ACCENT_HEX[config.tier] ?? '#d4d4d8'
  const feeDiscountPct = Math.round((1 - config.fee_multiplier) * 100)
  const commissionPct = (config.commission_rate * 100).toFixed(1).replace(/\.0$/, '')
  const isEntry = config.sort_order === 1

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border',
        'bg-gradient-to-b from-[#121212] to-[#0c0c0c]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        isCurrent
          ? 'border-lime/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_34px_-10px_rgba(198,255,61,0.4)]'
          : 'border-border-subtle transition-colors duration-300 hover:border-white/[0.16]',
        className,
      )}
    >
      {/* ── Rank accent strip ── */}
      <div
        aria-hidden="true"
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent} 45%, ${accent} 55%, transparent 100%)`,
          opacity: isCurrent ? 1 : 0.55,
        }}
      />

      {/* ── Soft rank tint behind the header ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.2] transition-opacity duration-300 group-hover:opacity-[0.32]"
        style={{
          background: `radial-gradient(120% 100% at 50% 0%, ${accent} 0%, transparent 70%)`,
        }}
      />

      {/* ── Header: icon + name + state tag (fixed height) ── */}
      <div className="relative flex h-14 items-center gap-3 px-5">
        <RankIcon tier={config.tier} size={30} />
        <span className="text-[15px] font-bold tracking-tight text-white">
          {config.display_name}
        </span>
        {isCurrent && (
          <span className="ml-auto rounded-md bg-lime px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-black">
            Current
          </span>
        )}
        {isEligible && !isCurrent && (
          <span className="ml-auto rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-400">
            You Qualify
          </span>
        )}
      </div>

      {/* ── Fee block (fixed height, baseline-aligned across the row) ── */}
      <div className="relative flex h-14 items-center justify-between px-5">
        <div>
          <span className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-white">
            {commissionPct}
            <span className="ml-px text-[17px] font-semibold text-zinc-400">%</span>
          </span>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Seller Fee
          </p>
        </div>
        <span
          className={cn(
            'rounded-md border px-2.5 py-1.5 text-[12px] font-bold leading-none',
            feeDiscountPct > 0
              ? 'border-lime/25 bg-lime/10 text-lime-text'
              : 'border-white/[0.08] bg-white/[0.04] text-zinc-400',
          )}
        >
          {feeDiscountPct > 0 ? `${feeDiscountPct}% Off` : 'Standard'}
        </span>
      </div>

      {/* ── Unlock bars (fixed min-height keeps footers level) ── */}
      <div className="mx-5 mt-3 min-h-[124px] border-t border-white/[0.06] pt-3.5">
        <p className="mb-2.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          To Unlock
        </p>
        {isEntry ? (
          <p className="text-[12.5px] leading-relaxed text-zinc-300">
            Nothing.
            <br />
            Everyone starts here.
          </p>
        ) : (
          <div className="space-y-2.5">
            <Req value={`$${config.gmv_90d_min.toLocaleString()}+`} label="Sales" />
            <Req value={`${config.orders_90d_min}+`} label="Orders" />
            {config.positive_rating_min !== null && (
              <Req value={`${config.positive_rating_min}%+`} label="Rating" />
            )}
            {config.min_completion_rate !== null && (
              <Req value={`${config.min_completion_rate}%+`} label="Completion" />
            )}
          </div>
        )}
      </div>

      {/* ── Perk footer (pinned, shared divider line) ── */}
      <div className="mx-5 mt-auto flex h-11 items-center gap-2 border-t border-white/[0.06]">
        {config.banner_access ? (
          <Check className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
        ) : (
          <Minus className="h-3 w-3 shrink-0 text-zinc-700" aria-hidden="true" />
        )}
        <span
          className={cn('text-[11.5px]', config.banner_access ? 'text-zinc-200' : 'text-zinc-500')}
        >
          Custom Banner
        </span>
      </div>
    </motion.div>
  )
}
