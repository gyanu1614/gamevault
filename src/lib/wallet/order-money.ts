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
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import type { TransitionResult } from '@/lib/escrow/transition'

export interface OrderMoneyResult extends TransitionResult {
  walletTxnId: string | null
  /** PAY-002: the RPC declined to touch the order (paid/terminal on an
   *  automatic cancel). Nothing changed; admins were alerted (deduped). */
  refused: boolean
  /** Round B: why nothing changed when it was neither a replay nor a
   *  refusal — `stale_attempt` = the charge named is no longer the order's
   *  open attempt (a retry superseded it). */
  reason?: string | null
}

/** Round B: the provider charge an event names — bound to its attempt in the RPC. */
export interface ChargeRef {
  provider: string
  providerChargeId: string
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
    reason: data.reason ?? null,
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
 *
 * Round B: `charge` binds the event to the order's payment attempt (a charge
 * bound elsewhere is refused; one no longer open is a no-op, reason
 * `stale_attempt`). `closeAttemptAs` says how the open attempt closes:
 * 'failed' = the provider reported it dead (default when a charge is named),
 * 'void' = we closed it (sweep, supersede, buyer cancel) — the live charge
 * is then queued in provider_cancel_outbox inside the same transaction.
 */
export async function cancelOrderReturnWallet(
  orderId: string,
  dedupeKey?: string,
  opts?: {
    allowPaid?: boolean
    charge?: ChargeRef
    closeAttemptAs?: 'failed' | 'void'
    /** The caller already asked the provider (the sweep voids first): its
     *  answer is recorded on the outbox row, born done — the drain skips it. */
    providerVoidOutcome?: 'voided' | 'already_closed' | 'unsupported'
  }
): Promise<OrderMoneyResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('order_cancel_return_wallet', {
    p_order_id: orderId,
    p_dedupe_key: dedupeKey ?? null,
    p_allow_paid: opts?.allowPaid === true,
    p_provider: opts?.charge?.provider ?? null,
    p_provider_charge_id: opts?.charge?.providerChargeId ?? null,
    p_attempt_close: opts?.closeAttemptAs ?? null,
    p_provider_void_outcome: opts?.providerVoidOutcome ?? null,
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

export type ConfirmOutcome = 'paid' | 'oversold_refunded' | 'noop' | 'late_credited'

export interface ConfirmPaymentResult extends OrderMoneyResult {
  outcome: ConfirmOutcome
  /** oversold_refunded only: why the stock could not be claimed. */
  reason?: string | null
  /** late_credited / overpayment: minor units credited to the buyer wallet
   *  by this call (0 on a replay — the credit is idempotent per event). */
  creditedMinor: bigint
}

/** Round B Part 3: the amounts a confirmation carries. */
export interface ConfirmAmounts {
  /** What the charge asked for (the invoice / transaction amount). */
  amountMinor: bigint
  currency: string
  /** What was actually paid, when the provider says; above amountMinor = overpayment. */
  paidMinor?: bigint
}

/**
 * PAY-003 — confirm a payment: pending → paid, paid_at stamped, and the
 * listing's stock CLAIMED (row-locked `quantity >= q`) in ONE transaction.
 * When the stock is already gone the same transaction routes the money to
 * the existing refund path (paid → refunded, full total to the buyer's
 * wallet) and answers `outcome: 'oversold_refunded'` — the buyer is never
 * left paid-and-undeliverable. `noop` = already paid (replay).
 *
 * The only way an order becomes `paid`: the webhook (dispatch), the fully
 * wallet-paid checkout, and the wallet-covered retry all call this.
 *
 * Round B: `charge` names the provider charge that paid. The RPC refuses a
 * charge bound to another order and closes the charge's attempt as paid.
 * `amounts` (Part 3) lets the RPC route money the order no longer wants —
 * a closed attempt, a closed or already-paid order — to the buyer's wallet
 * (outcome `late_credited`, the order untouched) and credit an overpayment's
 * excess after a normal confirmation.
 */
export async function confirmOrderPayment(
  orderId: string,
  dedupeKey?: string,
  charge?: ChargeRef,
  amounts?: ConfirmAmounts
): Promise<ConfirmPaymentResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('order_confirm_payment', {
    p_order_id: orderId,
    p_dedupe_key: dedupeKey ?? null,
    p_provider: charge?.provider ?? null,
    p_provider_charge_id: charge?.providerChargeId ?? null,
    p_amount_minor: amounts ? amounts.amountMinor.toString() : null,
    p_paid_minor: amounts?.paidMinor !== undefined ? amounts.paidMinor.toString() : null,
    p_currency: amounts?.currency ?? null,
  })
  if (error) throw new Error(`order_confirm_payment failed: ${error.message}`)
  const outcome = (data.outcome as ConfirmOutcome) ?? 'noop'
  const result: ConfirmPaymentResult = {
    ...toResult(data),
    outcome,
    reason: data.reason ?? null,
    creditedMinor: BigInt(
      outcome === 'late_credited' ? (data.credited_minor ?? 0) : outcome === 'paid' ? (data.overpaid_minor ?? 0) : 0
    ),
  }
  // Stock moved (claimed, or the listing re-opened): the prerendered
  // category page shows the quantity. Best-effort, never fails the payment.
  if (result.changed) await revalidateOrderListing(supabase, orderId)
  return result
}

async function revalidateOrderListing(supabase: ReturnType<typeof createServiceRoleClient>, orderId: string) {
  try {
    const { data: order } = await supabase.from('orders').select('listing_id').eq('id', orderId).maybeSingle()
    const listingId = (order as { listing_id?: string | null } | null)?.listing_id
    if (listingId) await revalidateListingSurfaces(supabase as never, { listingIds: [listingId] })
  } catch (e) {
    console.error('[order-money] listing surface revalidation failed (non-fatal):', e)
  }
}
