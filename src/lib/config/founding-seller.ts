/**
 * Founding-seller programme config — the single source for the public-facing
 * bits of the Phase 0 onboarding sequence (Discord invite, perk copy). Safe to
 * import from both client and server components: no server-only dependencies.
 *
 * The MONEY side of the perk is DATA: platform_fee_settings
 * (founding_discount_pct / founding_months), applied by resolve_seller_fee
 * (fee engine PR 1). The wording here is display-only and deliberately
 * carries no number that could drift from that row — the live terms are on
 * /sell/fees, which reads the table.
 */

/**
 * Invite to the founding-seller Discord community. Shown on the /early-seller
 * success state and in the welcome email — the onboarding "next step".
 */
export const DISCORD_INVITE_URL = 'https://discord.gg/z5ghW37JRu'

/**
 * The founding fee perk, in words. Chip form (perk lists) and sentence form
 * (hero copy, email). Non-numeric on purpose (fee-copy.guard): the programme's
 * actual discount and duration are platform settings read by the resolver and
 * published on /sell/fees.
 */
export const FOUNDING_FEE_PERK_LABEL = 'Half-price commission for your first year'
export const FOUNDING_FEE_PERK_SENTENCE = 'half-price commission for your first year'

/** One-line perk summaries reused across the form success state and the email. */
export const FOUNDING_PERKS: readonly string[] = [
  `${FOUNDING_FEE_PERK_LABEL} — the founding rate on every category, applied automatically to each sale.`,
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
