/**
 * POST /api/webhooks/coingate — CoinGate callback intake.
 *
 * Thin HTTP shell over the provider-agnostic webhook spine (§6). It:
 *   - preserves the RAW body (CoinGate signs/forms over raw bytes),
 *   - lifts the per-order ?token= into the `x-cb-token` header the adapter
 *     verifies (verification step 2),
 *   - forwards the source IP so the adapter's allowlist check (step 1) works,
 *   - delegates everything else (verify → dedupe → dispatch) to handleWebhook,
 *   - returns fast (CoinGate retries on non-2xx).
 *
 * Runs on the Node runtime (needs node:crypto + the service-role client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleWebhook } from '@/lib/payments/webhook-router'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Raw body — do NOT JSON.parse here; the adapter parses + verifies it.
  const rawBody = await req.text()

  // Per-order callback token from the URL (?token=) → header the adapter reads.
  const token = req.nextUrl.searchParams.get('token') ?? ''

  // Forward headers the spine/adapter need (lowercased).
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v
  })
  headers['x-cb-token'] = token
  // NextRequest exposes the client IP via these forwarded headers in prod;
  // ensure x-forwarded-for is present for the adapter's IP allowlist.
  if (!headers['x-forwarded-for'] && (req as any).ip) {
    headers['x-forwarded-for'] = (req as any).ip
  }

  const result = await handleWebhook('coingate', headers, rawBody)
  return NextResponse.json(
    { ok: result.ok, deduped: result.deduped ?? false, processed: result.processed ?? 0, error: result.error },
    { status: result.status }
  )
}
