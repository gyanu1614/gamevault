import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Hidden Sentry verification endpoint.
 *
 * Throws on purpose so a real error travels the whole path — thrown in a route
 * handler, picked up by instrumentation.ts's onRequestError, tagged with route
 * segment + deploy id, delivered to Sentry. Use it once after a deploy to
 * confirm the wiring, e.g.
 *
 *   curl -X POST https://<host>/api/internal/sentry-test \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Gated on CRON_SECRET so it is not a public 500 generator. Unauthenticated
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

  // Captured explicitly as well as thrown: the throw alone relies on
  // onRequestError, and capturing here means the check still proves delivery
  // if that hook ever regresses. flush() matters on serverless — the lambda
  // can freeze before the background send completes.
  Sentry.captureException(error, {
    tags: { boundary: 'api/internal/sentry-test', deliberate: 'true' },
  })
  await Sentry.flush(2000)

  throw error
}

export async function GET(request: Request): Promise<Response> {
  return handle(request)
}

export async function POST(request: Request): Promise<Response> {
  return handle(request)
}
