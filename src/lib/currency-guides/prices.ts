import type { CurrencyGuide } from './schema'

/**
 * "<Currency> Prices: Official vs DropMarket": the official packs from the
 * fact sheet against what a buyer would pay on DropMarket right now for the
 * SAME amount, from the page's own live offers.
 *
 * Rules (unit-tested, prices.test.ts):
 *   - Never invent a price. No offer that can fill the exact amount → null
 *     ("—" on the page). The seller's minimum and stock both count.
 *   - Flexible pages: cheapest per-unit price × amount, in the category's
 *     granularity (a `thousand` game stores the price per 1K).
 *   - Bundle pages: the cheapest in-stock seller for a bundle of exactly that
 *     amount, Global/US offers only (the official prices are US prices; a
 *     Turkey code next to a US price would be a fake saving).
 *   - Our price is rounded UP to the cent, the saving rounded DOWN to the
 *     percent, and a saving is shown only when it is at least 1%.
 *   - Robux-priced packs have no USD to compare, so they never show a saving.
 */

export type Granularity = 'unit' | 'thousand' | 'million'

export interface FlexibleOfferLite {
  /** Price per granularity unit (per Robux, per 1K, per 1M). */
  pricePerUnit: number
  /** Seller's minimum, in granularity units. */
  minQty: number
  /** Stock, in granularity units. */
  stock: number
}

export interface BundleLite {
  id: string
  amount: number
}

export interface BundleOfferLite {
  bundleId: string
  pricePerBundle: number
  stock: number
  region: string | null
}

export type OurPrices =
  | { kind: 'flexible'; granularity: Granularity; offers: FlexibleOfferLite[] }
  | { kind: 'bundle'; bundles: BundleLite[]; offers: BundleOfferLite[] }
  | { kind: 'none' }

export interface PriceRow {
  amount: number
  /** Pack name, when the publisher names it ("Tiger Shark"). */
  label: string | null
  /** Same money in the mobile/console app (Roblox). */
  appAmount: number | null
  officialUsd: number | null
  officialRobux: number | null
  /** What a DropMarket buyer pays right now for this amount, or null. */
  oursUsd: number | null
  /** Whole percent saved against the official USD price, or null. */
  savePct: number | null
}

export const GRANULARITY_FACTOR: Record<Granularity, number> = {
  unit: 1,
  thousand: 1_000,
  million: 1_000_000,
}

const ACCEPTED_BUNDLE_REGIONS = new Set(['', 'global', 'worldwide', 'us', 'usa', 'united states', 'na', 'north america'])

/** Rounded up to the cent: never shows our price lower than it is. */
function ceilCents(usd: number): number {
  return Math.ceil(usd * 100 - 1e-6) / 100
}

/** Cheapest price on DropMarket for exactly `amount` of the currency, or null. */
export function ourPriceFor(amount: number, ours: OurPrices): number | null {
  if (!(amount > 0)) return null
  if (ours.kind === 'flexible') {
    const qty = amount / GRANULARITY_FACTOR[ours.granularity]
    let best: number | null = null
    for (const o of ours.offers) {
      if (!(o.pricePerUnit > 0)) continue
      if (qty < Math.max(o.minQty, 0) || qty > o.stock) continue
      const raw = o.pricePerUnit * qty
      // A sub-cent order isn't a real price; don't round one up into the table.
      if (raw < 0.01) continue
      const cost = ceilCents(raw)
      if (best == null || cost < best) best = cost
    }
    return best
  }
  if (ours.kind === 'bundle') {
    const ids = new Set(ours.bundles.filter((b) => b.amount === amount).map((b) => b.id))
    if (ids.size === 0) return null
    let best: number | null = null
    for (const o of ours.offers) {
      if (!ids.has(o.bundleId)) continue
      if (!(o.pricePerBundle > 0) || o.stock < 1) continue
      if (!ACCEPTED_BUNDLE_REGIONS.has((o.region ?? '').trim().toLowerCase())) continue
      const cost = ceilCents(o.pricePerBundle)
      if (best == null || cost < best) best = cost
    }
    return best
  }
  return null
}

/** Whole percent saved, only when real and at least 1%. */
export function savingPct(officialUsd: number | null, oursUsd: number | null): number | null {
  if (officialUsd == null || oursUsd == null || !(officialUsd > 0) || !(oursUsd > 0)) return null
  const pct = Math.floor(((officialUsd - oursUsd) / officialUsd) * 100 + 1e-9)
  return pct >= 1 ? pct : null
}

export function buildPriceRows(guide: CurrencyGuide, ours: OurPrices): PriceRow[] {
  const packages = guide.official_prices?.packages ?? []
  return packages.map((p) => {
    const oursUsd = ourPriceFor(p.amount, ours)
    return {
      amount: p.amount,
      label: p.label ?? null,
      appAmount: p.app_amount ?? null,
      officialUsd: p.usd,
      officialRobux: p.robux ?? null,
      oursUsd,
      savePct: savingPct(p.usd, oursUsd),
    }
  })
}

/** The single biggest saving in the table (ties go to the larger pack), or null. */
export function bestSaving(rows: PriceRow[]): PriceRow | null {
  let best: PriceRow | null = null
  for (const r of rows) {
    if (r.savePct == null) continue
    if (!best || r.savePct > best.savePct! || (r.savePct === best.savePct && r.amount > best.amount)) best = r
  }
  return best
}

/**
 * The cheapest live per-unit price, for a currency with no official price list
 * ("$0.49 per 1M"). Only offers with stock at their own minimum count. Null on
 * bundle pages and when nothing is in stock.
 */
export function cheapestUnitPrice(
  ours: OurPrices,
): { usd: number; per: number } | null {
  if (ours.kind !== 'flexible') return null
  let best: number | null = null
  for (const o of ours.offers) {
    if (!(o.pricePerUnit > 0) || o.stock < Math.max(o.minQty, 1)) continue
    if (best == null || o.pricePerUnit < best) best = o.pricePerUnit
  }
  if (best == null) return null
  const factor = GRANULARITY_FACTOR[ours.granularity]
  // Per-single prices of fractions of a cent read badly: quote per 1,000.
  if (factor === 1) return { usd: best * 1000, per: 1000 }
  return { usd: best, per: factor }
}
