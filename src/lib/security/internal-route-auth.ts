/**
 * Auth for signed internal routes (/api/internal/*), lifted from
 * sab-market-revalidate so every new internal route gets the same shape:
 *
 *   1. IP rate limit FIRST (bucket `internal`, 30/min) — the secret cannot be
 *      brute-forced at line speed;
 *   2. 500 when the server has no secret configured — a missing env var must
 *      never turn into an open endpoint;
 *   3. constant-time comparison of the header value against the secret.
 */
import { checkRateLimitByIp, rateLimitResponse } from '@/lib/security/rate-limit'

const encoder = new TextEncoder()

export function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export function internalJson(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

export interface InternalAuthOptions {
  /** Header carrying the secret, e.g. `x-trend-radar-secret`. */
  header: string
  /** The configured secret (process.env.X). Undefined → 500. */
  secret: string | undefined
}

export type InternalAuthResult = { ok: true; response?: undefined } | { ok: false; response: Response }

export async function authorizeInternalRequest(request: Request, opts: InternalAuthOptions): Promise<InternalAuthResult> {
  const limit = await checkRateLimitByIp('internal', request.headers)
  if (limit.limited) return { ok: false, response: rateLimitResponse(limit) }

  if (!opts.secret) {
    console.error(`${opts.header}: secret is not configured`)
    return { ok: false, response: internalJson({ ok: false, error: 'Server is not configured' }, 500) }
  }

  const supplied = request.headers.get(opts.header) ?? ''
  if (!constantTimeEqual(supplied, opts.secret)) {
    return { ok: false, response: internalJson({ ok: false, error: 'Unauthorized' }, 401) }
  }
  return { ok: true }
}
