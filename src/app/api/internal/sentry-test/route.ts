import * as Sentry from '@sentry/nextjs'
import { checkRateLimitByIp, rateLimitResponse } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Hidden Sentry verification endpoint.
 *
 * Captures a real error and reports whether it was delivered — so a deploy can
 * be checked without reading logs. Returns 200 with the event id rather than
 * throwing: a 500 tells you nothing about whether Sentry received anything.
 * Use it once after a deploy, e.g.
 *
 *   curl -X POST https://<host>/api/internal/sentry-test \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * A `captured: true` with `flushed: true` and a non-null eventId means the
 * event left the process. `sdkInitialized: false` means the instrumentation
 * hook never loaded and nothing is being reported anywhere.
 *
 * Gated on CRON_SECRET so it is not a public error generator. Unauthenticated
 * callers get a 404, not a 401 — an unauthorized caller should not be able to
 * confirm the route exists at all.
 */

const CRON_SECRET = process.env.CRON_SECRET

const encoder = new TextEncoder()

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const maxLength = Math.max(leftBytes.length, rightBytes.length)

  let difference = leftBytes.length ^ rightBytes.length

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }

  return difference === 0
}

function notFound(): Response {
  return Response.json(
    { error: 'Not found' },
    { status: 404, headers: { 'cache-control': 'no-store' } },
  )
}

async function handle(request: Request): Promise<Response> {
  // A missing secret must never fall open to a known default.
  if (!CRON_SECRET) return notFound()

  const authHeader = request.headers.get('authorization') ?? ''
  if (!constantTimeEqual(authHeader, `Bearer ${CRON_SECRET}`)) {
    return notFound()
  }

  const error = new Error(
    'Sentry verification error from /api/internal/sentry-test (thrown deliberately)',
  )

  // Capture explicitly rather than relying on the throw. A thrown error goes
  // through onRequestError, which reports it too — but then the only signal
  // the caller gets is a bare 500, indistinguishable from the route being
  // broken for some unrelated reason. That is precisely what the first deploy
  // looked like. Returning the event id turns "did it work?" into something
  // the response answers directly: paste the id into Sentry's search.
  const eventId = Sentry.captureException(error, {
    tags: { boundary: 'api/internal/sentry-test', deliberate: 'true' },
  })

  // The event is queued, not sent, until this resolves. On serverless the
  // isolate can freeze the instant the response goes out, discarding anything
  // still in flight — so the flush must be awaited BEFORE returning. Bounded
  // at 2s so an unreachable ingest endpoint costs a lost event, not a hung
  // request. `false` means the queue did not drain in time.
  const flushed = await Sentry.flush(2000)

  return Response.json(
    {
      captured: true,
      eventId,
      flushed,
      dsnConfigured: Boolean(
        process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
      ),
      // Confirms Sentry.init() actually ran. Without the instrumentation hook
      // loading, this is false and every capture is a silent no-op.
      sdkInitialized: Boolean(Sentry.getClient()),
    },
    { status: 200, headers: { 'cache-control': 'no-store' } },
  )
}

export async function GET(request: Request): Promise<Response> {
  return handle(request)
}

export async function POST(request: Request): Promise<Response> {
  // Limited before the CRON_SECRET check: this route captures a real Sentry
  // event per call, so an unauthenticated flood would burn the Sentry quota
  // even while every request is being rejected.
  const limit = await checkRateLimitByIp('internal', request.headers)
  if (limit.limited) return rateLimitResponse(limit)

  return handle(request)
}
