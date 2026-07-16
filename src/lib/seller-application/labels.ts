/**
 * Seller application — shared human-readable label maps.
 *
 * Every raw enum value the wizard stores in `seller_applications` has a
 * display label here so admins (and the final-review step) never see
 * machine values like `under_500` or `bank_transfer`.
 *
 * Plain TS, safe to import from client wizard, server actions, and admin UI.
 */

export const VOLUME_LABELS: Record<string, string> = {
  under_500: 'Under $500',
  '500_2000': '$500 - $2,000',
  '2000_10000': '$2,000 - $10,000',
  over_10000: 'Over $10,000',
}

export const PAYOUT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  crypto: 'Crypto',
  // Legacy rows only — the wizard no longer offers these values.
  cryptocurrency: 'Crypto',
  paypal: 'PayPal',
}

export const SELLER_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  business: 'Business',
}

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  llc: 'LLC',
  corporation: 'Corporation',
  sole_proprietorship: 'Sole Proprietorship',
  partnership: 'Partnership',
  other: 'Other',
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  id_front: 'Government ID',
  id_back: 'Government ID (Back)',
  selfie_with_id: 'Selfie With ID',
  proof_of_address: 'Proof of Address',
  certificate_of_incorporation: 'Certificate of Incorporation',
  business_license: 'Business License',
  director_id: 'Director / Owner ID',
  bank_statement: 'Bank Statement',
  w9_form: 'W-9 Form',
  w8ben_form: 'W-8BEN Form',
  other: 'Other Document',
}

export const TAX_FORM_LABELS: Record<string, string> = {
  w9: 'W-9 (US)',
  w8ben: 'W-8BEN (International)',
  none: 'Not Applicable',
}

export const CRYPTO_TYPE_LABELS: Record<string, string> = {
  BTC: 'Bitcoin (BTC)',
  ETH: 'Ethereum (ETH)',
  USDT: 'Tether (USDT)',
}

/**
 * Resolve a raw stored value to its label. Unknown values fall back to a
 * lightly humanized version of the raw value (underscores → spaces) so
 * nothing ever renders as `some_raw_enum`.
 */
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return 'Not specified'
  return map[value] ?? value.replace(/_/g, ' ')
}
