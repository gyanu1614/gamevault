import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { GAME_DIRECTORY_TAG } from '@/lib/marketplace/gameDirectoryCache'
import { getAllGames } from '@/lib/utils/games'
import { hasGameContentTheme } from '@/lib/content/theme'

/**
 * Data for the shared content-hub navbar: the game switcher list and the
 * current game's available tabs/storefront buttons.
 *
 * Tabs and buy buttons are DATA-DRIVEN per game:
 *  - Buy buttons come from the game's active categories (items / accounts).
 *  - Tool tabs (Values, Calculator) come from GAME_TOOLS — only games whose
 *    tool routes actually exist. Today that is SAB only; adding a game's
 *    tools = one entry here once its routes ship.
 */

export interface HubNavGame {
  name: string
  slug: string
  imageUrl: string | null
}

export interface HubNavData {
  games: HubNavGame[]
  current: HubNavGame
  /** Tool tabs available for this game, in display order. */
  tools: Array<'values' | 'calculator'>
  /** Storefront links — null when the game lacks that category. */
  itemsHref: string | null
  accountsHref: string | null
  /** Seller landing (/[game]/sell) — null for games without a content hub. */
  sellHref: string | null
}

const GAME_TOOLS: Record<string, Array<'values' | 'calculator'>> = {
  'steal-a-brainrot': ['values', 'calculator'],
  // Adopt Me: values + the WFL calculator are both live now.
  'adopt-me': ['values', 'calculator'],
}

/**
 * A game's active categories. Cookie-free + unstable_cache so the content-hub
 * nav (rendered on every hub page) does not force those routes dynamic; tagged
 * with GAME_DIRECTORY_TAG so admin category edits invalidate it immediately.
 */
const getCachedGameCategories = unstable_cache(
  async (gameId: string): Promise<Array<{ slug: string; type: string | null }>> => {
    const supabase = createAnonClient()
    const { data } = await (supabase as any)
      .from('game_categories')
      .select('slug, type')
      .eq('game_id', gameId)
      .eq('is_enabled', true)
    return (data ?? []) as Array<{ slug: string; type: string | null }>
  },
  ['hub-nav-game-categories'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 3600 },
)

export async function getHubNavData(gameSlug: string): Promise<HubNavData> {
  const games = await getAllGames()
  const current = games.find((g) => g.slug === gameSlug)

  // Which storefront categories does this game actually have?
  let itemsHref: string | null = null
  let accountsHref: string | null = null
  if (current) {
    const rows = await getCachedGameCategories(current.id)
    const hasItems = rows.some(
      (r) => r.slug === 'buy-items' || r.type === 'items',
    )
    const hasAccounts = rows.some(
      (r) => r.slug === 'buy-accounts' || r.type === 'account',
    )
    if (hasItems) itemsHref = `/${gameSlug}/buy-items`
    if (hasAccounts) accountsHref = `/${gameSlug}/buy-accounts`
  }

  return {
    games: games.map((g) => ({
      name: g.name,
      slug: g.slug,
      imageUrl: g.image_url,
    })),
    current: {
      name: current?.name ?? gameSlug,
      slug: gameSlug,
      imageUrl: current?.image_url ?? null,
    },
    tools: GAME_TOOLS[gameSlug] ?? [],
    itemsHref,
    accountsHref,
    // Sell landing exists for any game with a content hub (mirrors the /sell
    // page's own gate), so the nav always offers a seller door alongside Buy.
    sellHref: hasGameContentTheme(gameSlug) ? `/${gameSlug}/sell?src=${gameSlug}-hubnav` : null,
  }
}

/**
 * Nav clearance tokens live in `hubNavGeometry` — this module is server-only,
 * so client components cannot import from here. Re-exported for convenience.
 */
export { HUB_NAV_CLEAR, HUB_NAV_CLEAR_HERO } from '@/components/content/hubNavGeometry'
