import { describe, it, expect } from 'vitest'
import { refundRowsToShow, refundSentence, toRefundToCardRow } from './refund-to-card-rows'

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

describe('refundRowsToShow', () => {
  it('leaves out a refund with nothing to do or tell', () => {
    const rows = [
      toRefundToCardRow(base, 7000),
      toRefundToCardRow({ ...base, refundable: false }, 7000),
      toRefundToCardRow(base, 0),
      toRefundToCardRow({ ...base, request_status: 'sent' }, 0),
    ]
    expect(refundRowsToShow(rows).map((r) => r.state)).toEqual(['available', 'sent'])
  })
})

describe('refundSentence', () => {
  const says = (status: string | null) => refundSentence(toRefundToCardRow({ ...base, request_status: status }, 7000))

  it('states the choice: what is in the balance and what the payment method would get', () => {
    expect(says(null)).toBe("Your refund for order #DM-AB12-CD34 is in your balance as $70.00 store credit. Want it back on Pix instead? You'd get $74.97, service fee included.")
  })

  it('states where a request is', () => {
    expect(says('pending')).toContain("We're sending $74.97 back to Pix")
    expect(says('sent')).toContain('We sent $74.97 back to Pix')
    expect(says('rejected')).toContain('$70.00 stays in your balance')
    expect(says('failed')).toContain('Please contact Support')
  })

  it('names the order, so the row can link it', () => {
    for (const status of [null, 'pending', 'sent', 'rejected', 'failed']) expect(says(status)).toContain('#DM-AB12-CD34')
  })

  it('has a plain name when the method is unknown', () => {
    expect(refundSentence(toRefundToCardRow({ ...base, method_label: null }, 7000))).toContain('your payment method')
  })

  it('uses no jargon', () => {
    for (const status of [null, 'pending', 'sent', 'rejected', 'failed']) expect(says(status)).not.toMatch(/escrow|on hold|ledger|quote|minor/i)
  })
})
