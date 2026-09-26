import { revalidatePath, revalidateTag } from 'next/cache'
import {
  valueGamePriceTag,
  valueItemPriceTag,
  valuesTag,
} from '@/lib/values/revalidation'
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

  const GAME = 'steal-a-brainrot'

  // The lists always move when anything moves: they rank every item by price.
  const paths = [`/${GAME}/values`, `/${GAME}/calculator`]

  for (const path of paths) {
    revalidatePath(path)
  }

  // Which items actually changed this crawl. The publish step diffs the
  // freshly materialised prices against the previous snapshot
  // (sab_refresh_price_display_changed, migration 20260922172054) and sends
  // the slugs here.
  //
  // Absent or malformed body → fall back to the whole-game tag, which is the
  // pre-2026-09-22 behaviour. That keeps an older deployment of the edge
  // function (or a manual curl) correct, just expensive: the game tag marks
  // every one of the ~500 item pages stale, which was ~80% of the monthly ISR
  // budget (build audit 2026-09-22, §4).
  let changedSlugs: string[] | null = null
  try {
    const body: unknown = await request.json()
    const raw = (body as { changedSlugs?: unknown } | null)?.changedSlugs
    if (Array.isArray(raw)) {
      changedSlugs = raw.filter(
        (slug): slug is string => typeof slug === 'string' && slug.length > 0,
      )
    }
  } catch {
    // No body / not JSON — fall through to the whole-game tag.
  }

  const revalidated: string[] = [...paths]

  if (changedSlugs === null) {
    revalidateTag(valuesTag(GAME))
    revalidated.push(valuesTag(GAME))
  } else {
    // Item pages whose price moved. An empty list is a legitimate answer —
    // a crawl where nothing changed revalidates no item page at all.
    for (const slug of changedSlugs) {
      const tag = valueItemPriceTag(GAME, slug)
      revalidateTag(tag)
      revalidated.push(tag)
    }
    if (changedSlugs.length > 0) {
      // The price LISTS (directory, calculator) read every item's price.
      revalidateTag(valueGamePriceTag(GAME))
      revalidated.push(valueGamePriceTag(GAME))
    }
  }

  return jsonResponse({
    ok: true,
    mode: changedSlugs === null ? 'whole-game-fallback' : 'changed-items',
    changed_count: changedSlugs?.length ?? null,
    revalidated,
    revalidated_at: new Date().toISOString(),
  })
}
