/**
 * POST /api/webhooks/stripe — Stripe event intake.
 *
 * Thin HTTP shell over the provider-agnostic webhook spine (§6), mirroring the
 * Payssion route. It:
 *   - reads the RAW bytes (Stripe-Signature is an HMAC over the exact body),
 *   - delegates verify → re-fetch → dedupe → dispatch to handleWebhook,
 *   - answers 2xx fast; a dispatch failure answers 500 so Stripe retries
 *     (up to 3 days) — webhook_event_claim makes every replay harmless.
 *
 * Events the endpoint subscribes to (dashboard / `stripe listen`):
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed, checkout.session.expired,
 *   charge.refunded, charge.refund.updated, charge.dispute.created,
 *   charge.dispute.closed
 *   (refunds and disputes → card_cases, lib/payments/card-cases.ts)
 *
 * Runs on the Node runtime (needs node:crypto + the service-role client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/payments/webhook-router'
import { checkRateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Per-provider budget, charged before signature verification (see the
  // Payssion route).
  const limit = await checkRateLimit('webhook', 'provider:stripe')
  if (limit.limited) return rateLimitResponse(limit)

  const rawBody = Buffer.from(await req.arrayBuffer())

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v
  })

  const result = await handleWebhook('stripe', headers, rawBody)
  // PAY-020: the failure detail is for OUR logs; the caller only learns the
  // request was rejected.
  if (!result.ok) console.error('[webhook:stripe] %d %s', result.status, result.error)
  return NextResponse.json(
    { ok: result.ok, deduped: result.deduped ?? false, processed: result.processed ?? 0, ...(result.ok ? {} : { error: 'rejected' }) },
    { status: result.status }
  )
}
