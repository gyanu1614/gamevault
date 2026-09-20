import { revalidatePath, revalidateTag } from 'next/cache'
import {
  authorizeInternalRequest,
  internalJson,
} from '@/lib/security/internal-route-auth'
import { CONTENT_HUB_GAME_SLUGS, hasHubPage } from '@/lib/content/theme'
import { valuesTag } from '@/lib/values/revalidation'

/**
 * Revalidate a game's price pages after a crawl republishes prices.
 *
 * Uses the shared internal-route auth from Step 2 (rate limit → configured-
 * secret check → constant-time compare) rather than re-implementing it, which
 * is what sab-market-revalidate did before that helper existed.
 *
 * Scoped by `?game=<slug>`: the hub-level pages by path, the item pages by
 * the `values:<game>` TAG every item render anchors to (lib/values/
 * revalidation). Not by path: `'/<game>/values/[itemSlug]'` matches nothing
 * (a page is tagged with its route pattern and its concrete pathname — a
 * silent no-op, which this route shipped with), and the route-pattern form
 * `/[gameSlug]/values/[itemSlug]` would drop every game's pages on every
 * crawl. So a Steal An Egg run never invalidates SAB's cache.
 *
 * Step 7a: this call is the primary refresh for the value pages (their
 * time-based `revalidate` is a 24 h safety net), so it also covers the
 * calculator and price-index where the game publishes them. The runner-side
 * pricing job (reprice.mjs) POSTs here after each run:
 *
 *   POST /api/internal/values-revalidate?game=<slug>
 *   x-values-revalidate-secret: $VALUES_REVALIDATE_SECRET
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeInternalRequest(request, {
    header: 'x-values-revalidate-secret',
    secret: process.env.VALUES_REVALIDATE_SECRET,
  })
  if (!auth.ok) return auth.response

  const gameSlug = new URL(request.url).searchParams.get('game')?.trim() ?? ''

  if (!gameSlug || !CONTENT_HUB_GAME_SLUGS.includes(gameSlug)) {
    return internalJson(
      { ok: false, error: 'Unknown or missing ?game=<slug>' },
      400,
    )
  }

  const revalidated: string[] = []

  if (hasHubPage(gameSlug, 'values')) {
    revalidatePath(`/${gameSlug}/values`)
    revalidated.push(`/${gameSlug}/values`)
    // Every item page of THIS game, by tag (see header).
    revalidateTag(valuesTag(gameSlug))
    revalidated.push(valuesTag(gameSlug))
  }
  if (hasHubPage(gameSlug, 'methodology')) {
    // The methodology page quotes live counts, so it goes stale with the rest.
    revalidatePath(`/${gameSlug}/values/methodology`)
    revalidated.push(`/${gameSlug}/values/methodology`)
  }
  if (hasHubPage(gameSlug, 'calculator')) {
    // Cash tab + value table read the same prices.
    revalidatePath(`/${gameSlug}/calculator`)
    revalidated.push(`/${gameSlug}/calculator`)
  }
  if (hasHubPage(gameSlug, 'priceIndex')) {
    revalidatePath(`/${gameSlug}/price-index`)
    revalidated.push(`/${gameSlug}/price-index`)
  }

  return internalJson({
    ok: true,
    game: gameSlug,
    revalidated,
    revalidated_at: new Date().toISOString(),
  })
}
