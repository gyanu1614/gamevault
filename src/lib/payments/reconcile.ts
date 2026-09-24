/**
 * Stuck webhook event reconciler — round B Part 4 (PAY-010).
 *
 * A webhook that crashed or timed out between webhook_event_claim and
 * webhook_event_mark leaves its row `received`. Every provider retry then
 * dedupes to 200 and the payment is never applied — nobody is told. The
 * unprocessed index existed; nothing read it. This does:
 *
 *   1. rows `received` for > 15 min with NO stored events (claimed before
 *      round B) are flipped to `failed`: the provider's own retry re-claims
 *      and re-runs them (DB-015d) — they cannot be replayed from here;
 *   2. the rest are claimed (skip-locked, attempts bumped) and re-run through
 *      the SAME dispatch the webhook route uses, from the events stored at
 *      claim time; success marks them processed;
 *   3. a row that keeps failing is capped (5 attempts): failed + ONE admin
 *      alert — a poison row is loud, never a silent black hole.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { dispatchStoredEvents } from '@/lib/payments/webhook-router'
import { deserializeCanonicalEvents } from '@/lib/payments/webhook-events-serde'

export const STUCK_AFTER_MINUTES = 15
export const RECONCILE_MAX_ATTEMPTS = 5

export interface StuckReconcileSummary {
  /** Rows with no stored events flipped to failed for the provider retry. */
  unreplayable: number
  claimed: number
  processed: number
  retry: number
  poisoned: number
}

export async function reconcileStuckWebhookEvents(opts?: {
  olderThanMinutes?: number
  limit?: number
  maxAttempts?: number
}): Promise<StuckReconcileSummary> {
  const svc = createServiceRoleClient()
  const older = opts?.olderThanMinutes ?? STUCK_AFTER_MINUTES
  const maxAttempts = opts?.maxAttempts ?? RECONCILE_MAX_ATTEMPTS
  const summary: StuckReconcileSummary = { unreplayable: 0, claimed: 0, processed: 0, retry: 0, poisoned: 0 }

  const { data: flipped, error: flipErr } = await (svc.rpc as any)('webhook_events_flip_unreplayable', {
    p_older_than_minutes: older,
  })
  if (flipErr) throw new Error(`webhook_events_flip_unreplayable failed: ${flipErr.message}`)
  summary.unreplayable = Number(flipped ?? 0)

  const { data, error } = await (svc.rpc as any)('webhook_events_stuck_claim', {
    p_older_than_minutes: older,
    p_limit: opts?.limit ?? 50,
  })
  if (error) throw new Error(`webhook_events_stuck_claim failed: ${error.message}`)
  const rows = (data ?? []) as Array<{ id: string; provider: string; provider_event_id: string; events: unknown; reconcile_attempts: number }>
  summary.claimed = rows.length

  for (const row of rows) {
    let ok = false
    let detail: string | null = null
    try {
      const events = deserializeCanonicalEvents(row.events)
      await dispatchStoredEvents(row.provider, row.provider_event_id, events)
      ok = true
    } catch (e: any) {
      detail = String(e?.message ?? e).slice(0, 500)
      console.error(`[Reconcile] re-run of ${row.provider}/${row.provider_event_id} failed (attempt ${row.reconcile_attempts}):`, detail)
    }
    const { data: marked, error: markErr } = await (svc.rpc as any)('webhook_event_reconcile_mark', {
      p_id: row.id,
      p_ok: ok,
      p_error: detail,
      p_max_attempts: maxAttempts,
    })
    if (markErr) {
      console.error(`[Reconcile] mark of ${row.id} failed:`, markErr.message)
      summary.retry++
      continue
    }
    const status = (marked as any)?.status
    if (status === 'processed') summary.processed++
    else if (status === 'failed') summary.poisoned++
    else summary.retry++
  }
  return summary
}
