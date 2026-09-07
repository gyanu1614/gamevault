/**
 * Seller tier ladder — the SINGLE source of truth.
 *
 * The seller ladder is a 5-tier gemstone system. Every seller is KYC-verified
 * (they carry a blue "Verified" badge keyed on `profiles.is_verified`), so there
 * is no "unverified" tier — new sellers start at Quartz.
 *
 *   Tier 1  Quartz    white / translucent  — clean beginner
 *   Tier 2  Amethyst  purple               — standard active seller
 *   Tier 3  Ruby      red                  — high-energy milestone
 *   Tier 4  Sapphire  deep blue            — precision master (custom banner)
 *   Tier 5  Diamond   ice blue / white     — the ultimate prestige (custom banner)
 *
 * This module is pure TS (no 'use server', no server-only imports) so it is safe
 * to import from both client and server components, and from the DB-mirroring
 * config in `@/lib/actions/seller-tiers`. Every UI tier→style map and every
 * tier default should consume THIS — do not re-declare the ladder elsewhere.
 *
 * The gemstone keys are exactly the values stored in `profiles.seller_tier` and
 * keyed in `seller_tier_config` (see migration 20260906000000_gemstone_seller_tiers).
 */

import { Hexagon, Gem, Diamond, Octagon, Sparkles, type LucideIcon } from 'lucide-react'

export type SellerTier = 'quartz' | 'amethyst' | 'ruby' | 'sapphire' | 'diamond'

/** New sellers start here; also the fallback for any missing/legacy tier value. */
export const DEFAULT_TIER: SellerTier = 'quartz'

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
  minSales: number
  minRating: number | null
  minAgeDays: number
  minCompletionRate: number | null
}

export interface TierDef {
  key: SellerTier
  /** 1–5, matches the "Tier N" label. */
  tierNumber: number
  /** Capitalised gemstone name, e.g. "Quartz". */
  gemstone: string
  /** Display label shown on badges (same as gemstone). */
  label: string
  description: string
  colors: TierColors
  /** Distinct lucide icon per gemstone (colored via colors.text at render). */
  Icon: LucideIcon
  thresholds: TierThresholds
  /** Platform commission fraction (0.089 = 8.90%). */
  commissionRate: number
  /** Max active listings; null = unlimited. */
  listingLimit: number | null
  /** Whether this tier may upload a custom storefront banner. */
  bannerAccess: boolean
  /** How many of the seller's first listings are manually reviewed before
   *  auto-approval kicks in. Only Quartz (the entry tier) uses this. */
  preModerationListings: number
  /** sort_order in seller_tier_config (equals tierNumber). */
  sortOrder: number
}

/**
 * The ladder, low → high. Thresholds carry over the previous metal-tier numbers,
 * remapped: (unverified+bronze)→quartz, silver→amethyst, gold→ruby,
 * platinum→sapphire, diamond→diamond. Quartz is the entry tier (minSales 0), so
 * every new seller qualifies immediately.
 */
