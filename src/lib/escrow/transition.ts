/**
 * SafeDrop transition seam — the TS front door to the atomic transition RPC.
 *
 * Wraps `safedrop_transition` (supabase/migrations/20260628_safedrop_transition.sql),
 * which locks the order, validates the status move, posts the matching ledger
 * journal, and flips status — all in ONE DB transaction, idempotently. This is
 * the only way the app should change an order's money-bearing status.
 *
 * Ledger-only: it does NOT trigger an external payout (Stripe/CoinGate); that's
 * the provider seam (Phase 3+). Wiring this into the live order actions also
 * happens in Phase 3, once the provider rail exists.
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
 * @param orderId    the order to transition
 * @param event      a canonical OrderEvent (CHARGE_CONFIRMED, AUTO_RELEASED, …)
 * @param dedupeKey  optional extra idempotency component (e.g. a provider event
 *                   id) so the same provider webhook can't double-apply.
 *
 * Throws if the order is missing or the transition is illegal. Idempotent: if
 * the order is already at the target status, returns `{ changed: false }` and
 * posts nothing.
 */
export async function transition(
  orderId: string,
  event: OrderEvent,
  dedupeKey?: string
): Promise<TransitionResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('safedrop_transition', {
    p_order_id: orderId,
    p_event: event,
    p_dedupe_key: dedupeKey ?? null,
  })

  if (error) {
    throw new Error(`safedrop_transition(${event}) failed: ${error.message}`)
  }

  const r = data as any
  return {
    orderId: r.order_id,
    status: r.status,
    escrowStatus: r.escrow_status,
    ledgerTxnId: r.ledger_txn_id ?? null,
    changed: r.changed === true,
  }
}
