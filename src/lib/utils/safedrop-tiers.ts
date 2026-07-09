/**
 * SafeDrop tier config — shared across client and server.
 * NOT a server action file — no 'use server' directive.
 */

export type SafeDropTier = 'standard' | 'enhanced' | 'premium'

/** Fee rates added to the buyer's total for each tier */
export const TIER_FEE_RATES: Record<SafeDropTier, number> = {
  standard: 0,   // Free
  enhanced: 2,   // +2%
  premium:  5,   // +5%
}

/** Warranty duration in days for each tier */
export const TIER_WARRANTY_DAYS: Record<SafeDropTier, number> = {
  standard: 2 / 24, // ~48 hours
  enhanced: 7,
  premium:  30,
}

/** Warranty duration in hours for each tier */
export const TIER_WARRANTY_HOURS: Record<SafeDropTier, number> = {
  standard: 48,
  enhanced: 7 * 24,   // 7 days
  premium:  30 * 24,  // 30 days
}

/** Returns the fee rate for a tier (0, 2, or 5) */
export function getTierFeeRate(tier: SafeDropTier): number {
  return TIER_FEE_RATES[tier] ?? 0
}

/** Ordered list of valid tiers */
export const VALID_TIERS: SafeDropTier[] = ['standard', 'enhanced', 'premium']
