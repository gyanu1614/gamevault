/**
 * Round B Part 4 (PAY-010): the reconciler re-runs a webhook event whose
 * first run never reached webhook_event_mark. To do that it needs the
 * canonical events the router already verified — stored on the
 * webhook_events row at claim time. Money is bigint minor units, which
 * JSON cannot carry, so the stored shape is explicit and round-trips.
 */
import { describe, it, expect } from 'vitest'
import { serializeCanonicalEvents, deserializeCanonicalEvents } from '@/lib/payments/webhook-events-serde'
import type { CanonicalEvent } from '@/lib/payments/types'
import { money } from '@/lib/money'

const ALL: CanonicalEvent[] = [
  { type: 'CHARGE_PENDING', orderId: 'o1', providerChargeId: 'c1' },
  { type: 'CHARGE_CONFIRMED', orderId: 'o1', providerChargeId: 'c1', settled: money(10700n, 'USD'), paid: money(15000n, 'USD') },
  { type: 'CHARGE_CONFIRMED', orderId: 'o1', providerChargeId: 'c1', settled: money(10700n, 'USD') },
  { type: 'CHARGE_FAILED', orderId: 'o1', providerChargeId: 'c1', reason: 'expired' },
  { type: 'REFUND_COMPLETED', orderId: 'o1', refundId: 'r1', amount: money(500n, 'USD') },
  { type: 'PAYOUT_COMPLETED', payoutId: 'p1', amount: money(1n, 'USD') },
  { type: 'PAYOUT_FAILED', payoutId: 'p1', reason: 'x' },
  { type: 'CHARGEBACK_OPENED', orderId: 'o1', providerChargeId: 'c1', amount: money(999n, 'USD') },
  { type: 'CHARGEBACK_RESOLVED', orderId: 'o1', providerChargeId: 'c1', won: true },
]

describe('webhook events serde', () => {
  it('round-trips every canonical event, bigint money included', () => {
    const json = JSON.stringify(serializeCanonicalEvents(ALL))
    expect(json).not.toMatch(/undefined/)
    const back = deserializeCanonicalEvents(JSON.parse(json))
    expect(back).toEqual(ALL)
    expect(typeof (back[1] as any).settled.amountMinor).toBe('bigint')
    expect(typeof (back[1] as any).paid.amountMinor).toBe('bigint')
    expect((back[2] as any).paid).toBeUndefined()
  })

  it('rejects a payload that is not an event list', () => {
    expect(() => deserializeCanonicalEvents({ nope: 1 })).toThrow(/events/)
    expect(() => deserializeCanonicalEvents([{ type: 'NOT_A_THING' }])).toThrow(/NOT_A_THING/)
  })
})
