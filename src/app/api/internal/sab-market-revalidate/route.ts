import { checkRateLimitByIp, rateLimitResponse } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

function constantTimeEqual(
  left: string,
  right: string,
): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const maxLength = Math.max(
    leftBytes.length,
    rightBytes.length,
  )

  let difference =
    leftBytes.length ^ rightBytes.length

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^
      (rightBytes[index] ?? 0)
  }

  return difference === 0
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

export async function POST(
  request: Request,
): Promise<Response> {
  // Limited before the secret comparison, so this cannot be used to brute
  // force SAB_MARKET_REVALIDATE_SECRET at line speed.
  const limit = await checkRateLimitByIp(
    'internal',
    request.headers,
  )

  if (limit.limited) {
    return rateLimitResponse(limit)
  }

  const expectedSecret =
    process.env.SAB_MARKET_REVALIDATE_SECRET

  if (!expectedSecret) {
    console.error(
      'SAB_MARKET_REVALIDATE_SECRET is not configured',
    )

    return jsonResponse(
      {
        ok: false,
        error: 'Server is not configured',
      },
      500,
    )
  }

  const suppliedSecret =
    request.headers.get('x-revalidate-secret') ?? ''

  if (
    !constantTimeEqual(
      suppliedSecret,
      expectedSecret,
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        error: 'Unauthorized',
      },
      401,
    )
  }

  // T1 (2026-10-04): the SAB crawl's import no longer revalidates pages.
  //
  // This route is called by the sab-market-import edge function right after
  // it refreshes sab_price_display from the crawl's fresh estimates — BEFORE
  // the runner's reprice applies the corrections (cohort anchoring, mutation
  // multipliers). Revalidating here published pre-correction numbers, with an
  // exact-equality diff (every cent wobble), and a second refresh followed
  // anyway. Every scheduled import (G2G and Eldorado) is now followed in the
  // same job by `pnpm reprice --game=sab --publish`, which diffs the
  // corrected display against the last PUBLISHED snapshot with the shared
  // threshold and POSTs only the moved items to /api/internal/values-revalidate
  // — the one contract every game uses.
  //
  // So this is an acknowledgement: it keeps the deployed edge function's
  // ROUTE-010 check green (a 2xx) without a redeploy, records what the import
  // reported, and revalidates nothing. A manual whole-game refresh is
  // POST /api/internal/values-revalidate?game=steal-a-brainrot&full=1.
  let reported: number | null = null
  try {
    const body: unknown = await request.json()
    const raw = (body as { changedSlugs?: unknown } | null)?.changedSlugs
    if (Array.isArray(raw)) reported = raw.length
  } catch {
    // No body / not JSON — nothing to record.
  }

  console.log(
    `[sab-market-revalidate] import reported ${reported ?? 'no'} changed slug(s); ` +
      'deferred to the reprice publish step (values-revalidate).',
  )

  return jsonResponse({
    ok: true,
    mode: 'deferred-to-reprice',
    import_reported_changed: reported,
    revalidated: [],
    revalidated_at: new Date().toISOString(),
  })
}
