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

  let result
  try {
    result = await transition(event.orderId, orderEvent, providerEventId)
  } catch (err) {
    // A CONFIRMED charge that can't apply means real money arrived for an
    // order that is no longer payable (cancelled/superseded voucher paid
    // late, buyer cancelled mid-flight). That must never die silently in a
    // failed webhook row — page the admins, then rethrow so the event stays
    // recorded as failed (the dedupe claim stops retry spam).
    if (event.type === 'CHARGE_CONFIRMED') {
      await alertAdminsPaymentForClosedOrder(event.orderId, event.providerChargeId, err).catch(
        () => {}
      )
    }
    throw err
  }

  if (result.changed) {
    // Provider-completed refunds land in the buyer's WALLET as store credit
    // (Refund & Dispute Policy: store-credit refunds are 100%): the REFUNDED
    // transition moved escrow_held → refunds; this credit completes the chain
    // refunds → user_wallet. Idempotent on 'wallet_refund:<orderId>', so a
    // replayed webhook can't double-credit. NOT for CHARGEBACK_OPENED — a
    // chargeback claws the cash back through the provider, no wallet credit.
    //
    // SUPPORT RUNBOOK — manual external refunds: no code path calls the
    // provider's refund() (CoinGate's throws 'not yet implemented'), so a
    // REFUND_COMPLETED event only arrives after someone refunds manually in
    // the provider dashboard. If the buyer was ALREADY given store credit
    // (ledger txn keyed 'wallet_refund:<orderId>' — or
    // 'wallet_refund:<orderId>:partial:<disputeId>' from a partial dispute),
    // a manual external refund on top is DOUBLE compensation. Always check
    // ledger_transactions for those keys before refunding at the provider.
    // AWAITED but wrapped: a credit failure must never fail the webhook (the
    // idempotent key makes it safely retryable).
    if (event.type === 'REFUND_COMPLETED') {
      await (async () => {
        const { createServiceRoleClient } = await import('@/lib/supabase/service')
        const service = createServiceRoleClient()
        const { data: order } = await service
          .from('orders')
          .select('buyer_id, total_amount, currency')
          .eq('id', event.orderId)
          .single() as any
        if (order?.buyer_id && (order.total_amount ?? 0) > 0) {
          // Credit what the PROVIDER actually refunded (partial refunds are
          // real), clamped to the order total so a provider quirk can never
          // over-credit. Falls back to the order total when the event
          // carries no usable amount.
          const totalMinor = BigInt(Math.round(Number(order.total_amount) * 100))
          const eventMinor = event.amount?.amountMinor ?? 0n
          const creditMinor =
            eventMinor > 0n && eventMinor < totalMinor ? eventMinor : totalMinor
          const { refundToWallet } = await import('@/lib/wallet/wallet')
          await refundToWallet({
            userId: order.buyer_id,
            amountMinor: creditMinor,
            currency: (order.currency || 'EUR').toUpperCase(),
            orderId: event.orderId,
          })
        }
      })().catch((err) =>
        console.error('[Dispatch] Wallet refund credit failed (retryable):', err)
      )
    }

    // A failed/expired charge cancels the order — but CANCELLED only moves
    // escrow_held → the platform 'refunds' account. Any WALLET credit the
    // buyer applied at checkout (checkout_wallet:<id> → escrow_held) must
    // come back to their wallet, exactly like createCheckout's supersede
    // path. Idempotent on 'wallet_refund:<orderId>'; zero-hold orders no-op.
    // Wrapped: a credit failure must never fail the webhook (retryable).
    if (event.type === 'CHARGE_FAILED') {
      await (async () => {
        const { createServiceRoleClient } = await import('@/lib/supabase/service')
        const service = createServiceRoleClient()
        const { data: heldMinorRaw } = await (service.rpc as any)('checkout_wallet_hold_minor', {
          p_order_id: event.orderId,
        })
        const heldMinor = BigInt(heldMinorRaw ?? 0)
        if (heldMinor > 0n) {
          const { data: order } = await service
            .from('orders')
            .select('buyer_id, currency')
            .eq('id', event.orderId)
            .single() as any
          if (order?.buyer_id) {
            const { refundToWallet } = await import('@/lib/wallet/wallet')
            await refundToWallet({
              userId: order.buyer_id,
              amountMinor: heldMinor,
              currency: (order.currency || 'EUR').toUpperCase(),
              orderId: event.orderId,
            })
          }
        }
      })().catch((err) =>
        console.error('[Dispatch] Wallet hold return on failed charge failed (retryable):', err)
      )
    }

    // Comms ride on top of an APPLIED transition only (a replayed/no-op
    // webhook must not re-email anyone). AWAITED — on serverless the function
    // freezes once the webhook response is sent, so an unawaited send would
    // be silently dropped — but errors are swallowed: comms failure never
    // fails the payment.
    const { notifyOrderTransition } = await import('@/lib/payments/notify')
    await notifyOrderTransition(orderEvent, event.orderId, event).catch(() => {})
  }

  return { applied: result.changed, orderId: result.orderId, status: result.status }
}

/**
 * Service-role admin page for "money arrived for a non-payable order" — the
 * one payment failure that must reach a human (webhook context has no user
 * session, so this bypasses the session-bound notification helpers).
 */
async function alertAdminsPaymentForClosedOrder(
  orderId: string,
  providerChargeId: string,
  err: unknown
): Promise<void> {
  console.error(
    `[Dispatch] CRITICAL: confirmed payment for non-payable order ${orderId} (charge ${providerChargeId}):`,
    err
  )
  const { createServiceRoleClient } = await import('@/lib/supabase/service')
  const service = createServiceRoleClient()
  const { data: admins } = (await service
    .from('admin_roles')
    .select('user_id')
    .eq('is_active', true)
    .limit(10)) as any
  const rows = (admins ?? []).map((a: any) => ({
    user_id: a.user_id,
    type: 'payment_review',
    title: 'Payment Needs Review',
    message: `Charge ${providerChargeId} paid a closed order (${orderId.slice(0, 8).toUpperCase()}) — refund or credit manually.`,
    link: `/account/orders/${orderId}`,
    is_read: false,
  }))
  if (rows.length) await service.from('notifications').insert(rows)
}
