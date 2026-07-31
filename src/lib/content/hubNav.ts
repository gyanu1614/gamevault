import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getAllGames } from '@/lib/utils/games'

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
}

const GAME_TOOLS: Record<string, Array<'values' | 'calculator'>> = {
  'steal-a-brainrot': ['values', 'calculator'],
  // Adopt Me: values + the WFL calculator are both live now.
  'adopt-me': ['values', 'calculator'],
}

export async function getHubNavData(gameSlug: string): Promise<HubNavData> {
  const games = await getAllGames()
  const current = games.find((g) => g.slug === gameSlug)

  // Which storefront categories does this game actually have?
  let itemsHref: string | null = null
  let accountsHref: string | null = null
  if (current) {
    const supabase = await createClient()
    const { data } = await (supabase as any)
      .from('categories')
      .select('slug, metadata')
      .eq('game_id', current.id)
      .eq('is_active', true)
    const rows = (data ?? []) as Array<{
      slug: string
      metadata: { type?: string } | null
    }>
    const hasItems = rows.some(
      (r) => r.slug === 'buy-items' || r.metadata?.type === 'items',
    )
    const hasAccounts = rows.some(
      (r) => r.slug === 'buy-accounts' || r.metadata?.type === 'account',
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
  }
}

/**
 * Nav clearance tokens live in `hubNavGeometry` — this module is server-only,
 * so client components cannot import from here. Re-exported for convenience.
 */
export { HUB_NAV_CLEAR, HUB_NAV_CLEAR_HERO } from '@/components/content/hubNavGeometry'
