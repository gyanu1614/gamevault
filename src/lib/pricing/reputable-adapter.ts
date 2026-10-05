/**
 * Game-agnostic reputable-pricing adapter.
 *
 * The reputable engine (`reputablePrice`) is pure math over a flat list of
 * {price, reviews} and knows nothing about any game. This adapter is the thin
 * layer that turns a pile of raw marketplace listings — from ANY game — into
 * per-item-per-variant reputable prices, so SAB, Adopt Me, and every future
 * game run the SAME cheapest/average logic instead of each reimplementing it.
 *
 * What's game-specific (and therefore NOT here): how listings are collected,
 * what a "variant" means (SAB mutation vs Adopt Me potion ladder), and where
 * the result is written. The caller supplies listings already keyed by
 * item+variant; this module groups, cleans, and prices them.
 *
 * Pure and deterministic (no clock, no I/O) so it is fully unit-testable.
 */

import {
  REPUTABLE_MIN_REVIEWS,
  reputablePrice,
  type ReputableListing,
  type ReputablePrice,
} from '@/lib/sab/reputable-pricing'

export type { ReputableListing, ReputablePrice }

/**
 * One raw listing to be priced. `itemId` + `variant` form the grouping key —
 * whatever those mean for the game (SAB: brainrotId + mutationId; Adopt Me:
 * petId + variant like 'FR'). `reviews` is the seller's total review/order
 * count (Eldorado ratingCount); a listing without it is dropped, because the
 * reputable gate has nothing to test.
 */
export type RawListing = {
  itemId: string
  variant: string
  priceUsd: number | null | undefined
  reviews: number | null | undefined
}

/** The priced result for one item+variant group. */
export type VariantReputablePrice = ReputablePrice & {
  itemId: string
  variant: string
}

/** Stable grouping key. Callers can rebuild it to look up their own results. */
export function variantKey(itemId: string, variant: string): string {
  return `${itemId}:${variant}`
}

function toFinitePositive(value: number | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Group raw listings by item+variant, keeping only rows that carry both a valid
 * price and a seller review count (the reputable engine's two required inputs).
 * Cleanliness filtering (bundles, fakes, inactive) is the CALLER's job — it is
 * game-specific — so only obviously unusable rows are dropped here.
 */
export function groupReputableListings(
  listings: RawListing[],
): Map<string, ReputableListing[]> {
  const byVariant = new Map<string, ReputableListing[]>()

  for (const row of listings) {
    const priceUsd = toFinitePositive(row.priceUsd)
    if (priceUsd == null) continue
    // No review count → the reputable gate can't judge this seller. Omit it
    // rather than treat an unknown seller as reputable.
    if (row.reviews == null || !Number.isFinite(Number(row.reviews))) continue
    const reviews = Number(row.reviews)

    const key = variantKey(row.itemId, row.variant)
    const entry: ReputableListing = { priceUsd, reviews }
    const list = byVariant.get(key)
    if (list) list.push(entry)
    else byVariant.set(key, [entry])
  }

  return byVariant
}

/**
 * Price a grouped map (from `groupReputableListings`, or built by the caller).
 * Returns one result per group that HAS a reputable price — groups the engine
 * rejects (too few reputable listings, all fakes) are simply absent, so the
 * caller can fall through to its own estimate/suppression for those.
 */
export function priceGroupedListings(
  byVariant: Map<string, ReputableListing[]>,
): Map<string, VariantReputablePrice> {
  const out = new Map<string, VariantReputablePrice>()

  for (const [key, listings] of byVariant) {
    const priced = reputablePrice(listings)
    if (!priced) continue
    const sep = key.indexOf(':')
    const itemId = key.slice(0, sep)
    const variant = key.slice(sep + 1)
    out.set(key, { ...priced, itemId, variant })
  }

  return out
}

/**
 * Convenience: group + price in one call, for callers that have already done
 * their game-specific cleanliness filtering and just want reputable prices.
 */
export function computeReputablePrices(
  listings: RawListing[],
): Map<string, VariantReputablePrice> {
  return priceGroupedListings(groupReputableListings(listings))
}

/**
 * A listing more than this multiple of the next-highest reputable listing in
 * its item+variant is a placeholder, not a price (a shop's out-of-stock price:
 * Adopt Me 2D Kitty MFR at $3,618.88 over $22–68 offers, qty 99,999). The
 * engine's cheapest-support walk falls back to the TOP listing when nothing
 * qualifies, so one of these could become the published price.
 */
export const PLACEHOLDER_HIGH_RATIO = 10

/**
 * Drop placeholder highs: while an item+variant's top reputable-capable
 * listing is more than `ratio` × the next one, it is not a price. Shared by
 * Adopt Me and the generic values pipeline (MM2).
 */
export function dropPlaceholderHighs(
  listings: RawListing[],
  ratio: number = PLACEHOLDER_HIGH_RATIO,
): { kept: RawListing[]; dropped: number } {
  const groups = new Map<string, RawListing[]>()
  for (const l of listings) {
    const price = Number(l.priceUsd)
    const reviews = Number(l.reviews)
    if (!(price > 0) || l.reviews == null || !(reviews >= REPUTABLE_MIN_REVIEWS)) continue
    const key = variantKey(l.itemId, l.variant)
    const list = groups.get(key)
    if (list) list.push(l)
    else groups.set(key, [l])
  }
  const drop = new Set<RawListing>()
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => Number(b.priceUsd) - Number(a.priceUsd))
    for (let i = 0; i < sorted.length - 1; i += 1) {
      if (Number(sorted[i].priceUsd) > Number(sorted[i + 1].priceUsd) * ratio) {
        drop.add(sorted[i])
      } else break
    }
  }
  return { kept: drop.size ? listings.filter((l) => !drop.has(l)) : listings, dropped: drop.size }
}
