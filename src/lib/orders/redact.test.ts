import { describe, expect, it } from 'vitest'
import { redactOrderFor } from './redact'

const order = {
  id: 'o1', status: 'completed', total_amount: 10.6, subtotal: 10, quantity: 1,
  seller_payout: 9.2, seller_commission_pct: 8, seller_fee_trace: { rule: 'x' }, platform_fee: 0.8, platform_fee_rate: 0.08,
  checkout_url: 'https://pay', wallet_amount_used: 2, promo_code_id: 'p', promo_discount: 1,
  payment_processing_fee: 0.6, provider_charge_id: 'ch_1', buyer_fee_method: 'card', buyer_method_fee_minor: 60,
  payment_expires_at: '2026-09-27T00:00:00Z', delivery_details: { username: 'x' },
}

describe('redactOrderFor', () => {
  it('the buyer never receives the seller payout / commission / platform take', () => {
    const b = redactOrderFor(order, 'buyer')
    for (const k of ['seller_payout', 'seller_commission_pct', 'seller_fee_trace', 'platform_fee', 'platform_fee_rate']) {
      expect(b, k).not.toHaveProperty(k)
    }
    // …but keeps what the buyer view uses.
    expect(b).toMatchObject({ total_amount: 10.6, checkout_url: 'https://pay', payment_expires_at: order.payment_expires_at })
  })

  it("the seller never receives the buyer's payment details", () => {
    const s = redactOrderFor(order, 'seller')
    for (const k of ['checkout_url', 'wallet_amount_used', 'promo_code_id', 'promo_discount', 'payment_processing_fee', 'provider_charge_id', 'buyer_fee_method', 'buyer_method_fee_minor']) {
      expect(s, k).not.toHaveProperty(k)
    }
    expect(s).toMatchObject({ seller_payout: 9.2, seller_commission_pct: 8, platform_fee: 0.8, subtotal: 10, delivery_details: { username: 'x' } })
  })

  it('admins see everything', () => {
    expect(redactOrderFor(order, 'admin')).toEqual(order)
  })
})
