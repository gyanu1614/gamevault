import { describe, it, expect } from 'vitest'
import { toRefundToCardRow } from './refund-to-card-rows'

// A $70 item + $4.97 service fee, refunded as $70 store credit.
const base = {
  order_id: '7f0c9a52-1111-4222-8333-944455556666',
  order_number: 'DM-AB12-CD34',
  credit_minor: 7000,
  fee_minor: 497,
  total_minor: 7497,
  currency: 'USD',
  method_label: 'Pix',
  refundable: true,
  request_status: null,
}

describe('toRefundToCardRow', () => {
  it('a refundable, unrequested order with its credit unspent can go back to the card for the full amount', () => {
    expect(toRefundToCardRow(base, 7000)).toEqual({
      orderId: base.order_id,
      orderNumber: 'DM-AB12-CD34',
      creditMinor: 7000,
      feeMinor: 497,
      totalMinor: 7497,
      currency: 'USD',
      methodLabel: 'Pix',
      state: 'available',
    })
  })

  it('a rail that cannot refund (crypto) is store credit only', () => {
    expect(toRefundToCardRow({ ...base, refundable: false }, 7000).state).toBe('store_credit_only')
  })

  it('credit already spent cannot be sent back', () => {
    expect(toRefundToCardRow(base, 6999).state).toBe('credit_spent')
  })

  it('an existing request shows where it is', () => {
    expect(toRefundToCardRow({ ...base, request_status: 'pending' }, 0).state).toBe('requested')
    expect(toRefundToCardRow({ ...base, request_status: 'approved' }, 0).state).toBe('requested')
    expect(toRefundToCardRow({ ...base, request_status: 'sent' }, 0).state).toBe('sent')
    expect(toRefundToCardRow({ ...base, request_status: 'rejected' }, 7000).state).toBe('rejected')
    expect(toRefundToCardRow({ ...base, request_status: 'failed' }, 7000).state).toBe('failed')
  })

  it('falls back to the short id when the order has no number, and to no label', () => {
    const row = toRefundToCardRow({ ...base, order_number: null, method_label: null }, 7000)
    expect(row.orderNumber).toBe('7F0C9A52')
    expect(row.methodLabel).toBeNull()
  })
})
