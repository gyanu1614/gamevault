/**
 * TierBadge — inline pill showing a seller's tier with the correct colour.
 *
 * badge_color values from seller_tier_config:
 *   zinc | orange | slate | yellow | cyan | violet
 */

import { cn } from '@/lib/utils'

export type SellerTier = 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

interface TierBadgeProps {
  tier: SellerTier | string
  size?: 'xs' | 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

const TIER_STYLES: Record<string, { label: string; text: string; bg: string; border: string; icon: string }> = {
  unverified: {
    label: 'New Seller',
    text: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
    icon: '○',
  },
  bronze: {
    label: 'Bronze',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    icon: '◆',
  },
  silver: {
    label: 'Silver',
    text: 'text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    icon: '◆',
  },
  gold: {
    label: 'Gold',
    text: 'text-warning',
    bg: 'bg-warning-bg',
    border: 'border-yellow-500/20',
    icon: '◆',
  },
  platinum: {
    label: 'Platinum',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    icon: '◆',
  },
  diamond: {
    label: 'Diamond',
    text: 'text-lime-text',
    bg: 'bg-lime/10',
    border: 'border-lime-tint-border',
    icon: '◈',
  },
}

const SIZE_CLASSES = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
}

export default function TierBadge({
  tier,
  size = 'sm',
  showIcon = true,
  className,
}: TierBadgeProps) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.unverified

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        style.text,
        style.bg,
        style.border,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <span aria-hidden="true">{style.icon}</span>}
      {style.label}
    </span>
  )
}
