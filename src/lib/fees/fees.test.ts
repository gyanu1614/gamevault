/**
 * Fee-spec worked examples (spec §8) — these exact numbers are the
 * acceptance tests for the whole fee structure. If any of these fail,
 * the money math has drifted from the published Fees & Charges page.
 */

import { describe, expect, it } from 'vitest'
import {
  buyerFee,
  cashRefundAmount,
  payoutFee,
  round2,
  storeCreditRefundAmount,
} from './index'

describe('worked example A — $100 standard currency sale', () => {
  it('buyer pays $107.00', () => {
    const fee = buyerFee(100)
    expect(fee.amount).toBe(7)
    expect(round2(100 + fee.amount)).toBe(107)
  })
  // Seller commission is resolved by the database (resolve_seller_fee) —
  // pinned by fee-resolver.guard / fee-checkout-snapshot.guard, not here.
  // The protection window is a row in order_completion_windows (fee PR 7) —
  // pinned by order-completion.guard, not here.
})

describe('worked example B — $300 mid-risk account sale', () => {
  it('buyer pays $321.00', () => {
    expect(round2(300 + buyerFee(300).amount)).toBe(321)
  })
})

describe('worked example C — $255 fiat payout', () => {
  it('fee $5.83, seller receives $249.17', () => {
    const { fee, net } = payoutFee(255, 'fiat')
    expect(fee).toBe(5.83)
    expect(net).toBe(249.17)
  })
})

describe('worked example D — store-credit refund of example A', () => {
  it('buyer credited $107.00 instantly', () => {
    expect(storeCreditRefundAmount(107)).toBe(107)
  })
})

describe('worked example E — cash refund of example A (PSP fee $3.75)', () => {
  it('buyer receives $103.25', () => {
    expect(cashRefundAmount(107, 3.75)).toBe(103.25)
  })
})

describe('spec rules (buyer side; protection windows and seller commission are database data)', () => {
  it('crypto payout: 3% + $10', () => {
    expect(payoutFee(100, 'crypto').fee).toBe(13)
    expect(payoutFee(100, 'crypto').net).toBe(87)
  })
})
