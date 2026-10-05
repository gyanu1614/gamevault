import 'server-only'
import { createValuesReadClient } from '@/lib/values/read-client'

/**
 * Read layer for the generic values pipeline.
 *
 * Every query is keyed by game slug and `kind`, so the same functions serve
 * any game on the pipeline — this is what the hub pages call instead of the
 * per-game `sab_*` / `adopt_me_*` readers.
 *
 * Every read goes through the tagged values client: list pages (the default)
 * read under the game's list tags, an item page passes `itemSlug` and reads
 * under that item's tags (lib/values/revalidation.ts has the rule).
 */

export interface ValueItem {
  id: string
  kind: 'egg' | 'area' | 'pet' | 'item' | 'account_bracket'
  slug: string
  name: string
  rarity: string | null
  area: string | null
  incomePerSec: number | null
  imageUrl: string | null
  isPriced: boolean
  bracketMin: number | null
  bracketMax: number | null
  sortOrder: number
  sourceItemId: string | null
  /** MM2-style taxonomy (knife|gun|pet|misc|set); null for Steal an Egg. */
  itemType: string | null
  /** A chroma row's base item (chroma-fang → fang). */
  baseItemId: string | null
  releaseYear: number | null
  /** Human label of where it came from ("Knife Box 2", "Halloween Event 2021"). */
  origin: string | null
  /** Structured how-to-get sources (values_items.obtain). */
  obtain: ValueObtainSource[]
  /** CC-BY-SA credit for art copied from a wiki. */
  imageAttribution: string | null
  /** Null when nothing is published for this item — render "no price yet". */
  price: {
    cheapestUsd: number | null
    averageUsd: number | null
    lowUsd: number | null
    highUsd: number | null
    sampleSize: number
    sourceCount: number
    confidenceLabel: string | null
    priceChangedAt: string | null
  } | null
}

/** One way to get an item (values_items.obtain, migration 20261005004438). */
export interface ValueObtainSource {
  kind: string
  name: string | null
  year: number | null
  method?: string | null
  cost: { amount: number; currency: string } | null
  odds_pct: number | null
  still_obtainable: boolean | null
  wiki_page?: string | null
}

type ItemRow = {
  id: string
  kind: ValueItem['kind']
  slug: string
  name: string
  rarity: string | null
  area: string | null
  income_per_sec: number | string | null
  image_url: string | null
  is_priced: boolean
  bracket_min: number | string | null
  bracket_max: number | string | null
  sort_order: number
  source_item_id: string | null
  item_type: string | null
  base_item_id: string | null
  release_year: number | null
  origin: string | null
  obtain: unknown
  image_attribution: string | null
}

type PriceRow = {
  item_id: string
  cheapest_usd: number | string | null
  average_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  sample_size: number
  source_count: number
  confidence_label: string | null
  price_changed_at: string | null
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** PostgREST caps a select at 1000 rows; page through so nothing is truncated. */
async function selectAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error('values selectAll:', error)
      break
    }
    if (!data?.length) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
  }
  return out
}

type ReadClient = ReturnType<typeof createValuesReadClient>

