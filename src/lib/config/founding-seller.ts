/**
 * Founding-seller programme config — the single source for the public-facing
 * bits of the Phase 0 onboarding sequence (Discord invite, perk copy). Safe to
 * import from both client and server components: no server-only dependencies.
 *
 * The MONEY side of the perk (the commission discount) lives in src/lib/fees
 * (FOUNDING_DISCOUNT_PTS) and is the source of truth for payouts. The value
 * mirrored here is FOR DISPLAY ONLY — keep the two in sync when retuning.
 */

/**
 * Invite to the founding-seller Discord community. Shown on the /early-seller
 * success state and in the welcome email — the onboarding "next step".
 */
export const DISCORD_INVITE_URL = 'https://discord.gg/z5ghW37JRu'

/**
 * Percentage-points-off wording for the founding commission perk. Mirrors
 * FOUNDING_DISCOUNT_PTS in src/lib/fees (which governs actual payouts) — this
 * copy is display-only; update both together.
 */
export const FOUNDING_DISCOUNT_PTS_DISPLAY = 2

/** One-line perk summaries reused across the form success state and the email. */
export const FOUNDING_PERKS: readonly string[] = [
  `A permanently reduced commission — ${FOUNDING_DISCOUNT_PTS_DISPLAY} points off every category rate, locked to your account for life.`,
  'Early listing access before the marketplace opens to the public.',
  'A founding-seller badge on your storefront that buyers can see.',
] as const

// ── Founding-progress widget (the /early-seller momentum/scarcity bar) ────────
// Consts + type live here (a plain module) because the data is fetched by an
// async server action in src/lib/actions/early-seller.ts — and a 'use server'
// file may only export async functions, so its non-function exports can't go
// there. The client form imports the type from here too.

/** Total founding spots in the "first 100" programme. */
export const FOUNDING_SPOT_CAP = 100

/**
 * Once this many sellers have actually been GRANTED founding status, the
 * progress widget flips from "waitlist momentum" to the stronger "N of 100
 * spots claimed". Below it, a near-zero claimed count would read as dead — so
 * we show the real waitlist count instead. Never fabricated.
 */
export const FOUNDING_CLAIMED_REVEAL_THRESHOLD = 20

export interface FoundingProgress {
  /** 'waitlist' (early days) or 'claimed' (>= reveal threshold granted). */
  mode: 'waitlist' | 'claimed'
  /** The real number to display for the chosen mode. */
  count: number
  /** Denominator for the bar. Always the spot cap. */
  cap: number
  /** 0–100, clamped, for the progress bar width. */
  percent: number
}
