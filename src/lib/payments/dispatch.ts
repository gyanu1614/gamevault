/**
 * Canonical event → SafeDrop operation dispatch (spec §6 step 4).
 *
 * Maps each provider-agnostic CanonicalEvent to the order transition it drives.
 * The transition itself is atomic + idempotent (safedrop_transition RPC), so
 * this layer is a thin, pure mapping. Events that don't move an order's state
 * (payouts, chargeback-resolved bookkeeping) are handled separately in later
 * phases; here we map the charge/refund/chargeback-open events that drive the
 * order lifecycle.
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import type { OrderEvent } from '@/lib/escrow/state-machine'
import { transition } from '@/lib/escrow/transition'

/**
 * Resolve the SafeDrop OrderEvent for a canonical event, or null if the event
 * does not drive an order transition (e.g. PAYOUT_*, CHARGEBACK_RESOLVED — those
 * are ledger/reserve concerns handled in Phase 5).
 */
export function orderEventFor(event: CanonicalEvent): OrderEvent | null {
  switch (event.type) {
    case 'CHARGE_CONFIRMED':
      return 'CHARGE_CONFIRMED'
    case 'CHARGE_FAILED':
      // A failed charge cancels an unpaid order.
      return 'CANCELLED'
    case 'REFUND_COMPLETED':
      return 'REFUNDED'
    case 'CHARGEBACK_OPENED':
      // Treated as a refund of the order for state purposes; the clawback /
      // reserve waterfall (Phase 5) reacts to the same event separately.
      return 'REFUNDED'
    case 'CHARGE_PENDING':
      // Buyer selected a method; no order-state change (order stays
      // PENDING_PAYMENT until CONFIRMED). No transition.
      return null
    case 'PAYOUT_COMPLETED':
    case 'PAYOUT_FAILED':
    case 'CHARGEBACK_RESOLVED':
      return null
    default: {
      // Exhaustiveness guard: if a new CanonicalEvent type is added, TS errors here.
      const _never: never = event
      return _never
    }
  }
}

/**
 * dispatch — apply a single canonical event to the order lifecycle.
 *
 * Returns a short result describing what happened. A no-op event (no order
 * transition) returns { applied: false }. The dedupe key passed to the
 * transition includes the providerEventId so a replayed webhook can't
 * double-apply even if dedupe somehow lets it through.
 */
export async function dispatch(
  event: CanonicalEvent,
  providerEventId: string
): Promise<{ applied: boolean; orderId?: string; status?: string }> {
  const orderEvent = orderEventFor(event)
  if (orderEvent === null) {
    return { applied: false }
  }

  // Only events carrying an orderId drive a transition.
  if (!('orderId' in event) || !event.orderId) {
    return { applied: false }
  }

  const result = await transition(event.orderId, orderEvent, providerEventId)

  // Comms ride on top of an APPLIED transition only (a replayed/no-op webhook
  // must not re-email anyone). AWAITED — on serverless the function freezes
  // once the webhook response is sent, so an unawaited send would be silently
  // dropped — but errors are swallowed: comms failure never fails the payment.
  if (result.changed) {
    const { notifyOrderTransition } = await import('@/lib/payments/notify')
    await notifyOrderTransition(orderEvent, event.orderId, event).catch(() => {})
  }

  return { applied: result.changed, orderId: result.orderId, status: result.status }
}