async function gameIdFor(supabase: ReadClient, slug: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from('games')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Every enabled item for a game, with its published price attached.
 * Items without a price keep `price: null` — the caller renders "no market
 * price yet" rather than a zero.
 */
export async function getValueItems(
  gameSlug: string,
  opts: {
    kinds?: Array<ValueItem['kind']>
    /** The item page reading this list — picks that item's cache tags. */
    itemSlug?: string | null
  } = {},
): Promise<ValueItem[]> {
  const { kinds, itemSlug } = opts
  const supabase = createValuesReadClient({ gameSlug, itemSlug })
  const gameId = await gameIdFor(supabase, gameSlug)
  if (!gameId) return []

  const [items, prices] = await Promise.all([
    selectAll<ItemRow>((from, to) => {
      let q = (supabase as any)
        .from('values_items')
        .select(
          'id,kind,slug,name,rarity,area,income_per_sec,image_url,is_priced,bracket_min,bracket_max,sort_order,source_item_id,item_type,base_item_id,release_year,origin,obtain,image_attribution',
        )
        .eq('game_id', gameId)
        .eq('is_enabled', true)
      if (kinds?.length) q = q.in('kind', kinds)
      return q.order('sort_order', { ascending: true }).range(from, to)
    }),
    selectAll<PriceRow>((from, to) =>
      (supabase as any)
        .from('values_prices')
        .select(
          'item_id,cheapest_usd,average_usd,market_low_usd,market_high_usd,sample_size,source_count,confidence_label,price_changed_at',
        )
        .eq('game_id', gameId)
        .order('item_id', { ascending: true })
        .range(from, to),
    ),
  ])

  const priceByItem = new Map(prices.map((p) => [p.item_id, p]))

  return items.map((row) => {
    const p = priceByItem.get(row.id)
    return {
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      name: row.name,
      rarity: row.rarity,
      area: row.area,
      incomePerSec: num(row.income_per_sec),
      imageUrl: row.image_url,
      isPriced: row.is_priced,
      bracketMin: num(row.bracket_min),
      bracketMax: num(row.bracket_max),
      sortOrder: row.sort_order,
      sourceItemId: row.source_item_id,
      itemType: row.item_type ?? null,
      baseItemId: row.base_item_id ?? null,
      releaseYear: row.release_year ?? null,
      origin: row.origin ?? null,
      obtain: Array.isArray(row.obtain) ? (row.obtain as ValueObtainSource[]) : [],
      imageAttribution: row.image_attribution ?? null,
      price: p
        ? {
            cheapestUsd: num(p.cheapest_usd),
            averageUsd: num(p.average_usd),
            lowUsd: num(p.market_low_usd),
            highUsd: num(p.market_high_usd),
            sampleSize: p.sample_size ?? 0,
            sourceCount: p.source_count ?? 0,
            confidenceLabel: p.confidence_label,
            priceChangedAt: p.price_changed_at,
          }
        : null,
    }
  })
}

export async function getValueItem(
  gameSlug: string,
  itemSlug: string,
): Promise<ValueItem | null> {
  const all = await getValueItems(gameSlug, { itemSlug })
  return all.find((i) => i.slug === itemSlug) ?? null
}

/**
 * Freshness for the badge: when a value on this game last MOVED, and how much
 * evidence sits behind the published set. `price_changed_at` (not the crawl
 * time) is the honest signal — a crawl that confirms the same price must not
 * advertise new freshness.
 */
export async function getValuesFreshness(gameSlug: string): Promise<{
  lastChangedAt: string | null
  listingCount: number
  sourceCount: number
  pricedItems: number
}> {
  const items = await getValueItems(gameSlug)
  const priced = items.filter((i) => i.price != null)
  let lastChangedAt: string | null = null
  let listingCount = 0
  let sourceCount = 0
  for (const i of priced) {
    listingCount += i.price!.sampleSize
    sourceCount = Math.max(sourceCount, i.price!.sourceCount)
    const at = i.price!.priceChangedAt
    if (at && (lastChangedAt == null || at > lastChangedAt)) lastChangedAt = at
  }
  return { lastChangedAt, listingCount, sourceCount, pricedItems: priced.length }
}

/** One day of an item's price history (values_price_history). */
export interface ValueHistoryPoint {
  date: string
  cheapestUsd: number | null
  averageUsd: number | null
  sampleSize: number
}

type HistoryRow = {
  item_id: string
  history_date: string
  cheapest_usd: number | string | null
  average_usd: number | string | null
  sample_size: number | null
}

const HISTORY_COLS = 'item_id,history_date,cheapest_usd,average_usd,sample_size'

/** The number a trend is measured on: the market (average) price, else the floor. */
export function trendValue(p: Pick<ValueHistoryPoint, 'averageUsd' | 'cheapestUsd'>): number | null {
  const v = p.averageUsd ?? p.cheapestUsd
  return v != null && v > 0 ? v : null
}

/**
 * Change over the last `days` per item, in percent, keyed by item id — the
 * list cards' trend and the "Movers" sort. Compares each item's price on the
 * NEWEST history day with its price on the OLDEST day inside the window.
 *
 * Honest by construction: with fewer than two distinct days in the window the
 * map is empty and the list shows no trend at all (history cannot be
 * backfilled). Reads two days of rows, not the whole window.
 */
export async function getValueTrends(
  gameSlug: string,
  days = 7,
): Promise<{ fromDate: string | null; toDate: string | null; pctByItem: Record<string, number> }> {
  const empty = { fromDate: null, toDate: null, pctByItem: {} }
  const supabase = createValuesReadClient({ gameSlug })
  const gameId = await gameIdFor(supabase, gameSlug)
  if (!gameId) return empty

  const { data: newest } = await (supabase as any)
    .from('values_price_history')
    .select('history_date')
    .eq('game_id', gameId)
    .order('history_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const toDate: string | undefined = newest?.history_date
  if (!toDate) return empty

  const start = new Date(`${toDate}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - days)
  const { data: oldest } = await (supabase as any)
    .from('values_price_history')
    .select('history_date')
    .eq('game_id', gameId)
    .gte('history_date', start.toISOString().slice(0, 10))
    .order('history_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  const fromDate: string | undefined = oldest?.history_date
  if (!fromDate || fromDate === toDate) return { ...empty, toDate }

  const rows = await selectAll<HistoryRow>((from, to) =>
    (supabase as any)
      .from('values_price_history')
      .select(HISTORY_COLS)
      .eq('game_id', gameId)
      .in('history_date', [fromDate, toDate])
      .order('item_id', { ascending: true })
      .order('history_date', { ascending: true })
      .range(from, to),
  )

  const first = new Map<string, number>()
  const last = new Map<string, number>()
  for (const r of rows) {
    const v = trendValue({ averageUsd: num(r.average_usd), cheapestUsd: num(r.cheapest_usd) })
    if (v == null) continue
    ;(r.history_date === fromDate ? first : last).set(r.item_id, v)
  }
  const pctByItem: Record<string, number> = {}
  for (const [id, a] of first) {
    const b = last.get(id)
    if (b != null) pctByItem[id] = ((b - a) / a) * 100
  }
  return { fromDate, toDate, pctByItem }
}

/**
 * Daily history for one item page (the item and any sibling it compares
 * with, e.g. its chroma/base form), oldest first, keyed by item id. Read under
 * the ITEM's tags — never the game list tag (T1).
 */
export async function getValueItemHistory(
  gameSlug: string,
  itemSlug: string,
  itemIds: string[],
): Promise<Record<string, ValueHistoryPoint[]>> {
  const out: Record<string, ValueHistoryPoint[]> = {}
  if (itemIds.length === 0) return out
  const supabase = createValuesReadClient({ gameSlug, itemSlug })
  const rows = await selectAll<HistoryRow>((from, to) =>
    (supabase as any)
      .from('values_price_history')
      .select(HISTORY_COLS)
      .in('item_id', itemIds)
      .order('item_id', { ascending: true })
      .order('history_date', { ascending: true })
      .range(from, to),
  )
  for (const r of rows) {
    ;(out[r.item_id] ??= []).push({
      date: r.history_date,
      cheapestUsd: num(r.cheapest_usd),
      averageUsd: num(r.average_usd),
      sampleSize: r.sample_size ?? 0,
    })
  }
  return out
}
