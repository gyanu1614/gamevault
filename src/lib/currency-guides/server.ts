import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { getCachedGameDirectory } from '@/lib/marketplace/gameDirectoryCache'
import { hasHubPage } from '@/lib/content/theme'
import { getCurrencyGuide, guideFamily, type CurrencyGuide } from './index'
import { buildGuideLinks, type GuideLinks } from './links'

/**
 * Cookie-free, cached reads behind the currency guide (Step 7a: public pages
 * read through the anon client; Step 7b: reads identical across pages are
 * unstable_cache'd under a tag the nightly cron revalidates).
 */

export interface GameReviewStats {
  count: number
  /** Average stars, 1–5. */
  average: number
}

/** A rating shows only from this many reviews for the game. */
export const MIN_REVIEWS_FOR_RATING = 10

/**
 * Visible reviews per game, one cached entry for every page. A review's game
 * is its own game_id, else its listing's. Test sellers are excluded, like on
 * every other public surface. Fails open to "no rating".
 */
const readReviewStatsByGame = unstable_cache(
  async (): Promise<Record<string, { count: number; sum: number }>> => {
    try {
      const [testSellers, res] = await Promise.all([
        getTestSellerIds(),
        (createAnonClient().from('reviews') as any)
          .select('rating, seller_id, game_id, listing:listings(game_id)')
          .eq('is_visible', true)
          .limit(10_000),
      ])
      if (res.error || !res.data) return {}
      const hidden = new Set(testSellers)
      const out: Record<string, { count: number; sum: number }> = {}
      for (const r of res.data as { rating: number; seller_id: string; game_id: string | null; listing: { game_id: string | null } | null }[]) {
        if (hidden.has(r.seller_id)) continue
        const game = r.game_id ?? r.listing?.game_id ?? null
        if (!game || !(r.rating >= 1 && r.rating <= 5)) continue
        const e = (out[game] ??= { count: 0, sum: 0 })
        e.count += 1
        e.sum += r.rating
      }
      return out
    } catch {
      return {}
    }
  },
  ['currency-guide-review-stats'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 86_400 },
)

/** The game's real rating, or null below MIN_REVIEWS_FOR_RATING reviews. */
export async function getGameReviewStats(gameId: string | null | undefined): Promise<GameReviewStats | null> {
  if (!gameId) return null
  const e = (await readReviewStatsByGame())[gameId]
  if (!e || e.count < MIN_REVIEWS_FOR_RATING) return null
  return { count: e.count, average: e.sum / e.count }
}

/** Section 6 links from the cached game/category directory (fails open to none). */
export async function getGuideLinks(guide: CurrencyGuide, gameName: string): Promise<GuideLinks> {
  try {
    const dir = await getCachedGameDirectory()
    return buildGuideLinks({
      gameSlug: guide.game,
      gameName,
      family: guideFamily(guide),
      directory: dir,
      hasValues: hasHubPage(guide.game, 'values'),
      hasCalculator: hasHubPage(guide.game, 'calculator'),
      guideFor: getCurrencyGuide,
      familyOf: guideFamily,
    })
  } catch {
    return { game: [], related: [] }
  }
}
