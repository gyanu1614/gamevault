import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { getGameContentTheme, hasHubPage, CONTENT_HUB_GAME_SLUGS } from '@/lib/content/theme'
import { amVariantKey, VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { getValueStock } from '@/lib/value-listings/stock-server'
import { getValueItems } from '@/lib/values/data'
import {
  justAdded,
  mostValuable,
  sellItemsFromAdoptMe,
  sellItemsFromSab,
  sellItemsFromValueItems,
  sellItemsFromValueRows,
  topToSell,
  type SellItem,
  type StockBySlug,
} from '@/lib/sell/sell-items'
import type { SellTier } from '@/lib/sell/sell-copy'
import { getHubCategoryStats } from '../_hubData'
import { getAdoptMePets } from '../values/_adoptMeData'
import { getSabBrainrots } from '../values/_sabBrainrots'
import { getValueListRows } from '../values/_generic/valueListRows'
import { valueListKind } from '../values/_listRows'

/**
 * Everything /[game]/sell shows (values platform Step E), read once per render
 * for both generateMetadata and the page. Cookie-free and cached by the reads
 * themselves: the value rows are the SAME tagged reads as the values list (a
 * price publish refreshes both), offers are the category listings reads the
 * game hub uses (a listing change refreshes them), players are one RPC a day.
 */

const CATEGORY_WORD: Record<string, string> = { account: 'Accounts', items: 'Items', currency: 'Currency', top_up: 'Top-Ups' }

export interface SellCategory {
  id: string
  name: string
  slug: string
  type: string | null
  count: number
  fromUsd: number | null
}

/** The game row + its enabled categories (also the indexability inputs). */
export const getSellPageGame = cache(async (gameSlug: string) => {
  const supabase = createAnonClient()
  const { data: game } = (await supabase
    .from('games')
    .select('id, name, slug, seo_indexable')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()) as unknown as {
    data: { id: string; name: string; slug: string; seo_indexable: boolean | null } | null
  }
  if (!game) return null

  const { data: cats } = (await supabase
    .from('game_categories')
    .select('id, name, slug, type')
    .eq('game_id', game.id)
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true })) as unknown as {
    data: { id: string; name: string; slug: string; type: string | null }[] | null
  }
  const categories = cats ?? []
  return {
    ...game,
    categories,
    enabledCategoryCount: categories.length,
    // What the title sells for a game without a values hub: currency first,
    // then items, then accounts (a currency game is searched as "sell <game> gold").
    primaryCategory:
      categories.find((c) => c.type === 'currency') ??
      categories.find((c) => c.type === 'items') ??
      categories.find((c) => c.type === 'account') ??
      categories[0] ??
      null,
  }
})

/** Every item of the game's values hub as a sell row; [] for a game without one. Read errors throw (never cache a wrong page). */
async function getSellItems(gameSlug: string): Promise<SellItem[]> {
  if (!hasHubPage(gameSlug, 'values')) return []
  const stock: StockBySlug = (await getValueStock(gameSlug))?.byItem ?? {}
  switch (valueListKind(gameSlug)) {
    case 'adopt-me':
      return sellItemsFromAdoptMe(await getAdoptMePets(), stock, amVariantKey)
    case 'steal-a-brainrot':
      return sellItemsFromSab(await getSabBrainrots(), stock)
    case 'generic':
      return sellItemsFromValueRows(gameSlug, (await getValueListRows(gameSlug)).rows, stock)
    default:
      return VALUES_PIPELINE_GAMES.has(gameSlug) ? sellItemsFromValueItems(gameSlug, await getValueItems(gameSlug), stock) : []
  }
}

const readPlayers = unstable_cache(
  async (gameId: string): Promise<{ playingNow: number | null; peak7d: number | null } | null> => {
    // public_game_players: two aggregate numbers from the trend radar's captures (migration 20261022044116).
    const { data, error } = await (createAnonClient() as any).rpc('public_game_players', { p_game_id: gameId })
    // Thrown, so a failure is not cached for the day; the caller shows nothing.
    if (error) throw new Error(`public_game_players: ${error.message}`)
    const row = (data ?? [])[0] as { playing_now: number | null; peak_7d: number | null } | undefined
    return row && (row.playing_now || row.peak_7d) ? { playingNow: row.playing_now ?? null, peak7d: row.peak_7d ?? null } : null
  },
  ['sell-players'],
  { revalidate: 86400 },
)

async function getSellPlayers(gameId: string) {
  try {
    return await readPlayers(gameId)
  } catch (e) {
    console.error('[sell] players read failed', e instanceof Error ? e.message : e)
    return null
  }
}

export const loadSellPage = cache(async (gameSlug: string) => {
  const game = await getSellPageGame(gameSlug)
  if (!game) return null
  const theme = getGameContentTheme(gameSlug)
  const isHub = CONTENT_HUB_GAME_SLUGS.includes(gameSlug)
  const name = isHub ? theme.name : game.name

  const [items, stats, players] = await Promise.all([
    getSellItems(gameSlug),
    game.categories.length ? getHubCategoryStats(game.id, game.categories) : Promise.resolve({} as Awaited<ReturnType<typeof getHubCategoryStats>>),
    getSellPlayers(game.id),
  ])

  const categories: SellCategory[] = game.categories.map((c) => ({ ...c, count: stats[c.id]?.count ?? 0, fromUsd: stats[c.id]?.lowPrice ?? null }))
  const live = categories.filter((c) => c.count > 0)
  const offers = {
    total: live.reduce((n, c) => n + c.count, 0),
    fromUsd: live.reduce<number | null>((m, c) => (c.fromUsd != null && (m == null || c.fromUsd < m) ? c.fromUsd : m), null),
  }
  const priced = items.filter((i) => i.priceUsd != null)
  const tier: SellTier = priced.length > 0 ? 'values' : offers.total > 0 ? 'listings' : 'categories'

  // Hub games sell their item noun ("Pets"); "Steal an Egg Eggs" reads badly, so a noun already in the name becomes "Items".
  const hubNoun = name.toLowerCase().includes(theme.itemNoun.toLowerCase()) ? 'Items' : theme.itemNounPlural
  const noun = isHub ? hubNoun : (CATEGORY_WORD[game.primaryCategory?.type ?? ''] ?? 'Items')

  return {
    game,
    name,
    noun,
    tier,
    top: topToSell(items),
    fresh: justAdded(items),
    valuable: mostValuable(items).map((i) => ({ name: i.name, priceUsd: i.priceUsd as number, form: i.form })),
    pricedCount: priced.length,
    // The values list reads ?q= (SAB, Adopt Me, MM2); Steal an Egg's hub has no search.
    searchable: valueListKind(gameSlug) != null,
    categories,
    offers,
    players,
  }
})
