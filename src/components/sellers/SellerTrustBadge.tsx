/**
 * Seller Trust Badge Component
 *
 * Displays a seller's tier, rating, and verification status
 * Used on seller profile pages, listing cards, and shop headers
 *
 * Tier hierarchy: quartz → amethyst → ruby → sapphire → diamond
 */

import { Star, CheckCircle2, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { type SellerTier, tierByKey, TIERS } from '@/lib/seller/tiers'

export type { SellerTier }

interface SellerTrustBadgeProps {
  tier: SellerTier
  rating?: number | null
  totalSales?: number
  isVerified?: boolean
  isOnline?: boolean
  username?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Show full card with stats, or just the tier badge pill */
  variant?: 'pill' | 'card' | 'inline'
  /** Link to seller shop page */
  shopUrl?: string
}

/** Component-specific Lucide glyph per gemstone tier. */
/**
 * Per-tier style/label/description/minRating, driven from the central gemstone
 * tier module so there is one source of truth. `color` maps to the central
 * `colors.text` token; the Lucide icon stays component-specific.
 */
const TIER_CONFIG: Record<
  SellerTier,
  {
    label: string
    color: string
    bg: string
    border: string
    glow: string
    icon: LucideIcon
    description: string
    minRating: number
  }
> = Object.fromEntries(
  TIERS.map((t) => [
    t.key,
    {
      label: t.label,
      color: t.colors.text,
      bg: t.colors.bg,
      border: t.colors.border,
      glow: t.colors.glow,
      icon: t.Icon,
      description: t.description,
      minRating: t.thresholds.minRating ?? 0,
    },
  ]),
) as Record<SellerTier, {
  label: string
  color: string
  bg: string
  border: string
  glow: string
  icon: LucideIcon
  description: string
  minRating: number
}>

const SIZE_CONFIG = {
  xs: { pill: 'px-1.5 py-0.5 text-xs gap-1', icon: 'w-3 h-3', dot: 'w-1.5 h-1.5' },
  sm: { pill: 'px-2 py-1 text-xs gap-1.5', icon: 'w-3.5 h-3.5', dot: 'w-2 h-2' },
  md: { pill: 'px-3 py-1.5 text-sm gap-2', icon: 'w-4 h-4', dot: 'w-2.5 h-2.5' },
  lg: { pill: 'px-4 py-2 text-base gap-2', icon: 'w-5 h-5', dot: 'w-3 h-3' },
}

/**
 * Pill variant - compact badge showing tier
 */
function TierPill({
  tier,
  size = 'sm',
  isOnline,
}: {
  tier: SellerTier
  size?: SellerTrustBadgeProps['size']
  isOnline?: boolean
}) {
  const config = TIER_CONFIG[tierByKey(tier).key]
  const TierIcon = config.icon
  const sizes = SIZE_CONFIG[size || 'sm']

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${config.bg} ${config.border} ${config.color} ${sizes.pill}`}
    >
      <TierIcon className={sizes.icon} />
      {config.label}
      {isOnline !== undefined && (
        <span
          className={`rounded-full ${sizes.dot} ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </span>
  )
}

/**
 * Inline variant - tier badge + rating on one line
 */
function InlineBadge({
  tier,
  rating,
  totalSales,
  isVerified,
  isOnline,
  size = 'sm',
}: SellerTrustBadgeProps) {
  const config = TIER_CONFIG[tierByKey(tier).key]
  const TierIcon = config.icon
  const sizes = SIZE_CONFIG[size || 'sm']

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Tier pill */}
      <span
        className={`inline-flex items-center rounded-full border font-medium ${config.bg} ${config.border} ${config.color} ${sizes.pill}`}
      >
        <TierIcon className={sizes.icon} />
        {config.label}
      </span>

      {/* Rating */}
      {rating !== undefined && rating !== null && (
        <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
          <Star className="w-3 h-3 fill-yellow-400" />
          {rating.toFixed(1)}
        </span>
      )}

      {/* Sales count */}
      {totalSales !== undefined && totalSales > 0 && (
        <span className="text-xs text-text-secondary">{totalSales.toLocaleString()} sales</span>
      )}

      {/* Verified badge */}
      {isVerified && (
        <span className="inline-flex items-center gap-0.5 text-blue-400 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Verified
        </span>
      )}

      {/* Online indicator */}
      {isOnline !== undefined && (
        <span className={`inline-flex items-center gap-1 text-xs ${isOnline ? 'text-success' : 'text-text-tertiary'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  )
}

/**
 * Card variant - full trust card with all stats
 */
function TrustCard({ tier, rating, totalSales, isVerified, isOnline, username, shopUrl }: SellerTrustBadgeProps) {
  const config = TIER_CONFIG[tierByKey(tier).key]
  const TierIcon = config.icon

  const cardContent = (
    <div
      className={`relative rounded-xl border p-4 shadow-lg ${config.bg} ${config.border} ${config.glow} transition-all hover:scale-[1.02]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${config.bg} border ${config.border}`}>
            <TierIcon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div>
            <span className={`text-sm font-bold ${config.color}`}>{config.label} Seller</span>
            {username && (
              <p className="text-xs text-text-secondary">@{username}</p>
            )}
          </div>
        </div>

        {/* Online status */}
        {isOnline !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${isOnline ? 'text-success' : 'text-text-tertiary'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        {rating !== undefined && rating !== null && (
          <div className="text-center">
            <div className="flex items-center gap-1 text-warning">
              <Star className="w-4 h-4 fill-yellow-400" />
              <span className="font-bold text-white">{rating.toFixed(1)}</span>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5">Rating</p>
          </div>
        )}

        {totalSales !== undefined && (
          <div className="text-center">
            <p className="font-bold text-white">{totalSales >= 1000 ? `${(totalSales / 1000).toFixed(1)}k` : totalSales}</p>
            <p className="text-xs text-text-tertiary mt-0.5">Sales</p>
          </div>
        )}

        {isVerified && (
          <div className="flex items-center gap-1 text-blue-400 text-xs font-medium ml-auto">
            <CheckCircle2 className="w-4 h-4" />
            Verified
          </div>
        )}
      </div>

      {/* Description */}
      <p className={`text-xs mt-3 ${config.color} opacity-75`}>{config.description}</p>
    </div>
  )

  if (shopUrl) {
    return <Link href={shopUrl}>{cardContent}</Link>
  }

  return cardContent
}

/**
 * Main SellerTrustBadge component
 */
export default function SellerTrustBadge(props: SellerTrustBadgeProps) {
  const { variant = 'pill', size = 'sm', tier, isOnline } = props

  if (variant === 'card') {
    return <TrustCard {...props} />
  }

  if (variant === 'inline') {
    return <InlineBadge {...props} />
  }

  // Default: pill
  return <TierPill tier={tier} size={size} isOnline={isOnline} />
}

/**
 * Standalone star rating display
 */
export function StarRating({
  rating,
  count,
  size = 'sm',
}: {
  rating: number
  count?: number
  size?: 'xs' | 'sm' | 'md'
}) {
  const filled = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.5
  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${iconSize} ${
              star <= filled
                ? 'text-warning fill-yellow-400'
                : star === filled + 1 && hasHalf
                  ? 'text-warning fill-yellow-400/50'
                  : 'text-text-disabled'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-white">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-xs text-text-secondary">({count.toLocaleString()})</span>
      )}
    </div>
  )
}
