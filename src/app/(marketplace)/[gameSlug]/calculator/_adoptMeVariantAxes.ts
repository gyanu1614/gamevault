/**
 * Adopt Me variant AXES — the single source of truth for the two-axis picker
 * used on the calculator, the values list, and per-pet pages.
 *
 * A tradable form is a combination of two axes:
 *   TIER  (pick one):   'default' | 'neon' | 'mega'
 *   POTIONS:            fly?: boolean, ride?: boolean
 *
 * The DB only holds 8 canonical codes (N, F, R, FR, NEON, NFR, MEGA, MFR) —
 * there is NO fly-only or ride-only for Neon/Mega. So:
 *   • Default tier exposes the full four-way potion matrix (—, F, R, FR).
 *   • Neon / Mega tiers only have "no potions" and "Fly Ride" — the fly/ride
 *     toggles collapse to a single Fly-Ride on/off. Selecting fly OR ride on
 *     a Neon/Mega form resolves to the Fly-Ride code (NFR / MFR).
 *
 * No server imports — safe to import from client components.
 */

import type { Variant } from './_adoptMeCalcTypes'

export type Tier = 'default' | 'neon' | 'mega'

export interface VariantAxes {
  tier: Tier
  fly: boolean
  ride: boolean
}

export const TIERS: { value: Tier; label: string; short: string }[] = [
  { value: 'default', label: 'Default', short: 'Default' },
  { value: 'neon', label: 'Neon', short: 'Neon' },
  { value: 'mega', label: 'Mega Neon', short: 'Mega' },
]

/** Neon and Mega only exist as plain or Fly-Ride — no fly-only / ride-only. */
export function tierHasSplitPotions(tier: Tier): boolean {
  return tier === 'default'
}

/**
 * Resolve (tier, fly, ride) → one of the 8 canonical codes.
 * For Neon/Mega, ANY potion (fly or ride) collapses to the Fly-Ride code.
 */
export function axesToVariant({ tier, fly, ride }: VariantAxes): Variant {
  if (tier === 'neon') return fly || ride ? 'NFR' : 'NEON'
  if (tier === 'mega') return fly || ride ? 'MFR' : 'MEGA'
  // default tier — full matrix
  if (fly && ride) return 'FR'
  if (fly) return 'F'
  if (ride) return 'R'
  return 'N'
}

/** Inverse: a canonical code → its two axes. */
export function variantToAxes(variant: Variant): VariantAxes {
  switch (variant) {
    case 'N':
      return { tier: 'default', fly: false, ride: false }
    case 'F':
      return { tier: 'default', fly: true, ride: false }
    case 'R':
      return { tier: 'default', fly: false, ride: true }
    case 'FR':
      return { tier: 'default', fly: true, ride: true }
    case 'NEON':
      return { tier: 'neon', fly: false, ride: false }
    case 'NFR':
      return { tier: 'neon', fly: true, ride: true }
    case 'MEGA':
      return { tier: 'mega', fly: false, ride: false }
    case 'MFR':
      return { tier: 'mega', fly: true, ride: true }
  }
}

/**
 * When the tier changes, potion state may become invalid (e.g. switching a
 * fly-only Default form to Neon, which has no fly-only). Normalise the axes to
 * the nearest valid form for the new tier, and return the resolved code too.
 */
export function retierAxes(axes: VariantAxes, nextTier: Tier): VariantAxes {
  const anyPotion = axes.fly || axes.ride
  if (nextTier === 'default') {
    return { tier: 'default', fly: axes.fly, ride: axes.ride }
  }
  // neon / mega: collapse to plain or Fly-Ride
  return { tier: nextTier, fly: anyPotion, ride: anyPotion }
}
