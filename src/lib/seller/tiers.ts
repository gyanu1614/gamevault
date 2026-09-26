/**
 * Seller rank ladder — the SINGLE source of truth (TS mirror of the DB).
 *
 * The seller ladder is a 5-rank metal ladder. Every seller is KYC-verified
 * (they carry a blue "Verified" badge keyed on `profiles.is_verified`), so there
 * is no "unverified" rank — new sellers start at Bronze.
 *
 *   Rank 1  Bronze     orange   — entry rank, 3 listings pre-moderated
 *   Rank 2  Silver     zinc     — standard active seller
 *   Rank 3  Gold       yellow   — trusted, proven seller
 *   Rank 4  Diamond    cyan     — elite (custom banner)
 *   Rank 5  Legendary  lime     — the ultimate rank (custom banner)
 *
 * This module is pure TS (no 'use server', no server-only imports) so it is safe
 * to import from both client and server components, and from the DB-mirroring
 * config in `@/lib/actions/seller-tiers`. Every UI tier→style map and every
 * tier default should consume THIS — do not re-declare the ladder elsewhere.
 *
 * The rank keys are exactly the values stored in `profiles.seller_tier` and
 * keyed in `seller_tier_config`, and are enforced by the CHECK constraint
 * `profiles_seller_tier_check` (see migration 20260908100000_metal_rank_tiers,
 * which replaced the earlier gemstone ladder position-for-position:
 * quartz→bronze, amethyst→silver, ruby→gold, sapphire→diamond,
 * diamond→legendary).
 *
 * ⚠️ Thresholds and commission rates below MIRROR seller_tier_config. They are
 * only a fallback for when that table is unreadable — the DB is authoritative.
 * Never write a rank key from this module's literals into the database without
 * going through the entry-rank lookup in `@/lib/seller/entry-tier`.
 */

import { Hexagon, Gem, Diamond, Octagon, Sparkles, type LucideIcon } from 'lucide-react'

export type SellerTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary'

/**
 * Fallback rank for rendering a missing/legacy value, and the last-resort
 * default when `seller_tier_config` cannot be read.
 *
 * ⚠️ DISPLAY/FALLBACK ONLY. Do NOT use this as the value written to
 * `profiles.seller_tier` on approval or signup — read the live entry rank via
 * `getEntryTier()` in `@/lib/seller/entry-tier` instead, so the ladder can be
 * re-keyed in the DB again without another production outage.
 */
export const DEFAULT_TIER: SellerTier = 'bronze'

/** Tailwind classes for a rank's badge/chip. Reuses existing theme tokens. */
export interface TierColors {
  text: string
  bg: string
  border: string
  ring: string
  glow: string
  /** `badge_color` token stored in seller_tier_config (for admin chip maps). */
  badgeColor: string
  /** A single glyph used by the compact pill. */
  icon: string
}

export interface TierThresholds {
  minSales: number
  minRating: number | null
  minAgeDays: number
  minCompletionRate: number | null
}

export interface TierDef {
  key: SellerTier
  /** 1–5, matches the "Rank N" label. */
  tierNumber: number
  /** Capitalised metal name, e.g. "Bronze". */
  metal: string
  /** Display label shown on badges (same as metal). */
  label: string
  description: string
  colors: TierColors
  /** Distinct lucide icon per rank (colored via colors.text at render). */
  Icon: LucideIcon
  thresholds: TierThresholds
  /** Max active listings; null = unlimited. */
  listingLimit: number | null
  /** Whether this rank may upload a custom storefront banner. */
  bannerAccess: boolean
  /** How many of the seller's first listings are manually reviewed before
   *  auto-approval kicks in. Only Bronze (the entry rank) uses this. */
  preModerationListings: number
  /** sort_order in seller_tier_config (equals tierNumber). */
  sortOrder: number
  /** Listings/hour rate limit for this rank. */
  maxListingsPerHour: number
}

/**
 * The ladder, low → high. Values mirror the `seller_tier_config` rows written
 * by migration 20260908100000_metal_rank_tiers. Bronze is the entry rank
 * (minSales 0), so every new seller qualifies immediately.
 */
