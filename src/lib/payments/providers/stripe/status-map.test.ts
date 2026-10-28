/**
 * Stripe Checkout Session → canonical events (the pure half of the adapter).
 * The webhook body is never trusted: these functions only ever see the
 * session / charge / dispute RE-FETCHED from Stripe with our secret key.
 */
import { describe, it, expect } from 'vitest'

import {
  stripeSessionState,
  stripeSessionOrderId,
  stripeSessionToCanonical,
  stripeSessionEventId,
  stripeRefundNotice,
  stripeDisputeNotice,
  type StripeSessionView,
} from './status-map'

const ORDER = '11111111-2222-3333-4444-555555555555'

function session(over: Partial<StripeSessionView> = {}): StripeSessionView {
  return {
    id: 'cs_test_1',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 1234,
    currency: 'usd',
    client_reference_id: ORDER,
    metadata: { order_id: ORDER, amount_minor: '1234', currency: 'USD' },
    payment_intent: 'pi_1',
    ...over,
  }
}

describe('stripeSessionState', () => {
  it('complete + paid is completed', () => {
    expect(stripeSessionState(session())).toBe('completed')
  })
  it('complete + unpaid is processing (an async method still in flight)', () => {
    expect(stripeSessionState(session({ payment_status: 'unpaid' }))).toBe('processing')
  })
  it('open is pending, expired is expired', () => {
    expect(stripeSessionState(session({ status: 'open', payment_status: 'unpaid' }))).toBe('pending')
    expect(stripeSessionState(session({ status: 'expired', payment_status: 'unpaid' }))).toBe('expired')
  })
})

describe('stripeSessionOrderId', () => {
  it('reads the order id we set as client_reference_id and metadata.order_id', () => {
    expect(stripeSessionOrderId(session())).toBe(ORDER)
  })
  it('refuses a session whose two order ids disagree', () => {
    expect(() => stripeSessionOrderId(session({ client_reference_id: 'other' }))).toThrow(/order id/)
  })
  it('refuses a session that carries no order id (not ours)', () => {
    expect(() => stripeSessionOrderId(session({ client_reference_id: null, metadata: {} }))).toThrow(/order id/)
  })
})

describe('stripeSessionToCanonical', () => {
  it('a paid session confirms the order for the amount it charged', () => {
    const [e] = stripeSessionToCanonical(session())
    expect(e).toMatchObject({ type: 'CHARGE_CONFIRMED', orderId: ORDER, providerChargeId: 'cs_test_1' })
    if (e.type !== 'CHARGE_CONFIRMED') throw new Error('unreachable')
    expect(e.settled).toEqual({ amountMinor: 1234n, currency: 'USD' })
    expect(e.paid).toEqual({ amountMinor: 1234n, currency: 'USD' })
  })

  it('never confirms when the charged amount differs from the amount we asked for', () => {
    const events = stripeSessionToCanonical(session({ amount_total: 1000 }))
    expect(events).toEqual([{ type: 'CHARGE_PENDING', orderId: ORDER, providerChargeId: 'cs_test_1' }])
  })

  it('never confirms when the charged currency differs from the one we asked for', () => {
    const events = stripeSessionToCanonical(session({ currency: 'gbp' }))
    expect(events[0].type).toBe('CHARGE_PENDING')
  })

  it('never confirms when the session carries no amount stamp (not created by us)', () => {
    const events = stripeSessionToCanonical(session({ metadata: { order_id: ORDER } }))
    expect(events[0].type).toBe('CHARGE_PENDING')
  })

  it('a complete but unpaid session is pending', () => {
    expect(stripeSessionToCanonical(session({ payment_status: 'unpaid' }))[0].type).toBe('CHARGE_PENDING')
  })

  it('an expired session fails the charge', () => {
    expect(stripeSessionToCanonical(session({ status: 'expired', payment_status: 'unpaid' }))).toEqual([
      { type: 'CHARGE_FAILED', orderId: ORDER, providerChargeId: 'cs_test_1', reason: 'expired' },
    ])
  })

  it('an async payment that failed fails the charge — only when the session is not paid', () => {
    expect(stripeSessionToCanonical(session({ payment_status: 'unpaid' }), { asyncFailed: true })).toEqual([
      { type: 'CHARGE_FAILED', orderId: ORDER, providerChargeId: 'cs_test_1', reason: 'async_payment_failed' },
    ])
    // A stale "failed" delivered after the money arrived never cancels a paid order.
    expect(stripeSessionToCanonical(session(), { asyncFailed: true })[0].type).toBe('CHARGE_CONFIRMED')
  })
})

describe('stripeSessionEventId', () => {
  it('keys the dedupe on the session and its re-fetched outcome', () => {
    expect(stripeSessionEventId(session())).toBe('cs_test_1:completed')
    expect(stripeSessionEventId(session({ status: 'expired', payment_status: 'unpaid' }))).toBe('cs_test_1:expired')
    expect(stripeSessionEventId(session({ payment_status: 'unpaid' }), { asyncFailed: true })).toBe('cs_test_1:failed')
  })
})

describe('refund and dispute notices (recorded for admin, never a money move)', () => {
  it('a refund becomes a PAYMENT_NOTICE carrying the total refunded so far', () => {
    const r = stripeRefundNotice({
      id: 'ch_1',
      amount_refunded: 500,
      currency: 'usd',
      payment_intent: { id: 'pi_1', metadata: { order_id: ORDER } },
    })
    expect(r.providerEventId).toBe('ch_1:refunded:500')
    expect(r.events).toEqual([
      { type: 'PAYMENT_NOTICE', kind: 'refund', orderId: ORDER, providerChargeId: 'ch_1', amount: { amountMinor: 500n, currency: 'USD' }, detail: null },
    ])
  })

  it('a refund on a payment that is not one of our orders records nothing', () => {
    const r = stripeRefundNotice({ id: 'ch_2', amount_refunded: 100, currency: 'usd', payment_intent: { id: 'pi_2', metadata: {} } })
    expect(r.events).toEqual([])
    expect(r.providerEventId).toBe('ch_2:refunded:100')
  })

  it('a dispute becomes a PAYMENT_NOTICE with its reason and deadline', () => {
    const d = stripeDisputeNotice({
      id: 'dp_1',
      amount: 1234,
      currency: 'usd',
      reason: 'fraudulent',
      charge: 'ch_1',
      evidence_details: { due_by: 1_800_000_000 },
      payment_intent: { id: 'pi_1', metadata: { order_id: ORDER } },
    })
    expect(d.providerEventId).toBe('dp_1:created')
    expect(d.events).toEqual([
      {
        type: 'PAYMENT_NOTICE',
        kind: 'dispute',
        orderId: ORDER,
        providerChargeId: 'ch_1',
        amount: { amountMinor: 1234n, currency: 'USD' },
        detail: 'reason fraudulent, respond by 2027-01-15',
      },
    ])
  })
})
