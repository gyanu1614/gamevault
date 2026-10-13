import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { getHiddenSellerIds } from '@/lib/seo/hidden-sellers'
import { getCategoryStats } from '@/lib/seo/page-stats'
import { requestMemo } from '@/lib/revalidation/request-memo'
import { BUY_RAILS_TAG } from './tags'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { getLivePages } from '@/lib/currency-guides/server'
import { getValueItemListings, getValueStock } from '@/lib/value-listings/stock-server'
import { aggregateStock } from '@/lib/value-listings/stock'
import {
  busiestItemsGame,
  currencyCard,
  currencySourceSlug,
  itemsCard,
  parseRailSettings,
  RAILS_ON,
  valueItemRail,
  type RailCard,
  type RailSettings,
} from './model'

/**
 * Buy rail reads. All cookie-free (anon), so every page that carries a rail
 * stays static / ISR.
 *
 *   getRailSettings  the per-surface switches (/admin/buy-rails), fails open.
 *   getGameRails     the game's currency card (its own, or Robux for Roblox
 *                    games) + its items card, with LIVE count / cheapest
 *                    price from getCategoryStats — the same numbers as the
 *                    category page titles, read through the category's tagged
 *                    listings client, so revalidateListingSurfaces refreshes
 *                    them with every listing mutation.
 *   getSiteRails     posts with no game: Robux + the busiest items category.
 *
 * The game meta (ids, slugs, currency config) is cached for 7 days under the
 * game directory tag: value item pages are 7-day ISR, and a shorter window
 * here would cap their interval (Next takes the minimum across a render).
 *
 * Freshness, two modes:
 *   'live'     blog posts, value lists, calculators (a few dozen pages): the
 *              numbers carry the category listings tags, so every listing
 *              mutation refreshes them.
 *   'nightly'  value item pages (~1,200): the game cards' numbers are cached
 *              under the game directory tag instead, which the nightly cron
 *              already fires for these pages (getItemsPair). Tagging them with
 *              the Robux / items category tags would rebuild every item page
 *              of every Roblox game on any Robux listing change — the T1 rule
 *              (one listing change rebuilds one item page) forbids it. The
 *              item's OWN card stays live through its item stock tag.
 */

export { BUY_RAILS_TAG }

export const getRailSettings = unstable_cache(
  async (): Promise<RailSettings> => {
    try {
      const { data, error } = await (createAnonClient() as any)
        .from('buy_rail_settings')
        .select('blog, value_item, value_list, calculator')
        .eq('id', 1)
        .maybeSingle()
      return error ? RAILS_ON : parseRailSettings(data)
    } catch {
      return RAILS_ON
    }
  },
  ['buy-rail-settings-v1'],
  { tags: [BUY_RAILS_TAG], revalidate: 604800 },
)

interface RailGameMeta {
  gameId: string
  slug: string
  name: string
  ecosystem: string | null
  currencyCat: { id: string; slug: string } | null
  itemsCat: { id: string; slug: string } | null
  currency: { unitLabel: string; granularity: 'unit' | 'thousand' | 'million' | null; perUnit: boolean; iconUrl: string | null } | null
}

const readGameMeta = unstable_cache(
  async (gameSlug: string): Promise<RailGameMeta | null> => {
    try {
      const sb = createAnonClient() as any
      const { data: game } = await sb
        .from('games')
        .select('id, slug, name, ecosystem')
        .eq('slug', gameSlug)
        .eq('is_active', true)
        .maybeSingle()
      if (!game) return null
      const [{ data: cats }, { data: cfgRow }] = await Promise.all([
        sb
          .from('game_categories')
          .select('id, slug, type, sort_order')
          .eq('game_id', game.id)
          .eq('is_enabled', true)
          .in('type', ['currency', 'items'])
          .order('sort_order', { ascending: true }),
        sb.from('category_configs').select('config').eq('game_id', game.id).eq('category_type', 'currency').maybeSingle(),
      ])
      const first = (type: string) => {
        const c = ((cats ?? []) as { id: string; slug: string; type: string }[]).find((x) => x.type === type)
        return c ? { id: c.id, slug: c.slug } : null
      }
      const cfg = cfgRow?.config ?? null
      const unitLabel: string | null = cfg?.unit_label ?? null
      return {
        gameId: game.id,
        slug: game.slug,
        name: game.name,
        ecosystem: game.ecosystem ?? null,
        currencyCat: first('currency'),
        itemsCat: first('items'),
        currency: unitLabel
          ? {
              unitLabel,
              granularity: cfg?.quantity_granularity ?? null,
              perUnit: (cfg?.bundles?.length ?? 0) === 0,
              iconUrl: cfg?.currency_icon_url ?? null,
            }
          : null,
      }
    } catch {
      return null
    }
  },
  ['buy-rails-game-meta-v1'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 604800 },
)

/** Memoised per render: a page asks for the same game's meta from several cards. */
const gameMeta = requestMemo(readGameMeta)

export interface GameRails {
  currency: RailCard | null
  items: RailCard | null
}

export type RailFreshness = 'live' | 'nightly'

type Stats = { count: number; lowPrice: number | null }

