import { describe, it, expect } from 'vitest'
import { returnDestination } from './return-destination'

const base = { orderId: 'o1', listingId: 'l1', quantity: 2, pmKind: 'instant' as const, providerState: null as string | null }

describe('returnDestination — where Payssion\'s return lands the buyer (same-tab pay)', () => {
  it('a paid order goes to the Order Paid page', () => {
    for (const status of ['paid', 'delivering', 'delivered', 'completed']) {
      expect(returnDestination({ ...base, status }), status).toBe('/checkout/paid/o1')
    }
  })

  it('a cancelled order goes back to checkout with the cancelled toast', () => {
    expect(returnDestination({ ...base, status: 'cancelled' })).toBe('/checkout/l1?qty=2&cancelled=1')
  })

  it('refunded / disputed orders go to their plain order page', () => {
    expect(returnDestination({ ...base, status: 'refunded' })).toBe('/account/orders/o1')
  })

  it('pending + Payssion says paid → Order Paid page (it confirms while the webhook lands)', () => {
    expect(returnDestination({ ...base, status: 'pending', providerState: 'completed' })).toBe('/checkout/paid/o1')
    expect(returnDestination({ ...base, status: 'pending', providerState: 'paid_more' })).toBe('/checkout/paid/o1')
  })

  it('pending + Payssion says cancelled/failed → checkout with the cancelled toast', () => {
    for (const s of ['cancelled', 'failed', 'expired', 'rejected', 'blocked', 'error']) {
      expect(returnDestination({ ...base, status: 'pending', providerState: s }), s).toBe('/checkout/l1?qty=2&cancelled=1')
    }
  })

  it('pending + still unpaid at Payssion → checkout, keeping the order so the page can say "not finished"', () => {
    expect(returnDestination({ ...base, status: 'pending', providerState: 'pending' })).toBe('/checkout/l1?qty=2&order=o1')
  })

  it('a voucher still open (BCP code, Boleto slip) → its order page with the instructions', () => {
    expect(returnDestination({ ...base, status: 'pending', pmKind: 'voucher', providerState: 'pending' })).toBe('/account/orders/o1')
  })

  it('pending and Payssion could not be asked → Order Paid page in confirming mode (never claims paid)', () => {
    expect(returnDestination({ ...base, status: 'pending', providerState: null })).toBe('/checkout/paid/o1')
  })
})
