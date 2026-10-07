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

function stripGame(currency: string, gameName: string): string {
  const rest = currency.toLowerCase().startsWith(`${gameName.toLowerCase()} `) ? currency.slice(gameName.length + 1) : currency
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

export interface CurrencyPageCard {
  gameSlug: string
  gameName: string
  /** "Diamonds", "Tokens". */
  currencyName: string
  href: string
  iconUrl: string | null
  offers: number
}

/**
 * Every enabled currency page with at least one live offer, with its
 * admin-uploaded currency icon: the guide's games-currency carousel. One
 * cached read for all pages (listing counts move slowly; the nightly cron and
 * any game edit refresh it through GAME_DIRECTORY_TAG). Fails open to none.
 */
const readCurrencyPages = unstable_cache(
  async (): Promise<Array<CurrencyPageCard & { ecosystem: string | null }>> => {
    try {
      const db = createAnonClient() as any
      const [cats, cfgs, listings, testSellers] = await Promise.all([
        db
          .from('game_categories')
          .select('id, slug, game:games!inner(id, slug, name, ecosystem, is_active)')
          .eq('type', 'currency')
          .eq('is_enabled', true)
          .eq('game.is_active', true)
          .limit(500),
        db
          .from('category_configs')
          .select('game_id, config->currency_icon_url, config->unit_label')
          .eq('category_type', 'currency')
          .limit(1000),
        db.from('listings').select('game_category_id, seller_id').eq('status', 'active').limit(20_000),
        getTestSellerIds(),
      ])
      const hidden = new Set(testSellers)
      const count = new Map<string, number>()
      for (const l of (listings.data ?? []) as { game_category_id: string; seller_id: string }[]) {
        if (hidden.has(l.seller_id)) continue
        count.set(l.game_category_id, (count.get(l.game_category_id) ?? 0) + 1)
      }
      const cfgByGame = new Map<string, { currency_icon_url: string | null; unit_label: string | null }>()
      for (const c of (cfgs.data ?? []) as { game_id: string; currency_icon_url: string | null; unit_label: string | null }[]) {
        cfgByGame.set(c.game_id, c)
      }
      const out: Array<CurrencyPageCard & { ecosystem: string | null }> = []
      for (const c of (cats.data ?? []) as { id: string; slug: string; game: { id: string; slug: string; name: string; ecosystem: string | null } }[]) {
        const offers = count.get(c.id) ?? 0
        if (offers === 0) continue
        const cfg = cfgByGame.get(c.game.id)
        const guide = getCurrencyGuide(c.game.slug)
        out.push({
          gameSlug: c.game.slug,
          gameName: c.game.name,
          // "Blade Ball Tokens" under "Blade Ball" reads twice: drop the game.
          currencyName: stripGame(guide?.currency ?? cfg?.unit_label ?? 'Currency', c.game.name),
          href: `/${c.game.slug}/${c.slug}`,
          iconUrl: cfg?.currency_icon_url ?? null,
          offers,
          ecosystem: c.game.ecosystem,
        })
      }
      return out.sort((a, b) => b.offers - a.offers || a.gameName.localeCompare(b.gameName))
    } catch {
      return []
    }
  },
  ['currency-guide-currency-pages-v2'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 86_400 },
)

/**
 * The carousel for one guide: Roblox-family guides show Roblox experiences'
 * currencies; other games show the other popular currencies. Never the page's
 * own game; 20 at most.
 */
export async function getRelatedCurrencyPages(guide: CurrencyGuide): Promise<CurrencyPageCard[]> {
  const all = await readCurrencyPages()
  const roblox = guideFamily(guide) === 'roblox'
  return all
    .filter((p) => p.gameSlug !== guide.game && (roblox ? p.ecosystem === 'roblox' : p.ecosystem !== 'roblox'))
    .slice(0, 20)
    .map(({ ecosystem: _e, ...p }) => p)
}

/** This game's enabled categories that have live offers (the "More <Game>" links), in admin order. */
export async function getGameCategoriesWithOffers(gameSlug: string): Promise<Array<{ href: string; name: string; type: string | null }>> {
  try {
    const db = createAnonClient() as any
    const { data: cats } = await db
      .from('game_categories')
      .select('id, slug, name, type, sort_order, game:games!inner(slug)')
      .eq('game.slug', gameSlug)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
    const ids = ((cats ?? []) as { id: string }[]).map((c) => c.id)
    if (ids.length === 0) return []
    const { data: rows } = await db.from('listings').select('game_category_id').eq('status', 'active').in('game_category_id', ids).limit(5_000)
    const live = new Set(((rows ?? []) as { game_category_id: string }[]).map((l) => l.game_category_id))
    return ((cats ?? []) as { id: string; slug: string; name: string | null; type: string | null }[])
      .filter((c) => live.has(c.id))
      .map((c) => ({ href: `/${gameSlug}/${c.slug}`, name: c.name ?? c.slug, type: c.type }))
  } catch {
    return []
  }
}
