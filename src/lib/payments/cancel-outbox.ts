/**
 * provider_cancel_outbox drain — round B Part 2 (PAY-004 / PAY-013).
 *
 * The money RPCs write an outbox row in the SAME transaction that closes a
 * live charge (order_cancel_return_wallet with attempt close 'void',
 * payment_attempt_supersede, an orphaned payment_attempt_activate). This
 * worker is the only thing that talks to the provider about it:
 *
 *   claim (FOR UPDATE SKIP LOCKED, backoff stamped) → provider.voidCharge
 *   → mark done | pending (retry later) | failed + ONE admin alert at the cap
 *
 * Run inline right after the RPC (best effort, scoped to that order) and by
 * /api/cron/reconcile-payments every 15 minutes for everything that slipped.
 * A `paid` outcome is recorded, never voided: the confirmation webhook — or
 * the late-payment credit — owns that money.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { getProvider } from '@/lib/payments/registry'

export interface OutboxRow {
  id: string
  attempt_id: string | null
  order_id: string | null
  provider: string
  provider_charge_id: string
  reason: string | null
  status: 'pending' | 'done' | 'failed'
  attempts: number
  next_attempt_at: string
}

export interface OutboxDrainSummary {
  claimed: number
  done: number
  retry: number
  failed: number
  /** Charges the provider reported paid — left to the confirm / credit path. */
  paid: number
}

export async function drainProviderCancelOutbox(opts?: {
  limit?: number
  /** Inline mode: only this order's rows (the one the caller just closed). */
  orderId?: string
}): Promise<OutboxDrainSummary> {
  const svc = createServiceRoleClient()
  const summary: OutboxDrainSummary = { claimed: 0, done: 0, retry: 0, failed: 0, paid: 0 }

  const { data, error } = await (svc.rpc as any)('provider_cancel_outbox_claim', {
    p_limit: opts?.limit ?? 50,
    p_order_id: opts?.orderId ?? null,
  })
  if (error) throw new Error(`provider_cancel_outbox_claim failed: ${error.message}`)
  const rows = (data ?? []) as OutboxRow[]
  summary.claimed = rows.length

  for (const row of rows) {
    let ok = false
    let outcome: string | null = null
    let detail: string | null = null
    try {
      const result = await getProvider(row.provider).voidCharge(row.provider_charge_id)
      ok = true
      outcome = result.outcome
      if (result.outcome === 'paid') summary.paid++
    } catch (e: any) {
      detail = String(e?.message ?? e).slice(0, 500)
      console.error(`[CancelOutbox] void of ${row.provider}/${row.provider_charge_id} failed (attempt ${row.attempts}):`, detail)
    }
    const { data: marked, error: markErr } = await (svc.rpc as any)('provider_cancel_outbox_mark', {
      p_id: row.id,
      p_ok: ok,
      p_outcome: outcome,
      p_error: detail,
    })
    if (markErr) {
      // The claim already stamped the backoff; the next run retries it.
      console.error(`[CancelOutbox] mark of ${row.id} failed:`, markErr.message)
      summary.retry++
      continue
    }
    const status = (marked as any)?.status
    if (status === 'done') summary.done++
    else if (status === 'failed') summary.failed++
    else summary.retry++
  }
  return summary
}

/**
 * Inline drain for the order a caller just closed — best effort, never
 * throws: the cron drain is the guarantee, this is the fast path that keeps
 * a superseded invoice from being payable for the next 15 minutes.
 */
export async function drainCancelOutboxForOrder(orderId: string): Promise<void> {
  try {
    await drainProviderCancelOutbox({ limit: 5, orderId })
  } catch (e) {
    console.error(`[CancelOutbox] inline drain for order ${orderId} failed (the cron retries):`, e)
  }
}
