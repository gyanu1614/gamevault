/**
 * Wallet seam (Phase 6a) — ledger-backed buyer wallet.
 *
 * After the cutover (20260629_wallet_ledger_cutover*.sql) the wallet is a
 * read-model over the ledger: balance = sum of `user_wallet` entries. Credits
 * (refund-in, cashback) and spends (checkout debit) go through balanced,
 * idempotent, balance-guarded RPCs. No mutable stored balance; the audit's
 * mint-balance hole is closed (old float tables are service-role-write-only).
 *
 * All money is bigint minor units; currency is the ledger currency (EUR base;
 * legacy genesis balances are USD).
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { LedgerAccountKind } from '@/lib/ledger/post-journal'

/** Derived wallet balance (minor units) for a user in a currency. */
export async function getWalletBalance(userId: string, currency: string): Promise<bigint> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('user_wallet_balance', {
    p_user_id: userId,
    p_currency: currency,
  })
  if (error) throw new Error(`user_wallet_balance failed: ${error.message}`)
  return BigInt(data ?? 0)
}

/**
 * creditWallet — add funds to a user's wallet (refund-in, cashback).
 * @param counterparty the source account kind balanced against the credit
 *        (e.g. 'refunds' for an order refund). Idempotent on idempotencyKey.
 */
export async function creditWallet(args: {
  userId: string
  amountMinor: bigint
  currency: string
  counterparty: LedgerAccountKind
  idempotencyKey: string
  eventRef?: string
  orderId?: string
}): Promise<string> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('wallet_credit', {
    p_user_id: args.userId,
    p_amount_minor: args.amountMinor.toString(),
    p_currency: args.currency,
    p_counterparty: args.counterparty,
    p_idempotency_key: args.idempotencyKey,
    p_event_ref: args.eventRef ?? null,
    p_order_id: args.orderId ?? null,
  })
  if (error) throw new Error(`wallet_credit failed: ${error.message}`)
  return data as string
}

/**
 * spendWallet — debit a user's wallet toward a target (e.g. escrow_held at
 * checkout). Refuses on insufficient balance (guarded in the RPC). Idempotent.
 */
export async function spendWallet(args: {
  userId: string
  amountMinor: bigint
  currency: string
  target: LedgerAccountKind
  idempotencyKey: string
  eventRef?: string
  orderId?: string
}): Promise<string> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('wallet_spend', {
    p_user_id: args.userId,
    p_amount_minor: args.amountMinor.toString(),
    p_currency: args.currency,
    p_target: args.target,
    p_idempotency_key: args.idempotencyKey,
    p_event_ref: args.eventRef ?? null,
    p_order_id: args.orderId ?? null,
  })
  if (error) throw new Error(`wallet_spend failed: ${error.message}`)
  return data as string
}

/**
 * Refund an order amount back to the buyer's wallet (refunds → user_wallet).
 * @param keySuffix optional extra idempotency component for refunds that must
 *        not collide with the order's full-refund key — e.g. a PARTIAL dispute
 *        refund uses `partial:<disputeId>` so it posts even if some other
 *        refund already used `wallet_refund:<orderId>` (and vice versa).
 */
export async function refundToWallet(args: {
  userId: string
  amountMinor: bigint
  currency: string
  orderId: string
  keySuffix?: string
}): Promise<string> {
  return creditWallet({
    userId: args.userId,
    amountMinor: args.amountMinor,
    currency: args.currency,
    counterparty: 'refunds',
    idempotencyKey:
      `wallet_refund:${args.orderId}` + (args.keySuffix ? `:${args.keySuffix}` : ''),
    eventRef: 'REFUND_TO_WALLET',
    orderId: args.orderId,
  })
}
