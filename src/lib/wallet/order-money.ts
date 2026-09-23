/**
 * Order ↔ wallet money moves that used to be two RPCs in app code (DB-015).
 *
 * `safedrop_transition` and `wallet_credit` are each atomic, but composing
 * them from TypeScript left a seam: a failure after the transition stranded
 * the buyer's wallet credit on a terminal order (createCheckout supersede,
 * CHARGE_FAILED) or lost it while the webhook was marked processed
 * (REFUND_COMPLETED). Both moves now run inside ONE database transaction
 * (20260914100000_money_atomicity.sql) and stay idempotent on the keys the
 * old code used (`order:<id>:<event>[:dedupe]`, `wallet_refund:<id>`), so a
 * replay of an earlier partial run converges instead of double-posting.
 *
 * Service-role seam: neither RPC is executable by a user-bound client.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { TransitionResult } from '@/lib/escrow/transition'

export interface OrderMoneyResult extends TransitionResult {
  walletTxnId: string | null
  /** PAY-002: the RPC declined to touch the order (paid/terminal on an
   *  automatic cancel). Nothing changed; admins were alerted (deduped). */
  refused: boolean
}

function toResult(data: any): OrderMoneyResult {
  return {
    orderId: data.order_id,
    status: data.status,
    escrowStatus: data.escrow_status,
    ledgerTxnId: data.ledger_txn_id ?? null,
    changed: data.changed === true,
    walletTxnId: data.wallet_txn_id ?? null,
    refused: data.refused === true,
  }
}

/**
 * Cancel an unpaid order AND mirror its checkout wallet hold
 * (`checkout_wallet:<id>`, escrow_held → user_wallet) back to the buyer, in
 * one transaction. No-op halves are skipped (already cancelled / no hold).
 *
 * PAY-002: the automatic callers (CHARGE_FAILED webhook, expiry sweep,
 * checkout supersede, charge-create failure) may cancel from `pending` ONLY.
 * On a paid/terminal order the RPC changes nothing, inserts one deduped
 * admin `payment_review` alert and answers `{ changed: false, refused: true }`.
 * The buyer's explicit cancel passes `allowPaid: true`, which also cancels a
 * `paid` order and credits the full total to the wallet — inside the RPC.
 */
export async function cancelOrderReturnWallet(
  orderId: string,
  dedupeKey?: string,
  opts?: { allowPaid?: boolean }
): Promise<OrderMoneyResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('order_cancel_return_wallet', {
    p_order_id: orderId,
    p_dedupe_key: dedupeKey ?? null,
    p_allow_paid: opts?.allowPaid === true,
  })
  if (error) throw new Error(`order_cancel_return_wallet failed: ${error.message}`)
  return toResult(data)
}

/**
 * Refund a paid order AND credit the buyer's wallet (refunds → user_wallet)
 * in one transaction. `amountMinor` is what the provider actually refunded;
 * the RPC clamps it to the order total and falls back to the total when
 * absent or zero.
 */
export async function refundOrderToWallet(
  orderId: string,
  dedupeKey?: string,
  amountMinor?: bigint
): Promise<OrderMoneyResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('order_refund_to_wallet', {
    p_order_id: orderId,
    p_dedupe_key: dedupeKey ?? null,
    p_amount_minor: amountMinor !== undefined ? amountMinor.toString() : null,
  })
  if (error) throw new Error(`order_refund_to_wallet failed: ${error.message}`)
  return toResult(data)
}
