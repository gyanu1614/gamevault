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

import { sellerDisplayName } from '@/lib/seller/identity'
import { tierByKey, DEFAULT_TIER, type SellerTier } from '@/lib/seller/tiers'
import SellerTierBadge from '@/components/seller/tiers/SellerTierBadge'
import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ThumbsUp, Package, TrendingUp, MessageCircle, UserPlus, Check,
} from 'lucide-react'
// Mobile-audit — Popover (tap-to-open) replaces the hover-only Tooltip so
// the verified explanation is reachable on touch devices.
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import FoundingSellerBadge from '@/components/seller/FoundingSellerBadge'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { sellerStatLine } from '@/lib/seller/stat-line'

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
  sellerTier: SellerTier | string
  /** Founding seller (first 100) — renders a permanent founding badge. */
  isFoundingSeller?: boolean
  bannerConfig?: BannerConfig
  currentUserId?: string
  onMessageClick?: () => void
  onFollowClick?: () => void
  isFollowing?: boolean
  className?: string
}


export default function SellerProfileBanner({
  sellerId, username, shopName, avatarUrl, isOnline = false,
  isVerified = false, rating, reviewsCount, listingsCount, totalSales,
  sellerTier = DEFAULT_TIER, isFoundingSeller = false, bannerConfig, currentUserId,
  onMessageClick, onFollowClick, isFollowing = false, className,
}: SellerProfileBannerProps) {
  const displayName = sellerDisplayName({ username, shopName })
  const tierDef = tierByKey(sellerTier)
  const isOwnShop = currentUserId === sellerId
  const positivePercentage = rating > 0 ? Math.round((rating / 5) * 100) : 0
  // Shared seller rule (src/lib/seller/stat-line.ts): no sales yet →
  // "Verified Seller", never a "0% · 0 reviews · 0 sales" row.
  const statLine = sellerStatLine({
    ratingPercent: reviewsCount > 0 ? positivePercentage : null,
    reviews: reviewsCount,
    sales: totalSales,
    tier: sellerTier,
  })

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
        // Fill only (card-surface system): no outline, no lime glow.
        'relative w-full overflow-hidden rounded-xl shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      {/* Backdrop — layered */}
      {customBg ? (
        <div className="absolute inset-0" style={customBg}>
          <div className="absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--color-bg-base)_30%,transparent)] via-[color-mix(in_srgb,var(--color-bg-base)_50%,transparent)] to-[color-mix(in_srgb,var(--color-bg-base)_85%,transparent)]" />
        </div>
      ) : (
        <>
          {/* Base */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)]" />
          {/* Soft neutral light, top-left (no colour, no glow) */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 12% 0%, rgba(255,255,255,0.045), transparent 70%)',
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
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[color-mix(in_srgb,var(--color-bg-base)_60%,transparent)] to-transparent" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:px-8 sm:py-7">
        {/* Avatar */}
        <div className="relative shrink-0 self-center sm:self-auto">
          <div
            className={cn(
              'relative h-20 w-20 overflow-hidden rounded-2xl shadow-elevated ring-1 ring-white/10 sm:h-24 sm:w-24',
            )}
          >
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/[0.06] text-3xl font-bold text-text-primary">
                {displayName.charAt(0).toUpperCase()}
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
          {/* Row 1 — name + blue verified badge (+ founding) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="truncate text-2xl font-bold text-text-primary drop-shadow-md sm:text-3xl">
              {displayName}
            </h1>
            {isVerified && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Verified seller"
                    className="-m-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <VerifiedBadge size={24} titled={false} />
                  </button>
                </PopoverTrigger>
                <PopoverContent>Verified by DropMarket</PopoverContent>
              </Popover>
            )}
            {isFoundingSeller && <FoundingSellerBadge size="sm" />}
          </div>

          {/* Row 2 — rank chip: logo + rank name, hover shows "Rank N: Metal" */}
          <div className="mt-1.5 flex items-center justify-center sm:justify-start">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Tier ${tierDef.tierNumber}: ${tierDef.label}`}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] pl-1.5 pr-2.5 text-[13px] font-semibold backdrop-blur-sm transition-colors hover:bg-white/[0.1]',
                    tierDef.colors.text,
                  )}
                >
                  <SellerTierBadge tier={sellerTier} size={18} float={false} />
                  {tierDef.label}
                </button>
              </PopoverTrigger>
              <PopoverContent>
                Tier {tierDef.tierNumber}: {tierDef.label}
              </PopoverContent>
            </Popover>
          </div>

          <p className="mt-1.5 text-sm text-text-secondary">@{username}</p>

          {/* Stat chips */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            {statLine.kind === 'verified' ? (
              <StatChip
                icon={<VerifiedBadge size={14} titled={false} />}
                value="Verified Seller"
                label=""
                plain
              />
            ) : (
              statLine.rating && (
                <StatChip
                  icon={<ThumbsUp className="h-3.5 w-3.5 fill-[color-mix(in_srgb,var(--color-success)_70%,transparent)] text-success" />}
                  value={`${statLine.rating.percent}%`}
                  label={`Positive · ${statLine.rating.reviews} ${statLine.rating.reviews === 1 ? 'Review' : 'Reviews'}`}
                />
              )
            )}
            <StatChip
              icon={<Package className="h-3.5 w-3.5 text-text-secondary" />}
              value={String(listingsCount)}
              label={listingsCount === 1 ? 'Listing' : 'Listings'}
            />
            {statLine.kind === 'stats' && statLine.sales > 0 && (
              <StatChip
                icon={<TrendingUp className="h-3.5 w-3.5 text-text-secondary" />}
                value={String(totalSales)}
                label="Sold"
              />
            )}
          </div>
        </div>

        {/* Actions */}
        {!isOwnShop ? (
          <div className="flex shrink-0 items-center gap-2 self-center sm:self-auto">
            {/* Mobile-audit — labels stay visible below sm (the action row is
                its own centered line in the stacked layout, so both fit at
                360px) and h-11 hits the 44px target on phones. */}
            <button
              type="button"
              onClick={onMessageClick}
              className="inline-flex h-11 items-center gap-1.5 rounded-md bg-white px-4 text-[14px] font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] sm:h-10"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Message</span>
            </button>
            <button
              type="button"
              onClick={onFollowClick}
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-md px-4 text-[14px] font-semibold text-text-primary transition-[background-color,transform] active:scale-[0.98] sm:h-10',
                isFollowing ? 'bg-white/[0.1] hover:bg-white/[0.13]' : 'bg-white/[0.07] hover:bg-white/[0.11]',
              )}
            >
              {isFollowing ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Follow</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <Link
            href="/account/dashboard"
            prefetch={false}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 self-center rounded-md bg-white px-4 text-[14px] font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] sm:h-10 sm:self-auto"
          >
            <Package className="h-4 w-4" />
            Dashboard
          </Link>
        )}
      </div>

    </motion.div>
  )
}

function StatChip({
  icon, value, label, plain = false,
}: { icon: React.ReactNode; value: string; label: string; plain?: boolean }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-2.5 backdrop-blur-sm">
      {icon}
      <span className={cn('text-[13.5px] font-semibold tabular-nums text-text-primary', !plain && 'font-mono')}>{value}</span>
      {label && <span className="text-[12px] text-text-tertiary">{label}</span>}
    </span>
  )
}
