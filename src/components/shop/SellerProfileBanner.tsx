'use client'

/**
 * SellerProfileBanner — V10b refinement.
 *
 * Refined seller storefront hero with:
 *   - Layered backdrop: lime radial glow + subtle dotted pattern + dark
 *     base (custom banner image takes precedence)
 *   - Larger avatar with a clean tier ring (NOT a hanging ribbon)
 *   - Tier badge sits inline next to the name like a verified check
 *   - Stats rendered as separate chips with icons (rating, listings, sales)
 *   - Right-aligned Message + Follow CTAs
 *   - Bottom lime hairline for finish
 */

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ThumbsUp, Package, TrendingUp, MessageCircle, UserPlus, Check,
  Shield, Crown, Gem, Sparkles, Award, ShieldCheck, type LucideIcon,
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface BannerConfig {
  type: 'custom' | 'preset'
  url?: string
  gradientFrom?: string
  gradientTo?: string
  gradientDirection?: string
}

interface SellerProfileBannerProps {
  sellerId: string
  username: string
  shopName?: string
  avatarUrl?: string
  isOnline?: boolean
  isVerified?: boolean
  rating: number
  reviewsCount: number
  listingsCount: number
  totalSales: number
  sellerTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  bannerConfig?: BannerConfig
  currentUserId?: string
  onMessageClick?: () => void
  onFollowClick?: () => void
  isFollowing?: boolean
  className?: string
}

const TIER_CONFIG: Record<
  string,
  { label: string; Icon: LucideIcon; pill: string; ring: string }
> = {
  unverified: {
    label: 'Unverified',
    Icon: Shield,
    pill: 'text-zinc-300 bg-zinc-500/15 border-zinc-500/30',
    ring: 'ring-zinc-500/40',
  },
  bronze: {
    label: 'Bronze',
    Icon: Award,
    pill: 'text-orange-300 bg-orange-500/15 border-orange-500/30',
    ring: 'ring-orange-500/40',
  },
  silver: {
    label: 'Silver',
    Icon: ShieldCheck,
    pill: 'text-slate-200 bg-slate-500/15 border-slate-500/30',
    ring: 'ring-slate-400/40',
  },
  gold: {
    label: 'Gold',
    Icon: Crown,
    pill: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30',
    ring: 'ring-yellow-500/40',
  },
  platinum: {
    label: 'Platinum',
    Icon: Gem,
    pill: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
    ring: 'ring-cyan-500/40',
  },
  diamond: {
    label: 'Diamond',
    Icon: Sparkles,
    pill: 'text-lime-text bg-lime-tint-bg border-lime-tint-border',
    ring: 'ring-lime/40',
  },
}

export default function SellerProfileBanner({
  sellerId, username, shopName, avatarUrl, isOnline = false,
  isVerified = false, rating, reviewsCount, listingsCount, totalSales,
  sellerTier = 'bronze', bannerConfig, currentUserId,
  onMessageClick, onFollowClick, isFollowing = false, className,
}: SellerProfileBannerProps) {
  const tier = TIER_CONFIG[sellerTier] ?? TIER_CONFIG.bronze
  const TierIcon = tier.Icon
  const isOwnShop = currentUserId === sellerId
  const positivePercentage = rating > 0 ? Math.round((rating / 5) * 100) : 0

  // Banner background — custom uploads always win
  const customBg: React.CSSProperties | null =
    bannerConfig?.type === 'custom' && bannerConfig.url
      ? {
          backgroundImage: `url(${bannerConfig.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : bannerConfig?.type === 'preset' &&
        bannerConfig.gradientFrom &&
        bannerConfig.gradientTo
      ? {
          background: `linear-gradient(${bannerConfig.gradientDirection || 'to right'}, ${bannerConfig.gradientFrom}, ${bannerConfig.gradientTo})`,
        }
      : null

  return (
    <motion.div
      initial={false}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-border-default shadow-elevated',
        className,
      )}
    >
      {/* Backdrop — layered */}
      {customBg ? (
        <div className="absolute inset-0" style={customBg}>
          <div className="absolute inset-0 bg-gradient-to-b from-bg-base/30 via-bg-base/50 to-bg-base/85" />
        </div>
      ) : (
        <>
          {/* Base */}
          <div className="absolute inset-0 bg-bg-raised" />
          {/* Lime radial glow top-left */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 15% 0%, rgba(198,255,61,0.18), transparent 70%)',
            }}
          />
          {/* Soft dotted pattern */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg-base/60 to-transparent" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:px-8 sm:py-7">
        {/* Avatar */}
        <div className="relative shrink-0 self-center sm:self-auto">
          <div
            className={cn(
              'relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-bg-base ring-2 shadow-elevated sm:h-24 sm:w-24',
              tier.ring,
            )}
          >
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={shopName || username}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-lime-tint-bg text-3xl font-bold text-lime-text">
                {(shopName || username)[0]?.toUpperCase()}
              </div>
            )}
          </div>
          {isOnline && (
            <span
              aria-label="Online"
              className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-bg-base bg-success shadow-elevated sm:h-5 sm:w-5"
            />
          )}
        </div>

        {/* Info column */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          {/* Name + tier + verified */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="truncate text-2xl font-bold text-text-primary drop-shadow-md sm:text-3xl">
              {shopName || username}
            </h1>
            {isVerified && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-label="Verified seller"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-text-inverse shadow-elevated"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Verified by DropMarket</TooltipContent>
              </Tooltip>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm',
                tier.pill,
              )}
            >
              <TierIcon className="h-3 w-3" />
              {tier.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">@{username}</p>

          {/* Stat chips */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            <StatChip
              icon={<ThumbsUp className="h-3.5 w-3.5 fill-success/70 text-success" />}
              value={`${positivePercentage}%`}
              label={`${reviewsCount} ${reviewsCount === 1 ? 'review' : 'reviews'}`}
            />
            <StatChip
              icon={<Package className="h-3.5 w-3.5 text-text-secondary" />}
              value={String(listingsCount)}
              label={listingsCount === 1 ? 'listing' : 'listings'}
            />
            <StatChip
              icon={<TrendingUp className="h-3.5 w-3.5 text-lime-text" />}
              value={String(totalSales)}
              label={totalSales === 1 ? 'sale' : 'sales'}
            />
          </div>
        </div>

        {/* Actions */}
        {!isOwnShop ? (
          <div className="flex shrink-0 items-center gap-2 self-center sm:self-auto">
            <button
              type="button"
              onClick={onMessageClick}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-bold uppercase tracking-wider text-text-inverse shadow-elevated transition-all hover:bg-lime-hover hover:shadow-glow"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Message</span>
            </button>
            <button
              type="button"
              onClick={onFollowClick}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition-colors',
                isFollowing
                  ? 'border-border-default bg-bg-raised text-text-primary hover:bg-bg-raised-hover'
                  : 'border-border-default bg-bg-raised text-text-primary hover:border-lime-tint-border hover:bg-bg-raised-hover',
              )}
            >
              {isFollowing ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Follow</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <Link
            href="/account/dashboard"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-bold uppercase tracking-wider text-text-inverse shadow-elevated transition-all hover:bg-lime-hover hover:shadow-glow"
          >
            <Package className="h-4 w-4" />
            Dashboard
          </Link>
        )}
      </div>

      {/* Bottom lime hairline */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent opacity-50" />
    </motion.div>
  )
}

function StatChip({
  icon, value, label,
}: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-overlay/60 px-2.5 py-1 backdrop-blur-sm">
      {icon}
      <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">{value}</span>
      <span className="text-[11px] text-text-tertiary">{label}</span>
    </span>
  )
}
