/**
 * POST /api/webhooks/btcpay — BTCPay Server webhook intake.
 *
 * Thin HTTP shell over the provider-agnostic webhook spine (§6), mirroring the
 * CoinGate route. It:
 *   - preserves the RAW body (the BTCPay-Sig HMAC is over raw bytes),
 *   - forwards headers (lowercased) so the adapter can read BTCPay-Sig,
 *   - delegates verify → dedupe → dispatch to handleWebhook,
 *   - returns fast (BTCPay retries on non-2xx and supports manual redelivery
 *     from the store's webhook page).
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
  const limit = await checkRateLimit('webhook', 'provider:btcpay')
  if (limit.limited) return rateLimitResponse(limit)

  // Raw body — do NOT JSON.parse here; the adapter verifies the HMAC over it.
  const rawBody = await req.text()

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v
  })

  const result = await handleWebhook('btcpay', headers, rawBody)
  return NextResponse.json(
    { ok: result.ok, deduped: result.deduped ?? false, processed: result.processed ?? 0, error: result.error },
    { status: result.status }
  )
}
