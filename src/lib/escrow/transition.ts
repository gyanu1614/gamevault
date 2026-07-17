/**
 * SafeDrop transition seam — the TS front door to the atomic transition RPC.
 *
 * Wraps `safedrop_transition` (supabase/migrations/20260628_safedrop_transition.sql),
 * which locks the order, validates the status move, posts the matching ledger
 * journal, and flips status — all in ONE DB transaction, idempotently. This is
 * the only way the app should change an order's money-bearing status.
 *
 * Since the Phase 7 payout cutover this IS the payout rail: release events
 * credit the seller's internal ledger balance (seller_available) and refunds
 * move escrow to the refunds account (the buyer wallet credit rides on top via
 * lib/wallet refundToWallet). Cash only ever leaves the platform through the
 * withdrawal_requests flow.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { OrderEvent } from '@/lib/escrow/state-machine'

export interface TransitionResult {
  orderId: string
  status: string
  escrowStatus?: string
  ledgerTxnId?: string | null
  changed: boolean
}

/**
 * transition — apply a SafeDrop order event atomically.
 *
 * @param orderId       the order to transition
 * @param event         a canonical OrderEvent (CHARGE_CONFIRMED, AUTO_RELEASED, …)
 * @param dedupeKey     optional extra idempotency component (e.g. a provider
 *                      event id) so the same provider webhook can't double-apply.
 * @param releaseMethod release events only — written to orders.release_method
 *                      ('buyer_confirmed' | 'auto' | 'dispute_resolved').
 *
 * Throws if the order is missing or the transition is illegal. Idempotent: if
 * the order is already at the target status, returns `{ changed: false }` and
 * posts nothing.
 */
export async function transition(
  orderId: string,
  event: OrderEvent,
  dedupeKey?: string,
  releaseMethod?: string
): Promise<TransitionResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('safedrop_transition', {
    p_order_id: orderId,
    p_event: event,
    p_dedupe_key: dedupeKey ?? null,
    p_release_method: releaseMethod ?? null,
  })

  if (error) {
    throw new Error(`safedrop_transition(${event}) failed: ${error.message}`)
  }

  const r = data as any

  // Stamp the payment moment: the delivery SLA timer starts at PAYMENT, not
  // at order creation (buyers can pay long after Buy Now). First stamp wins;
  // best-effort — never fails the transition.
  if (event === 'CHARGE_CONFIRMED' && r.changed === true) {
    try {
      await (supabase.from('orders').update as any)({ paid_at: new Date().toISOString() })
        .eq('id', orderId)
        .is('paid_at', null)
    } catch (e) {
      console.error('[transition] paid_at stamp failed (non-fatal):', e)
    }
  }

  return {
    orderId: r.order_id,
    status: r.status,
    escrowStatus: r.escrow_status,
    ledgerTxnId: r.ledger_txn_id ?? null,
    changed: r.changed === true,
  }
}
