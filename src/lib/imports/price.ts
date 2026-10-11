/**
 * Step 4 bulk importer — what an imported listing costs.
 *
 * Two modes, and one rule that governs both: a price is either observed or
 * given. The importer never derives a number from a guess.
 *
 *   auto      market price × (1 − undercut%). No market price ⇒ the row is
 *             REJECTED and lands in the review file. A derived/estimated value
 *             is refused too, unless the batch explicitly opted in.
 *   explicit  the number from the input, used as given, with a sanity band
 *             against the market that WARNS rather than blocks — the owner may
 *             well know something the market data does not.
 *
 * Pure: a preview and an apply resolve identically, which is what makes the
 * preview trustworthy.
 */
import { PRICE_MIN } from '@/lib/listings/validate'
import type { MarketPrice } from './types'

/** An explicit price above market × this warns. */
export const HIGH_BAND = 2
/** An explicit price below market × this warns. */
export const LOW_BAND = 0.3

export interface PriceInputs {
  mode: 'auto' | 'explicit'
  /** The number from the input row. Required in explicit mode. */
  input: number | null
  /** The game's market price for this (item, variant), if it has one. */
  market: MarketPrice | undefined
  /** 0–90, from the batch. */
  undercutPct: number
  /** The batch opted in to pricing from derived/estimated values. */
  allowEstimated: boolean
}

export type PriceResolution =
  | { ok: true; price: number; market: number | null; warning?: string }
  | { ok: false; reason: string }

/** Whole cents: the unit a buyer is actually charged in. */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

export function resolveImportPrice(inputs: PriceInputs): PriceResolution {
  const { mode, input, market, undercutPct, allowEstimated } = inputs

  if (mode === 'auto') {
    if (!market || !Number.isFinite(market.usd) || market.usd <= 0) {
      return { ok: false, reason: 'no market price for this item yet — price it in the sheet or leave it out' }
    }
    if (market.estimated && !allowEstimated) {
      return {
        ok: false,
        reason: 'the only value for this item is an estimate, not an observed price — turn on "use estimated values" to price from it',
      }
    }
    const pct = Math.min(Math.max(undercutPct, 0), 90)
    const price = Math.max(PRICE_MIN, toCents(market.usd * (1 - pct / 100)))
    return {
      ok: true,
      price,
      market: market.usd,
      ...(market.estimated ? { warning: 'priced from an estimated value, not observed listings' } : {}),
    }
  }

  if (input == null || !Number.isFinite(input) || input <= 0) {
    return { ok: false, reason: 'price must be a number above 0' }
  }
  const price = toCents(input)
  if (price < PRICE_MIN) return { ok: false, reason: `price must be at least $${PRICE_MIN.toFixed(2)}` }

  // The band is advisory. A fat-fingered 10× is the case it catches.
  let warning: string | undefined
  if (market && market.usd > 0) {
    if (price > market.usd * HIGH_BAND) {
      warning = `${HIGH_BAND}× above the market price of $${market.usd.toFixed(2)}`
    } else if (price < market.usd * LOW_BAND) {
      warning = `well below the market price of $${market.usd.toFixed(2)}`
    }
  }
  return { ok: true, price, market: market?.usd ?? null, ...(warning ? { warning } : {}) }
}
