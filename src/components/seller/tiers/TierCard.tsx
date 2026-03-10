/**
 * TierCard
 *
 * Full-width card displaying a single tier's perks and requirements.
 * Used in the /account/tiers comparison table.
 *
 * isCurrent  — highlighted with a subtle ring
 * isEligible — shows "You qualify" badge (not yet applied)
 */

import { cn } from '@/lib/utils'
import TierBadge, { type SellerTier } from './TierBadge'
import { Check, X } from 'lucide-react'

export interface TierConfig {
  tier: SellerTier
  display_name: string
  description: string | null
  min_sales: number
  min_rating: number | null
  min_age_days: number
  min_completion_rate: number | null
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
  className?: string
}

const TIER_RING: Record<string, string> = {
  unverified: 'ring-zinc-500/30',
  bronze:     'ring-orange-500/30',
  silver:     'ring-slate-400/30',
  gold:       'ring-yellow-400/30',
  platinum:   'ring-cyan-400/30',
  diamond:    'ring-violet-500/40',
}

const TIER_GLOW: Record<string, string> = {
  unverified: '',
  bronze:     '',
  silver:     '',
  gold:       'shadow-yellow-500/5',
  platinum:   'shadow-cyan-500/5',
  diamond:    'shadow-violet-500/10',
}

function Perk({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs text-zinc-400">
      {met
        ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        : <X className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
      }
      <span className={met ? 'text-zinc-300' : 'text-zinc-600'}>{label}</span>
    </li>
  )
}

export default function TierCard({
  config,
  isCurrent = false,
  isEligible = false,
  className,
}: TierCardProps) {
  const commissionPct = (config.commission_rate * 100).toFixed(1)

  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 rounded-2xl border bg-[#0e0e0e] p-5 transition-all',
        isCurrent
          ? `ring-1 border-white/[0.12] ${TIER_RING[config.tier]} shadow-xl ${TIER_GLOW[config.tier]}`
          : 'border-white/[0.06]',
        className
      )}
    >
      {/* ── Current badge ──────────────────────────────────────────────── */}
      {isCurrent && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest text-white bg-white/[0.08] border border-white/[0.1] rounded-full px-2.5 py-0.5">
          Current tier
        </span>
      )}
      {isEligible && !isCurrent && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
          You qualify
        </span>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <TierBadge tier={config.tier} size="md" />
        <span className="text-lg font-bold text-white tabular-nums">{commissionPct}%</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed -mt-2">
        {config.description ?? config.display_name}
      </p>

      {/* ── Commission callout ─────────────────────────────────────────── */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Platform fee</span>
        <span className="text-sm font-semibold text-white">{commissionPct}%</span>
      </div>

      {/* ── Requirements ───────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Requirements</p>
        <ul className="space-y-1.5">
          <Perk met={config.min_sales === 0} label={`${config.min_sales} completed sales`} />
          {config.min_rating !== null && (
            <Perk met={false} label={`${config.min_rating}★ avg rating`} />
          )}
          {config.min_age_days > 0 && (
            <Perk met={false} label={`${config.min_age_days}d account age`} />
          )}
          {config.min_completion_rate !== null && (
            <Perk met={false} label={`${config.min_completion_rate}% completion rate`} />
          )}
        </ul>
      </div>

      {/* ── Perks ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Perks</p>
        <ul className="space-y-1.5">
          <Perk
            met={config.listing_limit === null}
            label={config.listing_limit === null ? 'Unlimited listings' : `Up to ${config.listing_limit} listings`}
          />
          <Perk met={config.banner_access} label="Custom banner on profile" />
        </ul>
      </div>
    </div>
  )
}
