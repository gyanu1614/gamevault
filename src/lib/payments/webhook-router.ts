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
import type { CanonicalEvent } from '@/lib/payments/types'
import { serializeCanonicalEvents } from '@/lib/payments/webhook-events-serde'

/**
 * Dispatch a provider event's canonical events, in order. The ONE handler
 * for an event: the webhook route runs it right after the claim, the
 * reconciler runs it again for a row that never reached the mark (round B
 * Part 4, PAY-010). Every transition it drives is idempotent.
 */
export async function dispatchStoredEvents(
  providerName: string,
  providerEventId: string,
  events: CanonicalEvent[]
): Promise<number> {
  let processed = 0
  for (const event of events) {
    await dispatch(event, providerEventId, providerName)
    processed++
  }
  return processed
}

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
  //    The verified events ride on the claim (PAY-010): a row that never
  //    reaches the mark below is re-run by the reconciler from these.
  const { data: claimed, error: claimErr } = await (supabase.rpc as any)('webhook_event_claim', {
    p_provider: providerName,
    p_provider_event_id: parsed.providerEventId,
    p_payload_hash: payloadHash,
    p_events: serializeCanonicalEvents(parsed.events),
  })
  if (claimErr) {
    return { ok: false, status: 500, error: `claim failed: ${claimErr.message}` }
  }
  if (claimed !== true) {
    // Already seen — idempotent success.
    return { ok: true, status: 200, deduped: true, processed: 0 }
  }

  // 4. Dispatch each canonical event to its SafeDrop transition.
  let processed = 0
  try {
    processed = await dispatchStoredEvents(providerName, parsed.providerEventId, parsed.events)
  } catch (e: any) {
    // Mark failed and return 500 so the provider retries; webhook_event_claim
    // re-claims a 'failed' row (DB-015d), so that retry re-runs dispatch — every
    // transition it drives is idempotent. Round B: a row the mark below never
    // reaches (crash here) is re-run by the reconciler after 15 min.
    await (supabase.rpc as any)('webhook_event_mark', {
      p_provider: providerName,
      p_provider_event_id: parsed.providerEventId,
      p_status: 'failed',
      p_result: { error: String(e?.message ?? e) },
    })
    return { ok: false, status: 500, error: `dispatch failed: ${e?.message ?? e}` }
  }
  // 5. Mark processed. PAY-010: a failed mark used to be ignored and the row
  //    stayed `received` forever while every provider retry deduped to 200.
  //    Answer 500 instead: the provider retries, the claim sees the row is
  //    still `received` and dedupes, and the reconciler re-runs it from the
  //    stored events — the transitions are idempotent either way.
  const { error: markErr } = await (supabase.rpc as any)('webhook_event_mark', {
    p_provider: providerName,
    p_provider_event_id: parsed.providerEventId,
    p_status: 'processed',
    p_result: { processed },
  })
  if (markErr) {
    return { ok: false, status: 500, processed, error: `mark failed: ${markErr.message}` }
  }
  return { ok: true, status: 200, processed }
}
