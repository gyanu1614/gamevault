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
  providerEventId: string,
  /** Round B: the provider the event came from — binds its charge id to the
   *  order's payment attempt inside the money RPCs. */
  providerName?: string,
  opts?: {
    /** CHARGE_FAILED only: how the open attempt closes. The expiry sweep
     *  passes 'void' (we closed it); a provider webhook leaves the default
     *  ('failed' — the provider reported it dead). */
    closeAttemptAs?: 'failed' | 'void'
    /** The sweep asked the provider before cancelling: its answer. */
    providerVoidOutcome?: 'voided' | 'already_closed' | 'unsupported'
  }
): Promise<{ applied: boolean; orderId?: string; status?: string }> {
  const orderEvent = orderEventFor(event)
  if (orderEvent === null) {
    return { applied: false }
  }

  // Only events carrying an orderId drive a transition.
  if (!('orderId' in event) || !event.orderId) {
    return { applied: false }
  }

  // DB-015: the two money-bearing events that also touch the buyer's wallet
  // run transition + wallet leg in ONE DB transaction. A failure throws out of
  // dispatch → the router marks the event failed and answers 500, so the
  // provider retries; both RPCs are idempotent, so the retry converges.
  //   REFUND_COMPLETED → order_refund_to_wallet: escrow_held → refunds (gross)
  //     + refunds → user_wallet for what the PROVIDER refunded, clamped to the
  //     order total (partial refunds are real; a quirk can never over-credit).
  //     Store-credit refunds are 100% (Refund & Dispute Policy). NOT for
  //     CHARGEBACK_OPENED — a chargeback claws the cash back through the
  //     provider, no wallet credit.
  //   CHARGE_FAILED → order_cancel_return_wallet: CANCELLED + exact mirror of
  //     the checkout wallet hold (checkout_wallet:<id>) back to user_wallet.
  //
  // SUPPORT RUNBOOK — manual external refunds: no code path calls the
  // provider's refund() (CoinGate's throws 'not yet implemented'), so a
  // REFUND_COMPLETED event only arrives after someone refunds manually in the
  // provider dashboard. If the buyer was ALREADY given store credit (ledger
  // txn keyed 'wallet_refund:<orderId>' — or
  // 'wallet_refund:<orderId>:partial:<disputeId>' from a partial dispute), a
  // manual external refund on top is DOUBLE compensation. Always check
  // ledger_transactions for those keys before refunding at the provider.
  let result
  // PAY-003: a confirmed payment whose stock was already gone is refunded
  // to the buyer's wallet inside the confirm transaction; the comms below
  // must then be the REFUND comms, not the paid ones.
  let notifyEvent: OrderEvent = orderEvent
  const charge =
    providerName && 'providerChargeId' in event && event.providerChargeId
      ? { provider: providerName, providerChargeId: event.providerChargeId }
      : undefined
  try {
    if (event.type === 'CHARGE_CONFIRMED') {
      const { confirmOrderPayment } = await import('@/lib/wallet/order-money')
      const confirmed = await confirmOrderPayment(event.orderId, providerEventId, charge, {
        amountMinor: event.settled.amountMinor,
        currency: event.settled.currency,
        paidMinor: event.paid?.amountMinor,
      })
      if (confirmed.outcome === 'late_credited') {
        // Round B Part 3 (PAY-009): money for a charge the order no longer
        // wanted — credited to the buyer's wallet inside the RPC (buyer and
        // admins notified there, once). The order is untouched and this is
        // a PROCESSED event: no throw, no failed row, no provider retry.
        console.warn(
          `[Dispatch] late payment on order ${event.orderId} (charge ${event.providerChargeId}, status ${confirmed.status}): ${confirmed.creditedMinor} minor credited to the buyer wallet`
        )
        return { applied: false, orderId: confirmed.orderId, status: confirmed.status }
      }
      if (confirmed.outcome === 'oversold_refunded') {
        console.warn(
          `[Dispatch] order ${event.orderId} paid but out of stock (${confirmed.reason ?? 'unknown'}) — refunded to the buyer wallet in the same transaction`
        )
        notifyEvent = 'REFUNDED'
      }
      result = confirmed
    } else if (event.type === 'REFUND_COMPLETED') {
      const { refundOrderToWallet } = await import('@/lib/wallet/order-money')
      result = await refundOrderToWallet(event.orderId, providerEventId, event.amount?.amountMinor)
    } else if (event.type === 'CHARGE_FAILED') {
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      result = await cancelOrderReturnWallet(event.orderId, providerEventId, {
        charge,
        closeAttemptAs: opts?.closeAttemptAs,
        providerVoidOutcome: opts?.providerVoidOutcome,
      })
      // PAY-002: a stale/late failure for an order that is already paid (or
      // terminal) is refused inside the RPC — nothing moved, admins were
      // alerted once. Not an error: the event is processed (no provider retry).
      if (result.refused) {
        console.warn(
          `[Dispatch] CHARGE_FAILED refused for order ${event.orderId} (status ${result.status}, charge ${event.providerChargeId}): order is not pending`
        )
      } else if (result.reason === 'stale_attempt') {
        // Round B: the charge that failed is no longer the order's open
        // attempt (a retry superseded it); the live attempt is untouched.
        console.warn(
          `[Dispatch] CHARGE_FAILED for superseded charge ${event.providerChargeId} on order ${event.orderId}: no-op`
        )
      }
    } else {
      result = await transition(event.orderId, orderEvent, providerEventId)
    }
  } catch (err) {
    // Round B: money for a closed order no longer lands here — the RPC
    // credits the buyer's wallet and notes admins once (Part 3). What still
    // throws is a genuine fault (unknown order, a charge bound to another
    // order, the database itself): log it and rethrow so the router marks
    // the event failed and answers 500 — the provider retries, and the
    // reconciler caps a poison row and alerts ONCE, in SQL (Part 4). No
    // TS-side notification insert: every admin page is admin_alert_once.
    if (event.type === 'CHARGE_CONFIRMED') {
      console.error(
        `[Dispatch] CHARGE_CONFIRMED for order ${event.orderId} (charge ${event.providerChargeId}) could not be applied:`,
        err
      )
    }
    throw err
  }

  if (result.changed) {
    // Comms ride on top of an APPLIED transition only (a replayed/no-op
    // webhook must not re-email anyone). AWAITED — on serverless the function
    // freezes once the webhook response is sent, so an unawaited send would
    // be silently dropped — but errors are swallowed: comms failure never
    // fails the payment.
    const { notifyOrderTransition } = await import('@/lib/payments/notify')
    await notifyOrderTransition(notifyEvent, event.orderId, notifyEvent === orderEvent ? event : undefined).catch(() => {})
  }

  return { applied: result.changed, orderId: result.orderId, status: result.status }
}
