/**
 * Fee-spec worked examples (spec §8) — these exact numbers are the
 * acceptance tests for the whole fee structure. If any of these fail,
 * the money math has drifted from the published Fees & Charges page.
 */

import { describe, expect, it } from 'vitest'
import { payoutFee, round2, SERVICE_FEE_LABEL } from './index'

describe('worked example A — $100 standard currency sale', () => {
  // The whole buyer fee is quoted by the database (buyer_fee_quote) and
  // pinned by buyer-service-fee.guard; TypeScript keeps only the label.
  it('no TypeScript buyer-fee computation exists; the one display label is "Service fee"', async () => {
    const mod = await import('./index')
    expect((mod as any).buyerFee).toBeUndefined()
    expect((mod as any).BUYER_MARKETPLACE_FEE_PCT).toBeUndefined()
    expect(SERVICE_FEE_LABEL).toBe('Service fee')
    expect(round2(100 + 2 + 5.1)).toBe(107.1)
  })
  // Seller commission is resolved by the database (resolve_seller_fee) —
  // pinned by fee-resolver.guard / fee-checkout-snapshot.guard, not here.
  // The protection window is a row in order_completion_windows (fee PR 7) —
  // pinned by order-completion.guard, not here.
})

describe('worked example C — $255 fiat payout', () => {
  it('fee $5.83, seller receives $249.17', () => {
    const { fee, net } = payoutFee(255, 'fiat')
    expect(fee).toBe(5.83)
    expect(net).toBe(249.17)
  })
})

// Refund amounts (worked examples D / E) are decided in SQL now — see
// src/test/guards/refund-policy.guard.integration.test.ts.

describe('spec rules (buyer side; protection windows and seller commission are database data)', () => {
  it('crypto payout: 3% + $10', () => {
    expect(payoutFee(100, 'crypto').fee).toBe(13)
    expect(payoutFee(100, 'crypto').net).toBe(87)
  })
})
