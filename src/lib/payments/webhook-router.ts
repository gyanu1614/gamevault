/**
 * Webhook spine (spec §6) — the single, provider-agnostic intake for all
 * inbound payment webhooks.
 *
 * Flow:
 *   1. Resolve the provider adapter.
 *   2. adapter.parseWebhook(headers, rawBody) — verifies signature/source and
 *      maps to canonical events (throws on a forged/invalid request → 400).
 *   3. DEDUPE: webhook_event_claim() inserts-or-skips on the unique key. If the
 *      event was already seen → no-op, return 200 immediately (idempotent).
 *   4. Dispatch each canonical event to its SafeDrop transition (atomic +
 *      idempotent in the DB).
 *   5. Mark the event processed/failed; return fast.
 *
 * This is the ONE place inbound money events enter the system, always under the
 * service-role client, with one trust model — replacing the two divergent
 * Stripe webhook routes (the audit's double-writer hazard).
 */

import { createHash } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getProvider } from '@/lib/payments/registry'
import { dispatch } from '@/lib/payments/dispatch'

export interface WebhookResult {
  ok: boolean
  status: number // HTTP status the route should return
  deduped?: boolean // true if this was a duplicate (already-seen) event
  processed?: number // count of canonical events dispatched
  error?: string
}

/**
 * handleWebhook — run the spine for one inbound request.
 *
 * @param providerName  provider key (from the route param / order)
 * @param headers       request headers (lowercased keys recommended)
 * @param rawBody       the RAW request body (signatures are over raw bytes)
 */
export async function handleWebhook(
  providerName: string,
  headers: Record<string, string>,
  rawBody: Buffer | string
): Promise<WebhookResult> {
  let provider
  try {
    provider = getProvider(providerName)
  } catch (e: any) {
    return { ok: false, status: 404, error: e.message }
  }

  // 1+2. Verify + parse. A throw here means forged/invalid → reject before any
  // side effect. Never trust the body's status; the adapter re-fetches.
  let parsed
  try {
    parsed = await provider.parseWebhook(headers, rawBody)
  } catch (e: any) {
    return { ok: false, status: 400, error: `verification failed: ${e.message}` }
  }

  const supabase = createServiceRoleClient()
  const payloadHash = createHash('sha256')
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex')

  // 3. Dedupe-claim. FALSE means we've already processed this event → no-op.
  const { data: claimed, error: claimErr } = await (supabase.rpc as any)('webhook_event_claim', {
    p_provider: providerName,
    p_provider_event_id: parsed.providerEventId,
    p_payload_hash: payloadHash,
  })
  if (claimErr) {
    return { ok: false, status: 500, error: `claim failed: ${claimErr.message}` }
  }
  if (claimed !== true) {
    // Already seen — idempotent success.
    return { ok: true, status: 200, deduped: true, processed: 0 }
  }

  // 4. Dispatch each canonical event to its SafeDrop transition.
  try {
    let processed = 0
    for (const event of parsed.events) {
      await dispatch(event, parsed.providerEventId)
      processed++
    }
    // 5. Mark processed.
    await (supabase.rpc as any)('webhook_event_mark', {
      p_provider: providerName,
      p_provider_event_id: parsed.providerEventId,
      p_status: 'processed',
      p_result: { processed },
    })
    return { ok: true, status: 200, processed }
  } catch (e: any) {
    // Mark failed so the replay worker (Phase 6) can retry; return 500 so the
    // provider retries too.
    await (supabase.rpc as any)('webhook_event_mark', {
      p_provider: providerName,
      p_provider_event_id: parsed.providerEventId,
      p_status: 'failed',
      p_result: { error: String(e?.message ?? e) },
    })
    return { ok: false, status: 500, error: `dispatch failed: ${e?.message ?? e}` }
  }
}
