/**
 * Storefront header — pure presentation rules (client-safe).
 *
 * The avatar carries a faint rank-coloured halo: a hairline ring plus a soft
 * blurred glow behind it. Colours are tuned for a near-black card, quieter
 * than the rank chips (owner, 2026-10-05: "minimal"): Bronze muted, Silver a
 * cool white, Gold warm, Diamond a soft cyan, Legendary the rank's own colour
 * from src/lib/seller/tiers.ts so it can never drift from the badge.
 */

import { tierByKey, type SellerTier } from '@/lib/seller/tiers'

export interface AvatarHalo {
  /** "r,g,b" — used in rgba() at the alphas below. */
  rgb: string
  /** Hairline ring alpha. */
  ringAlpha: number
  /** Blurred glow alpha. */
  glowAlpha: number
}

const HALO_RGB: Record<Exclude<SellerTier, 'legendary'>, string> = {
  bronze: '196,140,98', // muted bronze, not the orange chip
  silver: '220,228,240', // cool white
  gold: '236,196,96', // warm gold
  diamond: '125,220,240', // soft cyan
}

/** The rgb triplet inside a tiers.ts `glow` class, e.g. `rgba(198,255,61,0.6)`. */
export function rgbFromGlowClass(glow: string): string | null {
  const m = /rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/.exec(glow)
  return m ? `${m[1]},${m[2]},${m[3]}` : null
}

export function avatarHalo(tier: string | null | undefined): AvatarHalo {
  const def = tierByKey(tier)
  const rgb =
    def.key === 'legendary'
      ? rgbFromGlowClass(def.colors.glow) ?? '198,255,61'
      : HALO_RGB[def.key]
  // Bronze and Silver read brighter on black, so they sit a touch lower.
  const quiet = def.key === 'bronze' || def.key === 'silver'
  return { rgb, ringAlpha: quiet ? 0.28 : 0.34, glowAlpha: quiet ? 0.2 : 0.26 }
}

/**
 * The avatar's rotating rank border (owner, 2026-10-05: "a good blue which
 * rotates … bronze a bronze colour"). Richer than the halo above: this is the
 * colour of a moving highlight on a thin ring, so it can carry full
 * saturation without reading as a glow.
 */
const RING_RGB: Record<Exclude<SellerTier, 'legendary'>, string> = {
  bronze: '205,127,50', // classic bronze
  silver: '200,212,228', // cool silver
  gold: '242,192,64', // gold
  diamond: '64,168,255', // clear blue
}

export function rankRingRgb(tier: string | null | undefined): string {
  const def = tierByKey(tier)
  return def.key === 'legendary' ? rgbFromGlowClass(def.colors.glow) ?? '198,255,61' : RING_RGB[def.key]
}
