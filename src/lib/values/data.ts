import 'server-only'
import { createAnonClient } from '@/lib/supabase/anon'

/**
 * Read layer for the generic values pipeline.
 *
 * Every query is keyed by game slug and `kind`, so the same functions serve
 * any game on the pipeline — this is what the hub pages call instead of the
 * per-game `sab_*` / `adopt_me_*` readers.
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

async function gameIdFor(slug: string): Promise<string | null> {
  const supabase = createAnonClient()
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
  kinds?: Array<ValueItem['kind']>,
): Promise<ValueItem[]> {
  const gameId = await gameIdFor(gameSlug)
  if (!gameId) return []
  const supabase = createAnonClient()

  const [items, prices] = await Promise.all([
    selectAll<ItemRow>((from, to) => {
      let q = (supabase as any)
        .from('values_items')
        .select(
          'id,kind,slug,name,rarity,area,income_per_sec,image_url,is_priced,bracket_min,bracket_max,sort_order,source_item_id',
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
  const all = await getValueItems(gameSlug)
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
