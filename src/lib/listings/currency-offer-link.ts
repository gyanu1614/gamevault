import { CURRENCY_OFFER_PARAM, CURRENCY_SELLER_PARAM } from './url'

/**
 * Client half of a currency offer link (`listingUrl` / `currencyOfferUrl`):
 * read `?seller=&offer=` and find the offer to pin. Pure and client-safe — the
 * currency pages call it from a SearchParamsBridge callback, never from the
 * server (public pages must not read searchParams; CLAUDE.md, Step 7a).
 */

export interface CurrencyOfferLink {
  offerId: string | null
  sellerSlug: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

export function readCurrencyOfferLink(params: URLSearchParams): CurrencyOfferLink {
  const offer = params.get(CURRENCY_OFFER_PARAM)?.trim() ?? ''
  const seller = params.get(CURRENCY_SELLER_PARAM)?.trim() ?? ''
  return {
    offerId: UUID.test(offer) ? offer.toLowerCase() : null,
    sellerSlug: SLUG.test(seller) ? seller : null,
  }
}

/**
 * The offer a link points at: the exact listing if it is still on the page,
 * else that seller's cheapest offer, else null (the page keeps its normal
 * recommended pick — nothing breaks for a dead link).
 */
export function findLinkedOffer<T>(
  offers: readonly T[],
  link: CurrencyOfferLink,
  get: {
    id: (o: T) => string
    sellerSlug: (o: T) => string | null | undefined
    price: (o: T) => number
  },
): T | null {
  if (link.offerId) {
    const exact = offers.find((o) => get.id(o).toLowerCase() === link.offerId)
    if (exact) return exact
  }
  if (link.sellerSlug) {
    const want = link.sellerSlug.toLowerCase()
    let best: T | null = null
    for (const o of offers) {
      if ((get.sellerSlug(o) ?? '').toLowerCase() !== want) continue
      if (!best || get.price(o) < get.price(best)) best = o
    }
    return best
  }
  return null
}
