/**
 * V34 — Offer-section classification, shared by the seller Offers tables
 * (/account/listings) and the Messages chat tabs.
 *
 * A listing's category type (categories.metadata.type) maps to one of
 * the four offer sections; the slug regexes are a fallback for legacy
 * rows whose metadata is missing.
 */

export type OfferType = 'currency' | 'items' | 'accounts' | 'top-up'

/**
 * Account risk band by game slug — kept for the admin Fees tab's risk-band
 * display (setAccountRiskBand). Since fee PR 7 it drives NO window: the
 * SafeDrop Protection window per category is a row in order_completion_windows.
 * It is NOT a fee input: account commission rates are fee_rules pair rows
 * resolved by resolve_seller_fee (fee-engine.md §9 A10, §10 Q4).
 * Unlisted games default to mid.
 */
export type AccountRiskBand = 'low' | 'mid' | 'high'

export const ACCOUNT_RISK_BANDS: Record<string, AccountRiskBand> = {
  'gta-v': 'high',
  gtavi: 'high',
  'gta-6': 'high',
}
export const DEFAULT_ACCOUNT_RISK_BAND: AccountRiskBand = 'mid'

export function accountRiskBand(gameSlug: string | null | undefined): AccountRiskBand {
  return ACCOUNT_RISK_BANDS[(gameSlug || '').toLowerCase()] ?? DEFAULT_ACCOUNT_RISK_BAND
}

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
