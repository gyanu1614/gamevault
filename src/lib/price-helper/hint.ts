/**
 * Market price helper for the sell wizard's price step (growth point 30).
 *
 * Advice only: the seller sees an estimated market price and where it comes
 * from, then prices however they like. Never a cap, never a block.
 *
 * Rules (unit-tested, hint.test.ts):
 *   - Never invent a price. Thin data → null → the helper is hidden.
 *   - Items: our values pricing (the same number the public value page shows),
 *     backed by at least HINT_MIN_OFFERS offers and priced in the last
 *     HINT_MAX_AGE_DAYS days. Estimated (derived) prices never show.
 *   - Currency: the median per-unit price of DropMarket's live offers, in the
 *     same unit the seller types (per Robux, per 1K, per 1M), counting only
 *     offers that can fill their own minimum.
 */

export const HINT_MIN_OFFERS = 3
export const HINT_MAX_AGE_DAYS = 14

export interface MarketPrice {
  usd: number
  offers: number
}

export interface ItemMarketPrice extends MarketPrice {
  updatedAt: string
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function itemMarketPrice(
  row: { usd: number | null; offers: number | null; updatedAt: string | null; isEstimate?: boolean },
  now: Date = new Date(),
): ItemMarketPrice | null {
  if (row.isEstimate) return null
  if (row.usd == null || !(row.usd > 0)) return null
  if ((row.offers ?? 0) < HINT_MIN_OFFERS) return null
  if (!row.updatedAt) return null
  const age = now.getTime() - new Date(row.updatedAt).getTime()
  if (!Number.isFinite(age) || age > HINT_MAX_AGE_DAYS * 86_400_000) return null
  return { usd: row.usd, offers: row.offers as number, updatedAt: row.updatedAt }
}

export interface LiveCurrencyOffer {
  /** Price per granularity unit, as stored on the listing. */
  price: number
  stock: number
  minQty: number
  unlimited: boolean
}

export function currencyMarketPrice(offers: readonly LiveCurrencyOffer[]): MarketPrice | null {
  const prices = offers
    .filter((o) => Number.isFinite(o.price) && o.price > 0 && (o.unlimited || o.stock >= Math.max(1, o.minQty)))
    .map((o) => o.price)
  if (prices.length < HINT_MIN_OFFERS) return null
  const mid = median(prices) as number
  return { usd: Math.round(mid * 10_000) / 10_000, offers: prices.length }
}
