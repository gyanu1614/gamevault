/**
 * V34 — Offer-section classification, shared by the seller Offers tables
 * (/account/listings) and the Messages chat tabs.
 *
 * A listing's category type (categories.metadata.type) maps to one of
 * the four offer sections; the slug regexes are a fallback for legacy
 * rows whose metadata is missing.
 */

export type OfferType = 'currency' | 'items' | 'accounts' | 'top-up'

export function classifyOfferType(
  metaType: string | undefined,
  slug: string | undefined,
): OfferType {
  const t = (metaType || '').toLowerCase()
  if (t === 'currency') return 'currency'
  if (t === 'account') return 'accounts'
  if (t === 'top_up') return 'top-up'
  if (t === 'items' || t === 'item') return 'items'
  const s = (slug || '').toLowerCase()
  if (/vbuck|robux|coin|gold|gem|currenc|points?|credits?/.test(s)) return 'currency'
  if (/account/.test(s)) return 'accounts'
  if (/top-?up/.test(s)) return 'top-up'
  return 'items'
}
