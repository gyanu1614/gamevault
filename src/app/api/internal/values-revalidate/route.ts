import { revalidatePath } from 'next/cache'
import {
  authorizeInternalRequest,
  internalJson,
} from '@/lib/security/internal-route-auth'
import { CONTENT_HUB_GAME_SLUGS, hasHubPage } from '@/lib/content/theme'

/**
 * Revalidate a game's value pages after a crawl republishes prices.
 *
 * Uses the shared internal-route auth from Step 2 (rate limit → configured-
 * secret check → constant-time compare) rather than re-implementing it, which
 * is what sab-market-revalidate did before that helper existed.
 *
 * Scoped by `?game=<slug>`: a crawl only refreshes the game it crawled, so a
 * Steal An Egg run never invalidates SAB's cache.
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
    // Every item page for this game, in one call.
    revalidatePath(`/${gameSlug}/values/[itemSlug]`, 'page')
    revalidated.push(`/${gameSlug}/values/[itemSlug]`)
  }
  if (hasHubPage(gameSlug, 'methodology')) {
    // The methodology page quotes live counts, so it goes stale with the rest.
    revalidatePath(`/${gameSlug}/values/methodology`)
    revalidated.push(`/${gameSlug}/values/methodology`)
  }

  return internalJson({
    ok: true,
    game: gameSlug,
    revalidated,
    revalidated_at: new Date().toISOString(),
  })
}
