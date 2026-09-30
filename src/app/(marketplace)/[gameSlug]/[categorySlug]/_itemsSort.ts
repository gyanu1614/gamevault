/**
 * Items grid ordering (owner, 2026-09-30: "the best offer on top of the
 * page"). The best offer is, for now, the cheapest offer in stock; the
 * default (Recommended) order pins it first and ranks the rest by score.
 * An explicit sort the buyer picks is honoured as-is.
 */
import type { ItemOffer, ItemSort } from './_itemsTypes'

const inStock = (o: ItemOffer) => o.pricePerUnit > 0 && (o.isUnlimited || (o.stock ?? 0) > 0)

/** Cheapest in-stock offer, or null when there are fewer than two to compare. */
export function bestOfferId(offers: ItemOffer[]): string | null {
  const candidates = offers.filter(inStock)
  if (candidates.length < 2) return null
  return candidates.reduce((best, o) => (o.pricePerUnit < best.pricePerUnit ? o : best)).id
}

export function sortOffers(offers: ItemOffer[], sort: ItemSort): ItemOffer[] {
  const arr = [...offers]
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => a.pricePerUnit - b.pricePerUnit)
    case 'price-desc':
      return arr.sort((a, b) => b.pricePerUnit - a.pricePerUnit)
    case 'top-rated':
      return arr.sort((a, b) => (b.seller.ratingPercent ?? -1) - (a.seller.ratingPercent ?? -1))
    case 'best-sellers':
      return arr.sort((a, b) => b.seller.sales - a.seller.sales)
    case 'recommended':
    default: {
      arr.sort((a, b) => b.recommended - a.recommended)
      const best = bestOfferId(offers)
      const at = best ? arr.findIndex((o) => o.id === best) : -1
      if (at > 0) arr.unshift(...arr.splice(at, 1))
      return arr
    }
  }
}
