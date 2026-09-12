/**
 * Seller rank ladder — the SINGLE source of truth.
 *
 * The seller ladder is a 5-rank metal system. Every seller is KYC-verified
 * (they carry a blue "Verified" badge keyed on `profiles.is_verified`), so there
 * is no "unverified" rank — new sellers start at Bronze.
 *
 *   Rank 1  Bronze     warm copper/orange   — entry rank
 *   Rank 2  Silver     cool steel           — standard active seller
 *   Rank 3  Gold       yellow               — proven milestone
 *   Rank 4  Diamond    ice blue             — elite (custom banner)
 *   Rank 5  Legendary  lime glow            — the ultimate prestige (custom banner)
 *
 * This module is pure TS (no 'use server', no server-only imports) so it is safe
 * to import from both client and server components, and from the DB-mirroring
 * config in `@/lib/actions/seller-tiers`. Every UI tier→style map and every
 * tier default should consume THIS — do not re-declare the ladder elsewhere.
 *
 * The rank keys are exactly the values stored in `profiles.seller_tier` and
 * keyed in `seller_tier_config` (migrations 20260908100000_metal_rank_tiers +
 * 20260908110000_fee_engine_and_rank_system).
 *
 * Ranks are VOLUME ranks (approved 8 Sep 2026): earned on a trailing-90-day
 * window (counted GMV + completed orders + % positive reviews + completion
 * rate), promoted daily, demoted only after 2 consecutive monthly strikes.
 * Rank grants a fee multiplier on the per-category commission (lib/fees);
 * it no longer gates listings. Thresholds here mirror seller_tier_config —
 * change them together (config migration + this file).
 */

import { Shield, Medal, Trophy, Diamond, Crown, type LucideIcon } from 'lucide-react'

export type SellerTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary'

/** New sellers start here; also the fallback for any missing/legacy tier value. */
export const DEFAULT_TIER: SellerTier = 'bronze'

/** Tailwind classes for a tier's badge/chip. Reuses existing theme tokens. */
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
  /** Counted GMV (USD) over the trailing 90 days (single-buyer capped at 30%). */
  gmv90d: number
  /** Completed orders over the trailing 90 days. */
  orders90d: number
  /** Min % positive reviews (rating ≥ 4) in the window; null = no bar. */
  positivePct: number | null
  /** Min order-completion % in the window; null = no bar. */
  completionPct: number | null
}

export interface TierDef {
  key: SellerTier
  /** 1–5, matches the "Rank N" label. */
  tierNumber: number
  /** Display label shown on badges (same as the rank name). */
  label: string
  description: string
  colors: TierColors
  /** Distinct lucide icon per rank (colored via colors.text at render). */
  Icon: LucideIcon
  thresholds: TierThresholds
  /**
   * Rank fee multiplier applied to the per-category commission (lib/fees):
   * bronze ×1.00 … legendary ×0.80. Top-ups are exempt (always flat).
   */
  feeMultiplier: number
  /** Effective items/currency rate (10% base × multiplier) — display only. */
  commissionRate: number
  /** Max active listings; ranks no longer cap listings — always null. */
  listingLimit: number | null
  /** Whether this tier may upload a custom storefront banner. */
  bannerAccess: boolean
  /** How many of the seller's first listings are manually reviewed before
   *  auto-approval kicks in. Only Bronze (the entry rank) uses this. */
  preModerationListings: number
  /** sort_order in seller_tier_config (equals tierNumber). */
  sortOrder: number
}

/**
 * The ladder, low → high. All thresholds are trailing-90-day window facts;
 * Bronze is the entry rank (all bars 0), so every new seller starts there.
 */
