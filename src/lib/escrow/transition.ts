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
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
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
 * @param refundMinor   DISPUTE_PARTIAL only — the buyer's partial refund in
 *                      minor units; the RPC splits the held gross into
 *                      refunds + platform take + reduced seller payout
 *                      (20260720_dispute_partial.sql). Only sent when
 *                      provided so pre-migration deploys keep every other
 *                      event working against the 4-arg function.
 *
 * Throws if the order is missing or the transition is illegal. Idempotent: if
 * the order is already at the target status, returns `{ changed: false }` and
 * posts nothing.
 */
export async function transition(
  orderId: string,
  event: OrderEvent,
  dedupeKey?: string,
  releaseMethod?: string,
  refundMinor?: bigint
): Promise<TransitionResult> {
  const supabase = createServiceRoleClient()
  const params: Record<string, unknown> = {
    p_order_id: orderId,
    p_event: event,
    p_dedupe_key: dedupeKey ?? null,
    p_release_method: releaseMethod ?? null,
  }
  if (refundMinor !== undefined) {
    params.p_refund_minor = refundMinor.toString()
  }
  const { data, error } = await (supabase.rpc as any)('safedrop_transition', params)

  if (error) {
    throw new Error(`safedrop_transition(${event}) failed: ${error.message}`)
  }

  const r = data as any

  // Step 7b — on completion the DB trigger update_listing_quantity decrements
  // the listing's stock; the (24 h TTL) category page shows it. Best-effort,
  // never fails the transition; the nightly full revalidate is the backstop.
  if (r.status === 'completed' && r.changed === true) {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('listing_id')
        .eq('id', orderId)
        .maybeSingle()
      const listingId = (order as { listing_id?: string | null } | null)?.listing_id
      if (listingId) {
        await revalidateListingSurfaces(supabase as never, { listingIds: [listingId] })
      }
    } catch (e) {
      console.error('[transition] listing surface revalidation failed (non-fatal):', e)
    }
  }

  // Stamp the payment moment: the delivery SLA timer starts at PAYMENT, not
  // at order creation (buyers can pay long after Buy Now). First stamp wins.
  // PAY-003 moved every production CHARGE_CONFIRMED into order_confirm_payment,
  // which stamps inside the transaction; this remains for direct callers and
  // is FATAL (PAY-020): a swallowed failure silently broke the SLA timer.
  if (event === 'CHARGE_CONFIRMED' && r.changed === true) {
    const { error: stampError } = await (supabase.from('orders').update as any)({ paid_at: new Date().toISOString() })
      .eq('id', orderId)
      .is('paid_at', null)
    if (stampError) {
      throw new Error(`safedrop_transition(CHARGE_CONFIRMED) applied but paid_at stamp failed: ${stampError.message}`)
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
