/**
 * The order row as one party may see it.
 *
 * The order page renders `order` into a client component, so every column
 * reaches that party's browser. Each side's private money/payment fields are
 * removed for the other side. Nothing either page displays is removed:
 *  - buyer loses the seller's payout, commission snapshot/trace and the
 *    platform's take (the buyer view shows only what they paid);
 *  - seller loses the buyer's checkout link, wallet use, promo, buyer-side
 *    processing fees and provider payment ids.
 */

const SELLER_PRIVATE = new Set([
  'seller_payout',
  'seller_commission_pct',
  'seller_fee_trace',
  'platform_fee',
  'platform_fee_rate',
  'stripe_transfer_id',
])

const BUYER_PRIVATE = new Set([
  'checkout_url',
  'wallet_amount_used',
  'promo_code_id',
  'promo_discount',
  'payment_processing_fee',
  'payment_processing_fee_rate',
  'provider_charge_id',
  'stripe_payment_intent_id',
  'payment_provider',
])

function isBuyerPrivate(key: string): boolean {
  return BUYER_PRIVATE.has(key) || key.startsWith('buyer_fee') || key.startsWith('buyer_method')
}

export function redactOrderFor<T extends Record<string, any>>(order: T, role: 'buyer' | 'seller' | 'admin'): T {
  if (role === 'admin') return order
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(order)) {
    if (role === 'buyer' && SELLER_PRIVATE.has(k)) continue
    if (role === 'seller' && isBuyerPrivate(k)) continue
    out[k] = v
  }
  return out as T
}
