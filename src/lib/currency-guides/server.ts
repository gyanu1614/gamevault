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

export interface RelatedPageLink {
  href: string
  label: string
  /** game_categories.type, for the category icon. */
  type: string | null
}

interface LivePage {
  gameSlug: string
  gameName: string
  ecosystem: string | null
  slug: string
  name: string
  type: string | null
  offers: number
}

/**
 * Every enabled category page with at least one live offer (test sellers
 * left out). One cached read for every guide; the nightly cron and any game
 * edit refresh it through GAME_DIRECTORY_TAG. Fails open to none.
 */
const readLivePages = unstable_cache(
  async (): Promise<LivePage[]> => {
    try {
      const db = createAnonClient() as any
      const [cats, listings, testSellers] = await Promise.all([
        db
          .from('game_categories')
          .select('id, slug, name, type, game:games!inner(slug, name, ecosystem, is_active)')
          .eq('is_enabled', true)
          .eq('game.is_active', true)
          .limit(3000),
        db.from('listings').select('game_category_id, seller_id').eq('status', 'active').limit(20_000),
        getTestSellerIds(),
      ])
      const hidden = new Set(testSellers)
      const count = new Map<string, number>()
      for (const l of (listings.data ?? []) as { game_category_id: string; seller_id: string }[]) {
        if (hidden.has(l.seller_id)) continue
        count.set(l.game_category_id, (count.get(l.game_category_id) ?? 0) + 1)
      }
      const out: LivePage[] = []
      for (const c of (cats.data ?? []) as { id: string; slug: string; name: string | null; type: string | null; game: { slug: string; name: string; ecosystem: string | null } }[]) {
        const offers = count.get(c.id) ?? 0
        if (offers === 0) continue
        out.push({ gameSlug: c.game.slug, gameName: c.game.name, ecosystem: c.game.ecosystem, slug: c.slug, name: c.name ?? c.slug, type: c.type, offers })
      }
      return out.sort((a, b) => b.offers - a.offers || a.gameName.localeCompare(b.gameName))
    } catch {
      return []
    }
  },
  ['currency-guide-live-pages-v1'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 86_400 },
)

/**
 * "More Roblox Games" (owner, 2026-10-06): this game's other categories with
 * offers, then the busiest other games of the same family, one page each
 * (Adopt Me Items, Steal a Brainrot Items…). Ten links at most.
 */
export async function getRelatedPages(
  guide: CurrencyGuide,
  gameName: string,
  currentType: string = 'currency',
  max = 10,
): Promise<RelatedPageLink[]> {
  const pages = await readLivePages()
  const roblox = guideFamily(guide) === 'roblox'
  const own = pages
    .filter((p) => p.gameSlug === guide.game && p.type !== currentType)
    .map((p) => ({ href: `/${p.gameSlug}/${p.slug}`, label: `${gameName} ${p.name}`, type: p.type }))
  const seen = new Set<string>([guide.game])
  const others: RelatedPageLink[] = []
  for (const p of pages) {
    if (seen.has(p.gameSlug)) continue
    if (roblox ? p.ecosystem !== 'roblox' : p.ecosystem === 'roblox') continue
    seen.add(p.gameSlug)
    others.push({ href: `/${p.gameSlug}/${p.slug}`, label: `${p.gameName} ${p.name}`, type: p.type })
  }
  return [...own, ...others].slice(0, max)
}
