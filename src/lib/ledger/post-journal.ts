/**
 * Ledger seam — the TypeScript front door to the double-entry ledger.
 *
 * This wraps the `post_journal` Postgres RPC (see
 * supabase/migrations/20260628_ledger.sql). The RPC is the ONLY write path
 * and does all the heavy lifting atomically: balance validation, account
 * resolve-or-create, idempotent insert. This file's job is to give callers a
 * typed, `Money`-aware API and to always use the service-role client (the
 * ledger tables are service-role-only by RLS).
 *
 * Usage:
 *   await postJournal({
 *     idempotencyKey: deterministicRef('coingate', chargeId, 'paid'),
 *     eventRef: 'CHARGE_CONFIRMED',
 *     orderId,
 *     entries: [
 *       debit (account('provider', null, 'provider_float'), amount),
 *       credit(account('platform', null, 'escrow_held'),    amount),
 *     ],
 *   })
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { Money } from '@/lib/money'
import { LedgerImbalanceError } from '@/lib/errors'

// ─── Domain types (mirror the SQL enums) ──────────────────────────

export type LedgerOwnerType = 'platform' | 'seller' | 'buyer' | 'provider' | 'external'

export type LedgerAccountKind =
  | 'buyer_clearing'
  | 'escrow_held'
  | 'seller_available'
  | 'seller_reserve'
  | 'platform_commission'
  | 'provider_float'
  | 'payout_clearing'
  | 'refunds'
  | 'fx_gain_loss'
  | 'rounding'

export type LedgerDirection = 'debit' | 'credit'

/** An account reference (resolved/created server-side by owner+kind+currency). */
export interface AccountRef {
  ownerType: LedgerOwnerType
  /** null for platform/provider singletons; user id for seller/buyer accounts. */
  ownerId: string | null
  kind: LedgerAccountKind
}

/** One side of a journal: a direction + an account + a Money amount. */
export interface JournalEntry {
  account: AccountRef
  direction: LedgerDirection
  amount: Money
}

export interface PostJournalInput {
  /** Stable key; a replay with the same key returns the existing transaction (no double-post). */
  idempotencyKey: string
  entries: JournalEntry[]
  /** Free-text label of the canonical event/action that caused this journal. */
  eventRef?: string
  /** Optional link to orders(id). */
  orderId?: string
}

// ─── Entry builders ───────────────────────────────────────────────

export function account(
  ownerType: LedgerOwnerType,
  ownerId: string | null,
  kind: LedgerAccountKind
): AccountRef {
  return { ownerType, ownerId, kind }
}

export const debit = (acc: AccountRef, amount: Money): JournalEntry => ({
  account: acc,
  direction: 'debit',
  amount,
})

export const credit = (acc: AccountRef, amount: Money): JournalEntry => ({
  account: acc,
  direction: 'credit',
  amount,
})

// ─── post_journal seam ────────────────────────────────────────────

/**
 * postJournal — post a balanced double-entry journal to the ledger.
 *
 * Returns the ledger transaction id. Idempotent: re-posting the same
 * idempotencyKey returns the original transaction id without writing again.
 *
 * Balance is also validated client-side here (fast, typed error) before the
 * round-trip; the RPC re-validates authoritatively (defense in depth — the DB
 * is the real guard, this is a courtesy check + clearer error).
 */
export async function postJournal(input: PostJournalInput): Promise<string> {
  assertBalanced(input.entries)

  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.rpc as any)('post_journal', {
    p_idempotency_key: input.idempotencyKey,
    p_entries: input.entries.map((e) => ({
      owner_type: e.account.ownerType,
      owner_id: e.account.ownerId, // null is fine; SQL coalesces
      kind: e.account.kind,
      direction: e.direction,
      amount_minor: e.amount.amountMinor.toString(), // bigint -> string for JSON safety
      currency: e.amount.currency,
    })),
    p_event_ref: input.eventRef ?? null,
    p_order_id: input.orderId ?? null,
  })

  if (error) {
    throw new LedgerImbalanceError(`post_journal RPC failed: ${error.message}`)
  }
  return data as string
}

/**
 * Client-side balance assertion: per currency, sum(debits) == sum(credits),
 * and there are at least 2 entries. Mirrors the SQL guard.
 */
function assertBalanced(entries: JournalEntry[]): void {
  if (entries.length < 2) {
    throw new LedgerImbalanceError(`a journal needs at least 2 entries (got ${entries.length})`)
  }
  const byCurrency = new Map<string, bigint>() // net = credits - debits, must be 0
  for (const e of entries) {
    if (e.amount.amountMinor <= 0n) {
      throw new LedgerImbalanceError(`every entry amount must be > 0 (got ${e.amount.amountMinor})`)
    }
    const signed = e.direction === 'credit' ? e.amount.amountMinor : -e.amount.amountMinor
    byCurrency.set(e.amount.currency, (byCurrency.get(e.amount.currency) ?? 0n) + signed)
  }
  for (const [currency, net] of byCurrency) {
    if (net !== 0n) {
      throw new LedgerImbalanceError(`imbalance in ${currency}: net (credits - debits) = ${net}`)
    }
  }
}

/** Exported for unit-testing the pure balance check without a DB. */
export const __test = { assertBalanced }