async function statsFor(gameId: string, categoryId: string, hidden: readonly string[], fresh: RailFreshness): Promise<Stats> {
  if (fresh === 'live') return getCategoryStats(gameId, categoryId, hidden)
  // An UNTAGGED read inside the cache entry: a tagged fetch here would still
  // push its category tags onto the page on a cache miss (Next 14.2 shares the
  // render's tag list with unstable_cache callbacks). Same filters as
  // getCategoryStats; hidden sellers resolved by the caller, outside.
  return unstable_cache(
    async (): Promise<Stats> => {
      try {
        let q = (createAnonClient() as any)
          .from('listings')
          .select('price')
          .eq('game_id', gameId)
          .eq('game_category_id', categoryId)
          .eq('status', 'active')
          .gt('price', 0)
        if (hidden.length > 0) q = q.not('seller_id', 'in', `(${hidden.join(',')})`)
        const { data, error } = await q.limit(5000)
        if (error || !data) return { count: 0, lowPrice: null }
        const prices = (data as { price: number | string }[]).map((r) => Number(r.price)).filter((p) => p > 0)
        return { count: prices.length, lowPrice: prices.length ? Math.min(...prices) : null }
      } catch {
        return { count: 0, lowPrice: null }
      }
    },
    ['buy-rails-stats-nightly-v1', gameId, categoryId],
    { tags: [GAME_DIRECTORY_TAG], revalidate: 604800 },
  )()
}

async function currencyFor(meta: RailGameMeta, hidden: readonly string[], fresh: RailFreshness): Promise<RailCard | null> {
  const sourceSlug = currencySourceSlug({ slug: meta.slug, ecosystem: meta.ecosystem, hasCurrency: !!meta.currencyCat && !!meta.currency })
  if (!sourceSlug) return null
  const source = sourceSlug === meta.slug ? meta : await gameMeta(sourceSlug)
  if (!source?.currencyCat || !source.currency) return null
  const [stats, art] = await Promise.all([statsFor(source.gameId, source.currencyCat.id, hidden, fresh), getGameCtaImage(source.slug)])
  return currencyCard({
    artUrl: art,
    gameSlug: source.slug,
    unitLabel: source.currency.unitLabel,
    granularity: source.currency.granularity,
    perUnit: source.currency.perUnit,
    iconUrl: source.currency.iconUrl,
    href: `/${source.slug}/${source.currencyCat.slug}`,
    count: stats.count,
    lowPrice: stats.lowPrice,
  })
}

async function itemsFor(meta: RailGameMeta, hidden: readonly string[], fresh: RailFreshness): Promise<RailCard | null> {
  if (!meta.itemsCat) return null
  const [stats, art] = await Promise.all([statsFor(meta.gameId, meta.itemsCat.id, hidden, fresh), getGameCtaImage(meta.slug)])
  return itemsCard({
    gameSlug: meta.slug,
    gameName: meta.name,
    href: `/${meta.slug}/${meta.itemsCat.slug}`,
    count: stats.count,
    lowPrice: stats.lowPrice,
    artUrl: art,
  })
}

export async function getGameRails(gameSlug: string, fresh: RailFreshness = 'live'): Promise<GameRails> {
  const meta = await gameMeta(gameSlug)
  if (!meta) return { currency: null, items: null }
  // One hidden-seller set for both cards (per-render memoised).
  const hidden = await getHiddenSellerIds()
  const [currency, items] = await Promise.all([currencyFor(meta, hidden, fresh), itemsFor(meta, hidden, fresh)])
  return { currency, items }
}

/** Posts with no game: Robux on the left, the busiest items category on the right. */
export async function getSiteRails(): Promise<GameRails> {
  const [robux, pages] = await Promise.all([getGameRails('roblox'), getLivePages()])
  const busiest = busiestItemsGame(pages)
  const items = busiest ? (await getGameRails(busiest)).items : null
  return { currency: robux.currency, items }
}

/**
 * The value item page's own buy card. Reads only this item's listings, under
 * this item's stock tag (the same cached entry the page's buy button and
 * "Available Now" read), so it is live without touching any other page.
 */
export async function getValueItemRail(gameSlug: string, itemSlug: string, itemName: string, imageUrl: string | null): Promise<RailCard> {
  const [listings, art] = await Promise.all([getValueItemListings(gameSlug, itemSlug), getGameCtaImage(gameSlug)])
  const rows = (listings?.rows ?? []).filter((r) => r.value_item_slug === itemSlug)
  const stock = aggregateStock(rows.map((r) => ({ itemSlug, variant: r.value_variant, unitPriceUsd: Number(r.price) }))).get(itemSlug) ?? null
  return valueItemRail({
    gameSlug,
    itemSlug,
    itemName,
    imageUrl,
    artUrl: art,
    buy: listings
      ? { categorySlug: listings.pair.categorySlug, stock, offers: rows.map((r) => ({ deliveryTime: (r.delivery_time as string | null) ?? null })) }
      : null,
  })
}

/**
 * Calculator buy box data: the game's live stock per item (only stocked
 * items, two numbers each) + its items page. The same cached per-game read
 * the value list uses. Null when the admin switch is off or the game has no
 * items page.
 */
export async function getCalcBuyData(gameSlug: string): Promise<{
  gameSlug: string
  gameName: string
  itemsHref: string
  categorySlug: string
  stock: Record<string, { total: number; minPriceUsd: number | null }>
} | null> {
  const settings = await getRailSettings()
  if (!settings.calculator) return null
  const value = await getValueStock(gameSlug)
  if (!value) return null
  const stock: Record<string, { total: number; minPriceUsd: number | null }> = {}
  for (const [slug, s] of Object.entries(value.byItem)) {
    if (s.total > 0 && s.minPriceUsd != null) stock[slug] = { total: s.total, minPriceUsd: s.minPriceUsd }
  }
  return {
    gameSlug,
    gameName: value.pair.gameName,
    itemsHref: `/${gameSlug}/${value.pair.categorySlug}`,
    categorySlug: value.pair.categorySlug,
    stock,
  }
}