export const TIERS: TierDef[] = [
  {
    key: 'quartz',
    tierNumber: 1,
    gemstone: 'Quartz',
    label: 'Quartz',
    description: 'New seller — getting started',
    colors: {
      text: 'text-zinc-300',
      bg: 'bg-zinc-500/10',
      border: 'border-zinc-500/20',
      ring: 'ring-zinc-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(161,161,170,0.5)]',
      badgeColor: 'zinc',
      icon: '◇',
    },
    Icon: Hexagon,
    thresholds: { minSales: 0, minRating: null, minAgeDays: 0, minCompletionRate: null },
    commissionRate: 0.089,
    listingLimit: 20,
    bannerAccess: false,
    preModerationListings: 3,
    sortOrder: 1,
  },
  {
    key: 'amethyst',
    tierNumber: 2,
    gemstone: 'Amethyst',
    label: 'Amethyst',
    description: 'Established, active seller',
    colors: {
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      ring: 'ring-violet-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(167,139,250,0.55)]',
      badgeColor: 'violet',
      icon: '◆',
    },
    Icon: Gem,
    thresholds: { minSales: 10, minRating: 4.0, minAgeDays: 30, minCompletionRate: 90.0 },
    commissionRate: 0.079,
    listingLimit: 50,
    bannerAccess: false,
    preModerationListings: 0,
    sortOrder: 2,
  },
  {
    key: 'ruby',
    tierNumber: 3,
    gemstone: 'Ruby',
    label: 'Ruby',
    description: 'Trusted, high-energy seller',
    colors: {
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      ring: 'ring-red-500/30',
      glow: 'shadow-[0_0_20px_-8px_rgba(248,113,113,0.55)]',
      badgeColor: 'red',
      icon: '◆',
    },
    Icon: Diamond,
    thresholds: { minSales: 50, minRating: 4.3, minAgeDays: 90, minCompletionRate: 95.0 },
    commissionRate: 0.069,
    listingLimit: 100,
    bannerAccess: false,
    preModerationListings: 0,
    sortOrder: 3,
  },
  {
    key: 'sapphire',
    tierNumber: 4,
    gemstone: 'Sapphire',
    label: 'Sapphire',
    description: 'Top-tier, precision master',
    colors: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      ring: 'ring-blue-500/30',
      glow: 'shadow-[0_0_22px_-8px_rgba(96,165,250,0.6)]',
      badgeColor: 'blue',
      icon: '◆',
    },
    Icon: Octagon,
    thresholds: { minSales: 200, minRating: 4.6, minAgeDays: 180, minCompletionRate: 97.0 },
    commissionRate: 0.059,
    listingLimit: null,
    bannerAccess: true,
    preModerationListings: 0,
    sortOrder: 4,
  },
  {
    key: 'diamond',
    tierNumber: 5,
    gemstone: 'Diamond',
    label: 'Diamond',
    description: 'Elite seller — the ultimate prestige',
    colors: {
      // Ice-blue/white sparkle — reuses the existing "lime" ice treatment the
      // codebase already used for the old diamond tier.
      text: 'text-lime-text',
      bg: 'bg-lime/10',
      border: 'border-lime-tint-border',
      ring: 'ring-lime/30',
      glow: 'shadow-[0_0_26px_-8px_rgba(198,255,61,0.6)]',
      badgeColor: 'lime',
      icon: '◈',
    },
    Icon: Sparkles,
    thresholds: { minSales: 500, minRating: 4.8, minAgeDays: 365, minCompletionRate: 99.0 },
    commissionRate: 0.049,
    listingLimit: null,
    bannerAccess: true,
    preModerationListings: 0,
    sortOrder: 5,
  },
]

/** All gemstone keys, low → high. */
export const TIER_KEYS: SellerTier[] = TIERS.map((t) => t.key)

const TIER_BY_KEY: Record<string, TierDef> = Object.fromEntries(
  TIERS.map((t) => [t.key, t]),
)

/** Runtime guard — is this string a valid gemstone tier? */
export function isValidTier(x: unknown): x is SellerTier {
  return typeof x === 'string' && x in TIER_BY_KEY
}

/** Look up a tier, tolerating legacy/unknown values by falling back to Quartz. */
export function tierByKey(key: string | null | undefined): TierDef {
  return (key && TIER_BY_KEY[key]) || TIER_BY_KEY[DEFAULT_TIER]
}

/** 0-based ladder index (Quartz = 0 … Diamond = 4); DEFAULT_TIER for unknowns. */
export function tierIndex(key: string | null | undefined): number {
  const t = tierByKey(key)
  return TIERS.findIndex((x) => x.key === t.key)
}

/** The next tier up, or null if already Diamond. */
export function nextTier(key: string | null | undefined): TierDef | null {
  const i = tierIndex(key)
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null
}

/** Colors for a tier, with a safe Quartz fallback (never throws on legacy). */
export function tierColors(key: string | null | undefined): TierColors {
  return tierByKey(key).colors
}

/** Display label for a tier ("Quartz"), Quartz fallback for legacy values. */
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