export const TIERS: TierDef[] = [
  {
    key: 'bronze',
    tierNumber: 1,
    label: 'Bronze',
    description: 'Entry rank — every seller starts here',
    colors: {
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      ring: 'ring-orange-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(251,146,60,0.5)]',
      badgeColor: 'orange',
      icon: '◇',
    },
    Icon: Shield,
    thresholds: { gmv90d: 0, orders90d: 0, positivePct: null, completionPct: null },
    feeMultiplier: 1.0,
    commissionRate: 0.1,
    listingLimit: null,
    bannerAccess: false,
    preModerationListings: 3,
    sortOrder: 1,
  },
  {
    key: 'silver',
    tierNumber: 2,
    label: 'Silver',
    description: 'Established, active seller',
    colors: {
      text: 'text-zinc-300',
      bg: 'bg-zinc-400/10',
      border: 'border-zinc-400/20',
      ring: 'ring-zinc-400/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(212,212,216,0.5)]',
      badgeColor: 'zinc',
      icon: '◆',
    },
    Icon: Medal,
    thresholds: { gmv90d: 450, orders90d: 5, positivePct: 90, completionPct: 90 },
    feeMultiplier: 0.95,
    commissionRate: 0.095,
    listingLimit: null,
    bannerAccess: false,
    preModerationListings: 0,
    sortOrder: 2,
  },
  {
    key: 'gold',
    tierNumber: 3,
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
    Icon: Trophy,
    thresholds: { gmv90d: 2000, orders90d: 20, positivePct: 93, completionPct: 95 },
    feeMultiplier: 0.9,
    commissionRate: 0.09,
    listingLimit: null,
    bannerAccess: false,
    preModerationListings: 0,
    sortOrder: 3,
  },
  {
    key: 'diamond',
    tierNumber: 4,
    label: 'Diamond',
    description: 'Elite seller — near the top',
    colors: {
      text: 'text-cyan-300',
      bg: 'bg-cyan-400/10',
      border: 'border-cyan-400/20',
      ring: 'ring-cyan-400/30',
      glow: 'shadow-[0_0_22px_-8px_rgba(103,232,249,0.6)]',
      badgeColor: 'cyan',
      icon: '◆',
    },
    Icon: Diamond,
    thresholds: { gmv90d: 7500, orders90d: 50, positivePct: 96, completionPct: 97 },
    feeMultiplier: 0.85,
    commissionRate: 0.085,
    listingLimit: null,
    bannerAccess: true,
    preModerationListings: 0,
    sortOrder: 4,
  },
  {
    key: 'legendary',
    tierNumber: 5,
    label: 'Legendary',
    description: 'The ultimate rank — best of the best',
    colors: {
      // Lime glow — the site's prestige accent, kept from the old top tier.
      text: 'text-lime-text',
      bg: 'bg-lime/10',
      border: 'border-lime-tint-border',
      ring: 'ring-lime/30',
      glow: 'shadow-[0_0_26px_-8px_rgba(198,255,61,0.6)]',
      badgeColor: 'lime',
      icon: '◈',
    },
    Icon: Crown,
    thresholds: { gmv90d: 20000, orders90d: 100, positivePct: 98, completionPct: 98 },
    feeMultiplier: 0.8,
    commissionRate: 0.08,
    listingLimit: null,
    bannerAccess: true,
    preModerationListings: 0,
    sortOrder: 5,
  },
]

/** All rank keys, low → high. */
export const TIER_KEYS: SellerTier[] = TIERS.map((t) => t.key)

const TIER_BY_KEY: Record<string, TierDef> = Object.fromEntries(
  TIERS.map((t) => [t.key, t]),
)

/** Runtime guard — is this string a valid rank tier? */
export function isValidTier(x: unknown): x is SellerTier {
  return typeof x === 'string' && x in TIER_BY_KEY
}

/** Look up a tier, tolerating legacy/unknown values by falling back to Bronze. */
export function tierByKey(key: string | null | undefined): TierDef {
  return (key && TIER_BY_KEY[key]) || TIER_BY_KEY[DEFAULT_TIER]
}

/** 0-based ladder index (Bronze = 0 … Legendary = 4); DEFAULT_TIER for unknowns. */
export function tierIndex(key: string | null | undefined): number {
  const t = tierByKey(key)
  return TIERS.findIndex((x) => x.key === t.key)
}

/** The next tier up, or null if already Legendary. */
export function nextTier(key: string | null | undefined): TierDef | null {
  const i = tierIndex(key)
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null
}

/** Colors for a tier, with a safe Bronze fallback (never throws on legacy). */
export function tierColors(key: string | null | undefined): TierColors {
  return tierByKey(key).colors
}

/** Display label for a tier ("Bronze"), Bronze fallback for legacy values. */
export function tierLabel(key: string | null | undefined): string {
  return tierByKey(key).label
}

/**
 * Whether to show the blue "Verified" badge for a seller. Every seller is
 * KYC-verified, so this keys purely on the `is_verified` flag — NOT on tier.
 * Accepts the loose profile shapes used across the app.
 */
export function isSellerVerified(
  seller: { is_verified?: boolean | null; isVerified?: boolean | null } | null | undefined,
): boolean {
  return !!(seller?.is_verified ?? seller?.isVerified)
}
