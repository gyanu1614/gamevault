/**
 * CoinGate order status → canonical event mapping (pure, table-tested).
 *
 * CoinGate statuses (from the integration spec):
 *   new        — invoice created, no coin selected (~2h expiry) → no event
 *   pending    — buyer selected currency, awaiting payment      → CHARGE_PENDING
 *   confirming — payment seen, awaiting confirmations            → CHARGE_PENDING
 *   paid       — fully paid & confirmed                          → CHARGE_CONFIRMED (use receive_amount/currency)
 *   invalid    — payment failed/insufficient                     → CHARGE_FAILED
 *   expired    — not paid in time                                → CHARGE_FAILED
 *   canceled   — canceled                                        → CHARGE_FAILED
 *   refunded   — refunded                                        → REFUND_COMPLETED
 *
 * Only `paid` releases the money flow.
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import { fromDecimal } from '@/lib/money'

export type CoinGateStatus =
  | 'new'
  | 'pending'
  | 'confirming'
  | 'paid'
  | 'invalid'
  | 'expired'
  | 'canceled'
  | 'refunded'

/** A CoinGate order object (fields we use), as returned by GET /v2/orders/{id}. */
export interface CoinGateOrder {
  id: number | string
  order_id: string // OUR order id (echoed back)
  status: string
  price_amount: string
  price_currency: string
  receive_amount?: string
  receive_currency?: string
}

/**
 * Map an authoritative (re-fetched) CoinGate order to 0..1 canonical events.
 * `new` returns []. For `paid`, the SETTLED amount (receive_amount in EUR) is
 * used — that's what actually landed, not the priced amount.
 */
export function coinGateToCanonical(o: CoinGateOrder): CanonicalEvent[] {
  const chargeId = String(o.id)
  const orderId = o.order_id

  switch (o.status as CoinGateStatus) {
    case 'pending':
    case 'confirming':
      return [{ type: 'CHARGE_PENDING', orderId, providerChargeId: chargeId }]

    case 'paid': {
      const amount =
        o.receive_amount && o.receive_currency
          ? fromDecimal(o.receive_amount, o.receive_currency)
          : fromDecimal(o.price_amount, o.price_currency)
      return [{ type: 'CHARGE_CONFIRMED', orderId, providerChargeId: chargeId, settled: amount }]
    }

    case 'invalid':
    case 'expired':
    case 'canceled':
      return [{ type: 'CHARGE_FAILED', orderId, providerChargeId: chargeId, reason: o.status }]

    case 'refunded':
      return [
        {
          type: 'REFUND_COMPLETED',
          orderId,
          refundId: chargeId,
          amount: fromDecimal(o.price_amount, o.price_currency),
        },
      ]

    case 'new':
    default:
      return []
  }
}

/** The stable dedupe id for a CoinGate event: charge id + status. */
export function coinGateEventId(o: CoinGateOrder): string {
  return `${o.id}:${o.status}`
}
