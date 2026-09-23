/**
 * POST /api/webhooks/payssion — Payssion notify-URL intake.
 *
 * Thin HTTP shell over the provider-agnostic webhook spine (§6), mirroring the
 * BTCPay/CoinGate routes. It:
 *   - preserves the RAW body (the notify_sig MD5 is over the exact field
 *     strings; the adapter parses form-encoded or JSON),
 *   - delegates verify → dedupe → dispatch to handleWebhook,
 *   - returns 2xx fast (Payssion retries up to 7 times over 48h on non-2xx —
 *     the dedupe claim makes replays harmless).
 *
 * Runs on the Node runtime (needs node:crypto + the service-role client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/payments/webhook-router'
import { checkRateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Per-provider budget (not per-IP): a provider's callbacks arrive from many
  // IPs, and one noisy provider must not throttle another's. Charged before
  // signature verification so a flood of forged callbacks cannot pin the CPU
  // on HMAC work.
  const limit = await checkRateLimit('webhook', 'provider:payssion')
  if (limit.limited) return rateLimitResponse(limit)

  const rawBody = await req.text()

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v
  })

  const result = await handleWebhook('payssion', headers, rawBody)
  // PAY-020: the failure detail (which verification stage rejected the
  // request, what dispatch threw) is for OUR logs; an unauthenticated caller
  // only learns that the request was rejected.
  if (!result.ok) console.error('[webhook:payssion] %d %s', result.status, result.error)
  return NextResponse.json(
    { ok: result.ok, deduped: result.deduped ?? false, processed: result.processed ?? 0, ...(result.ok ? {} : { error: 'rejected' }) },
    { status: result.status }
  )
}