export const TIERS: TierDef[] = [
  {
    key: 'bronze',
    tierNumber: 1,
    metal: 'Bronze',
    label: 'Bronze',
    description: 'Entry rank — every seller starts here',
    colors: {
      text: 'text-orange-300',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      ring: 'ring-orange-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(253,186,116,0.5)]',
      badgeColor: 'orange',
      icon: '◇',
    },
    Icon: Hexagon,
    thresholds: { minSales: 0, minRating: null, minAgeDays: 0, minCompletionRate: null },
    listingLimit: 20,
    bannerAccess: false,
    preModerationListings: 3,
    sortOrder: 1,
    maxListingsPerHour: 5,
  },
  {
    key: 'silver',
    tierNumber: 2,
    metal: 'Silver',
    label: 'Silver',
    description: 'Established, active seller',
    colors: {
      text: 'text-zinc-300',
      bg: 'bg-zinc-500/10',
      border: 'border-zinc-500/20',
      ring: 'ring-zinc-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(161,161,170,0.5)]',
      badgeColor: 'zinc',
      icon: '◆',
    },
    Icon: Gem,
    thresholds: { minSales: 10, minRating: 4.0, minAgeDays: 30, minCompletionRate: 90.0 },
    listingLimit: 50,
    bannerAccess: false,
    preModerationListings: 0,
    sortOrder: 2,
    maxListingsPerHour: 10,
  },
  {
    key: 'gold',
    tierNumber: 3,
    metal: 'Gold',
    label: 'Gold',
    description: 'Trusted, proven seller',
    colors: {
      text: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      ring: 'ring-yellow-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(250,204,21,0.55)]',
      badgeColor: 'yellow',
      icon: '◆',
    },
    Icon: Diamond,
    thresholds: { minSales: 50, minRating: 4.3, minAgeDays: 90, minCompletionRate: 95.0 },
    listingLimit: 100,
    bannerAccess: false,
    preModerationListings: 0,
    sortOrder: 3,
    maxListingsPerHour: 20,
  },
  {
    key: 'diamond',
    tierNumber: 4,
    metal: 'Diamond',
    label: 'Diamond',
    description: 'Elite seller — near the top',
    colors: {
      text: 'text-cyan-300',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      ring: 'ring-cyan-500/30',
      glow: 'shadow-[0_0_22px_-8px_rgba(103,232,249,0.6)]',
      badgeColor: 'cyan',
      icon: '◆',
    },
    Icon: Octagon,
    thresholds: { minSales: 200, minRating: 4.6, minAgeDays: 180, minCompletionRate: 97.0 },
    listingLimit: null,
    bannerAccess: true,
    preModerationListings: 0,
    sortOrder: 4,
    maxListingsPerHour: 50,
  },
  {
    key: 'legendary',
    tierNumber: 5,
    metal: 'Legendary',
    label: 'Legendary',
    description: 'The ultimate rank — best of the best',
    colors: {
      text: 'text-lime-text',
      bg: 'bg-lime/10',
      border: 'border-lime-tint-border',
      ring: 'ring-lime/30',
      glow: 'shadow-[0_0_26px_-8px_rgba(86,184,127,0.6)]',
      badgeColor: 'lime',
      icon: '◈',
    },
    Icon: Sparkles,
    thresholds: { minSales: 500, minRating: 4.8, minAgeDays: 365, minCompletionRate: 99.0 },
    listingLimit: null,
    bannerAccess: true,
    preModerationListings: 0,
    sortOrder: 5,
    maxListingsPerHour: 100,
  },
]

/** All rank keys, low → high. */
export const TIER_KEYS: SellerTier[] = TIERS.map((t) => t.key)

const TIER_BY_KEY: Record<string, TierDef> = Object.fromEntries(
  TIERS.map((t) => [t.key, t]),
)

/** Runtime guard — is this string a valid rank? */
export function isValidTier(x: unknown): x is SellerTier {
  return typeof x === 'string' && x in TIER_BY_KEY
}

/** Look up a rank, tolerating legacy/unknown values by falling back to Bronze. */
export function tierByKey(key: string | null | undefined): TierDef {
  return (key && TIER_BY_KEY[key]) || TIER_BY_KEY[DEFAULT_TIER]
}

/** 0-based ladder index (Bronze = 0 … Legendary = 4); DEFAULT_TIER for unknowns. */
export function tierIndex(key: string | null | undefined): number {
  const t = tierByKey(key)
  return TIERS.findIndex((x) => x.key === t.key)
}

/** The next rank up, or null if already Legendary. */
export function nextTier(key: string | null | undefined): TierDef | null {
  const i = tierIndex(key)
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null
}

/** Colors for a rank, with a safe Bronze fallback (never throws on legacy). */
export function tierColors(key: string | null | undefined): TierColors {
  return tierByKey(key).colors
}

/** Display label for a rank ("Bronze"), Bronze fallback for legacy values. */
export function tierLabel(key: string | null | undefined): string {
  return tierByKey(key).label
}
