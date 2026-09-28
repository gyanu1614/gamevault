import { describe, expect, it } from 'vitest'
import { lifetimeSpentOf, matchesPurchaseFilter, saleRowAmounts } from './wallet-rows'

describe('wallet rows', () => {
  it('total spent counts paid orders only (not unpaid, cancelled or refunded)', () => {
    expect(
      lifetimeSpentOf([
        { status: 'completed', total_amount: 10.1 },
        { status: 'delivering', total_amount: 5.2 },
        { status: 'pending', total_amount: 99 },
        { status: 'cancelled', total_amount: 7 },
        { status: 'refunded', total_amount: 3 },
      ]),
    ).toBe(15.3)
  })

  it('In Progress = paid through disputed; other filters are exact', () => {
    for (const s of ['paid', 'delivering', 'delivered', 'disputed']) expect(matchesPurchaseFilter(s, 'in_progress')).toBe(true)
    expect(matchesPurchaseFilter('completed', 'in_progress')).toBe(false)
    expect(matchesPurchaseFilter('pending', 'in_progress')).toBe(false)
    expect(matchesPurchaseFilter('pending', 'pending')).toBe(true)
    expect(matchesPurchaseFilter('refunded', 'all')).toBe(true)
  })

  it('a sale adds up: item price − commission = payout (buyer fees excluded)', () => {
    // buyer paid 10.60 incl. a 0.60 method fee; item 10.00; seller keeps 9.20
    const r = saleRowAmounts({ status: 'completed', subtotal: 10, total_amount: 10.6, seller_payout: 9.2 })
    expect(r).toEqual({ amount: 10, platformFee: 0.8, netAmount: 9.2 })
    expect(Math.round((r.amount - r.platformFee) * 100) / 100).toBe(r.netAmount)
  })

  it('refunded pays nothing; a partial refund pays what was kept', () => {
    expect(saleRowAmounts({ status: 'refunded', subtotal: 10, seller_payout: 9.2 }).netAmount).toBe(0)
    expect(saleRowAmounts({ status: 'completed', subtotal: 10, seller_payout: 9.2 }, 6.2).netAmount).toBe(6.2)
  })
})

import { isPaidOrder, pendingPayoutOf } from './wallet-rows'

describe('seller KPIs', () => {
  it('pending payout = paid, unreleased sales only', () => {
    expect(
      pendingPayoutOf([
        { status: 'paid', seller_payout: 1.1 },
        { status: 'delivering', seller_payout: 2 },
        { status: 'delivered', seller_payout: 3 },
        { status: 'disputed', seller_payout: 4 },
        { status: 'disputed', seller_payout: 50, completed_at: '2026-09-01T00:00:00Z' },
        { status: 'pending', seller_payout: 99 },
        { status: 'completed', seller_payout: 7 },
        { status: 'cancelled', seller_payout: 8 },
      ]),
    ).toBe(10.1)
  })

  it('paid orders exclude unpaid checkouts and cancel-before-payment', () => {
    expect(isPaidOrder({ status: 'pending' })).toBe(false)
    expect(isPaidOrder({ status: 'cancelled', paid_at: null })).toBe(false)
    expect(isPaidOrder({ status: 'cancelled', paid_at: '2026-09-01T00:00:00Z' })).toBe(true)
    expect(isPaidOrder({ status: 'paid' })).toBe(true)
  })
})
