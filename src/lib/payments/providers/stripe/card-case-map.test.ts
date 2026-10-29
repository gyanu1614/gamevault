/**
 * Stripe charges / disputes → CARD_CASE (the pure half). Only objects
 * RE-FETCHED from Stripe reach these functions.
 */
import { describe, it, expect } from 'vitest'

import {
  stripeRefundEvents,
  stripeDisputeOpened,
  stripeDisputeClosed,
  type StripeChargeView,
  type StripeDisputeView,
  type StripeRefundView,
} from './card-case-map'

const ORDER = '11111111-2222-3333-4444-555555555555'
const PI = { id: 'pi_1', metadata: { order_id: ORDER } }

function charge(refunds: StripeChargeView['refunds'], over: Partial<StripeChargeView> = {}): StripeChargeView {
  const refunded = (refunds?.data ?? []).reduce((s, r) => s + r.amount, 0)
  return { id: 'ch_1', amount: 1000, amount_refunded: refunded, currency: 'usd', payment_intent: PI, refunds, ...over }
}
const refund = (amount: number, ours = false, status = 'succeeded'): StripeRefundView => ({
  id: `re_${amount}_${ours ? 'dm' : 'x'}`,
  amount,
  status,
  metadata: ours ? { dm_refund: 'rts:req-1', order_id: ORDER } : {},
})
function dispute(over: Partial<StripeDisputeView> = {}): StripeDisputeView {
  return {
    id: 'dp_1', amount: 1000, currency: 'usd', reason: 'fraudulent', status: 'needs_response',
    evidence_details: { due_by: 1_800_000_000 }, payment_intent: PI, ...over,
  }
}

describe('stripeRefundEvents', () => {
  it('a full refund made outside DropMarket books a CARD_CASE on the charge', () => {
    const r = stripeRefundEvents(charge({ data: [refund(1000)], has_more: false }), 'cs_1')
    expect(r.providerEventId).toBe('ch_1:refunded:1000:1000')
    expect(r.events).toEqual([
      { type: 'CARD_CASE', kind: 'refund_external', orderId: ORDER, providerRef: 'ch_1:refund', sessionRef: 'cs_1', amount: { amountMinor: 1000n, currency: 'USD' } },
    ])
  })

  it('several outside refunds that add up to the payment are one full refund', () => {
    const r = stripeRefundEvents(charge({ data: [refund(400), refund(600)], has_more: false }), 'cs_1')
    expect(r.events[0]).toMatchObject({ type: 'CARD_CASE', amount: { amountMinor: 1000n } })
  })

  it('our own Refund To Card (dm_refund metadata) books nothing: the outbox already did', () => {
    expect(stripeRefundEvents(charge({ data: [refund(1000, true)], has_more: false }), 'cs_1').events).toEqual([])
  })

  it('a partial or mixed outside refund is an admin notice only', () => {
    for (const refunds of [
      { data: [refund(300)], has_more: false },
      { data: [refund(300), refund(700, true)], has_more: false },
      { data: [refund(1000)], has_more: true },
      { data: [refund(1000, false, 'pending')], has_more: false },
    ]) {
      const [e] = stripeRefundEvents(charge(refunds), 'cs_1').events
      expect(e).toMatchObject({ type: 'PAYMENT_NOTICE', kind: 'refund', orderId: ORDER, providerChargeId: 'ch_1' })
    }
  })

  it('a pending refund that later succeeds is a new event, then a card case', () => {
    const pending = stripeRefundEvents(charge({ data: [refund(1000, false, 'pending')], has_more: false }), 'cs_1')
    const done = stripeRefundEvents(charge({ data: [refund(1000)], has_more: false }), 'cs_1')
    expect(pending.providerEventId).not.toBe(done.providerEventId)
    expect(pending.events[0]).toMatchObject({ type: 'PAYMENT_NOTICE' })
    expect(done.events[0]).toMatchObject({ type: 'CARD_CASE', kind: 'refund_external' })
  })

  it('failed or cancelled refunds do not count', () => {
    const r = stripeRefundEvents(charge({ data: [refund(1000, false, 'failed')], has_more: false }), 'cs_1')
    expect(r.events).toEqual([])
  })

  it('a charge that is not one of our orders records nothing', () => {
    expect(stripeRefundEvents(charge({ data: [refund(1000)], has_more: false }, { payment_intent: { id: 'pi_2', metadata: {} } }), 'cs_1').events).toEqual([])
  })
})

describe('stripe disputes', () => {
  it('opened: a CARD_CASE with the reason and the evidence deadline', () => {
    const d = stripeDisputeOpened(dispute(), 'cs_1')
    expect(d.providerEventId).toBe('dp_1:created')
    expect(d.events).toEqual([
      {
        type: 'CARD_CASE', kind: 'dispute_opened', orderId: ORDER, providerRef: 'dp_1', sessionRef: 'cs_1',
        amount: { amountMinor: 1000n, currency: 'USD' }, reason: 'fraudulent', dueBy: '2027-01-15T08:00:00.000Z',
      },
    ])
  })

  it('closed: won (or an inquiry closed) releases, lost settles, anything else waits', () => {
    expect(stripeDisputeClosed(dispute({ status: 'won' })).events[0]).toMatchObject({ kind: 'dispute_closed', outcome: 'won' })
    expect(stripeDisputeClosed(dispute({ status: 'warning_closed' })).events[0]).toMatchObject({ outcome: 'won' })
    const lost = stripeDisputeClosed(dispute({ status: 'lost' }))
    expect(lost.providerEventId).toBe('dp_1:closed:lost')
    expect(lost.events[0]).toMatchObject({ kind: 'dispute_closed', outcome: 'lost', providerRef: 'dp_1' })
    expect(stripeDisputeClosed(dispute({ status: 'under_review' })).events).toEqual([])
  })

  it('opened after the verdict (a late retry): opened and closed in the same run', () => {
    const d = stripeDisputeOpened(dispute({ status: 'lost' }), 'cs_1')
    expect(d.events.map((e: any) => e.kind)).toEqual(['dispute_opened', 'dispute_closed'])
    expect(d.events[1]).toMatchObject({ outcome: 'lost' })
  })

  it('a dispute on a payment that is not ours records nothing', () => {
    expect(stripeDisputeOpened(dispute({ payment_intent: 'pi_9' }), null).events).toEqual([])
  })
})
