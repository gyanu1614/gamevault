/**
 * Generic values_* pipeline correction — DB read/write around the shared
 * reputable pass, for every game on values_items / values_raw_listings
 * (Steal an Egg, Murder Mystery 2, the next ones).
 *
 * Reads active matched rows from values_raw_listings, runs the SAME
 * game-agnostic reputable model SAB and Adopt Me use (`reputable-adapter`),
 * and writes cheapest/average onto values_prices. What differs per game is a
 * small `ValuesPricingPolicy` (which kinds are never priced, the unit-price
 * floor, whether to trim placeholder highs) — the maths is shared.
 *
 * Honesty rules every game gets:
 *  1. Eldorado's `pricePerUnitInUSD` is already a unit price — never divided
 *     by a title quantity (Steal an Egg measured this: dividing was 4x low).
 *  2. Items with no reputable evidence are left alone rather than zeroed. A
 *     page with no price says "no market price yet"; it never shows $0.
 *  3. Kinds the policy marks unpriced (Steal an Egg pets, MM2 sets until
 *     phase 2) are never priced.
 *  4. Fewer than MIN_EVIDENCE reputable listings → nothing published.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { RepriceOptions, RepriceResult } from '@/lib/pricing/registry'
import type { PublishedPrice } from '@/lib/pricing/change-rule'
import {
  computeReputablePrices,
  dropPlaceholderHighs,
  type RawListing,
  type VariantReputablePrice,
} from '@/lib/pricing/reputable-adapter'

const PAGE_SIZE = 1000

/** Only listings observed in this window feed a live price. */
const FRESH_WINDOW_HOURS = 24

type RawRow = {
  id: string
  matched_item_id: string | null
  price_usd: number | string | null
  quantity: number | null
  seller_reviews: number | string | null
  match_confidence: number | string | null
}

type ItemRow = {
  id: string
  slug: string
  kind: string
  is_priced: boolean
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Page through a table in 1000-row chunks (PostgREST caps a single select).
 *
 * `orderBy` is REQUIRED and per-table: pagination without a stable sort can
 * skip or duplicate rows at the page seams. It is a parameter rather than a
 * hardcoded 'id' because these tables do not share a key — values_prices is
 * keyed by `item_id` (one row per item, no surrogate id), so ordering it by
 * 'id' raised `column values_prices.id does not exist` and failed the whole
 * pricing run in production.
 */
async function selectAll<T>(
  client: ReturnType<typeof createServiceRoleClient>,
  table: string,
  columns: string,
  orderBy: string,
  filter?: (q: any) => any,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    let query = (client as any).from(table).select(columns).order(orderBy)
    if (filter) query = filter(query)
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

/**
 * Minimum reputable listings behind a published value. Below this the value is
 * suppressed entirely rather than published thin — the same
 * minimum-evidence principle the SAB correction applies, and the input to the
 * `noindex`-under-3-listings rule on the page side.
 */
export const MIN_EVIDENCE = 3

/**
 * Floor for a believable per-egg price.
 *
 * ~6% of live listings (31/500) price per IN-GAME UNIT rather than per egg:
 * $0.00001 against a claimed stock of 5.5 million, with titles like
 * "5X EGG = 5,000 UNITS/50 CENT". Their `price × stock` lands at a $75 median
 * — the seller's whole inventory, not a unit price — so they are not
 * comparable with per-egg listings on any axis and must be excluded rather
 * than rescaled.
 *
 * The shared engine's fake-cheap cut is PROPORTIONAL (25% of median), which is
 * right for SAB's $200 items but cannot save a category whose real median is
 * ~$1: enough sub-cent rows drag the median down until they look legitimate.
 * So this is an absolute floor, applied by the caller — exactly where
 * `reputable-adapter` says game-specific cleanliness belongs. A cent sits
 * below every genuine observed price (live median $0.99, p25 $0.50) and above
 * every per-in-game-unit row seen.
 */
export const MIN_BELIEVABLE_UNIT_USD = 0.01

/**
 * A stock claim above this is not a real inventory, it is a sort-gaming
 * listing. The biggest genuine stock seen live is in the thousands; the bait
 * listings claim millions.
 */
export const MAX_BELIEVABLE_STOCK = 100_000

/** What differs per game on the generic pipeline. Everything else is shared. */
export type ValuesPricingPolicy = {
  /** values_items.kind values that are never priced (catalogue-only). */
  unpricedKinds: readonly string[]
  /** Unit prices below this are bait/per-in-game-unit listings, dropped and counted. */
  minUnitUsd: number
  /**
   * Trim a top reputable listing more than this × the next one (a shop's
   * out-of-stock placeholder price). null = off.
   */
  placeholderHighRatio: number | null
  /** Marketplaces behind the value (values_prices.source_count). */
  sourceCount: number
}

export const STEAL_AN_EGG_POLICY: ValuesPricingPolicy = Object.freeze({
  unpricedKinds: ['pet'],
  minUnitUsd: MIN_BELIEVABLE_UNIT_USD,
  placeholderHighRatio: null,
  sourceCount: 1, // Eldorado only today; G2G has no Steal An Egg category.
})

export type PlannedValuesPrices = {
  /** Listings that fed the engine (after the floor and placeholder trim). */
  listings: RawListing[]
  /** One result per item with >= MIN_EVIDENCE reputable listings. */
  priced: VariantReputablePrice[]
  /** Low/high of the priced inputs per item (the trust-signal range). */
  spanByItem: Map<string, { low: number; high: number }>
  skippedUnpriceable: number
  droppedFakeCheap: number
  placeholdersDropped: number
  suppressed: number
}

/**
 * The pure pricing decision: raw matched rows → published prices. No I/O, so
 * the dry-run script and the tests run exactly what the job runs.
 */
export function planValuesPrices(
  rawRows: ReadonlyArray<Pick<RawRow, 'matched_item_id' | 'price_usd' | 'seller_reviews'>>,
  priceableItemIds: ReadonlySet<string>,
  policy: ValuesPricingPolicy,
): PlannedValuesPrices {
  let listings: RawListing[] = []
  let skippedUnpriceable = 0
  let droppedFakeCheap = 0
  for (const row of rawRows) {
    if (!row.matched_item_id || !priceableItemIds.has(row.matched_item_id)) {
      skippedUnpriceable += 1
      continue
    }
    const price = toNumber(row.price_usd)
    if (price == null || price <= 0) continue
    // `pricePerUnitInUSD` is already per unit — see rule 1 above. A title's
    // "5x" is NOT a divisor (measured on 94 live Steal an Egg listings).
    if (price < policy.minUnitUsd) {
      droppedFakeCheap += 1
      continue
    }
    listings.push({
      itemId: row.matched_item_id,
      variant: 'default',
      priceUsd: price,
      reviews: toNumber(row.seller_reviews),
    })
  }

  let placeholdersDropped = 0
  if (policy.placeholderHighRatio != null) {
    const trimmed = dropPlaceholderHighs(listings, policy.placeholderHighRatio)
    listings = trimmed.kept
    placeholdersDropped = trimmed.dropped
  }

  // The adapter reports `reputableCount` (listings that survived its
  // fake-cheap cut) — that, not the raw listing count, is the evidence.
  const all = [...computeReputablePrices(listings).values()].filter((r) => r.variant === 'default')
  const priced = all.filter((r) => r.reputableCount >= MIN_EVIDENCE)

  const spanByItem = new Map<string, { low: number; high: number }>()
  for (const l of listings) {
    const price = l.priceUsd
    if (price == null || !Number.isFinite(price) || price <= 0) continue
    const span = spanByItem.get(l.itemId)
    if (!span) spanByItem.set(l.itemId, { low: price, high: price })
    else {
      if (price < span.low) span.low = price
      if (price > span.high) span.high = price
    }
  }

  return {
    listings,
    priced,
    spanByItem,
    skippedUnpriceable,
    droppedFakeCheap,
    placeholdersDropped,
    suppressed: all.length - priced.length,
  }
}

/**
 * `options.full` is accepted for registry parity but not yet acted on: these
 * games read a few thousand rows, far inside budget. Add incremental writes
 * the same way SAB does it if that changes.
 */
export async function runValuesPipelineCorrection(
  gameSlug: string,
  options: RepriceOptions = {},
  policy: ValuesPricingPolicy = STEAL_AN_EGG_POLICY,
): Promise<RepriceResult> {
  const admin = createServiceRoleClient()
  const startedAt = new Date().toISOString()

  const { data: game } = await (admin as any)
    .from('games')
    .select('id')
    .eq('slug', gameSlug)
    .maybeSingle()

  if (!game?.id) {
    return { game: gameSlug, skipped: 'game not found', startedAt }
  }

  const items = await selectAll<ItemRow>(
    admin,
    'values_items',
    'id,slug,kind,is_priced',
    'id',
    (q) => q.eq('game_id', game.id).eq('is_enabled', true),
  )
  const priceable = new Set(
    items.filter((i) => i.is_priced && !policy.unpricedKinds.includes(i.kind)).map((i) => i.id),
  )

  const since = new Date(Date.now() - FRESH_WINDOW_HOURS * 3600_000).toISOString()
  const rawRows = await selectAll<RawRow>(
    admin,
    'values_raw_listings',
    'id,matched_item_id,price_usd,quantity,seller_reviews,match_confidence',
    'id',
    (q) =>
      q
        .eq('game_id', game.id)
        .eq('is_active', true)
        .eq('parse_status', 'matched')
        .gte('observed_at', since),
  )

  const plan = planValuesPrices(rawRows, priceable, policy)
  const { listings, priced, spanByItem, skippedUnpriceable, droppedFakeCheap, placeholdersDropped } = plan

  // Read current values so `price_changed_at` only moves when the value moves.
  // A crawl that confirms the same price must NOT re-date the page, or every
  // value page would advertise a freshness it does not have.
  const existing = await selectAll<ExistingPriceRow>(
    admin,
    'values_prices',
    'item_id,cheapest_usd,average_usd,market_low_usd,market_high_usd,sample_size,confidence_label,price_changed_at',
    // values_prices has no surrogate `id`; item_id IS the primary key.
    'item_id',
    (q) => q.eq('game_id', game.id),
  )
  const prev = new Map(existing.map((r) => [r.item_id, r]))

  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const rows: Record<string, unknown>[] = []
  const historyRows: Record<string, unknown>[] = []
  const suppressed = plan.suppressed
  let unchanged = 0

  // `priced` already holds only default-variant results with >= MIN_EVIDENCE
  // reputable listings: publish nothing rather than a value one listing deep.
  for (const result of priced) {
    const before = prev.get(result.itemId)
    const moved =
      toNumber(before?.cheapest_usd ?? null) !== result.cheapestUsd ||
      toNumber(before?.average_usd ?? null) !== result.averageUsd

    const row = {
      item_id: result.itemId,
      game_id: game.id,
      cheapest_usd: result.cheapestUsd,
      average_usd: result.averageUsd,
      market_low_usd: spanByItem.get(result.itemId)?.low ?? null,
      market_high_usd: spanByItem.get(result.itemId)?.high ?? null,
      sample_size: result.reputableCount,
      source_count: policy.sourceCount,
      confidence_label: result.reputableCount >= 10 ? 'high' : 'low',
      price_changed_at: moved ? now : before?.price_changed_at ?? now,
      updated_at: now,
    }
    // Write only rows whose stored numbers differ (T1). A crawl that confirms
    // the same values does not rewrite the row; the daily history point
    // below still records it.
    if (before && sameStoredPrice(before, row)) unchanged += 1
    else {
      rows.push(row)
      prev.set(result.itemId, row)
    }
    historyRows.push({
      item_id: result.itemId,
      game_id: game.id,
      history_date: today,
      cheapest_usd: result.cheapestUsd,
      average_usd: result.averageUsd,
      sample_size: result.reputableCount,
    })
  }

  if (rows.length) {
    const { error } = await (admin as any)
      .from('values_prices')
      .upsert(rows, { onConflict: 'item_id' })
    if (error) throw new Error(`values_prices upsert: ${error.message}`)
  }

  // One history point per item per day — the charts plot a daily series and
  // IndexNow compares against the previous day's row, so this stays daily
  // even when the live row did not move (that is where a sub-threshold move
  // is kept).
  if (historyRows.length) {
    const { error: histError } = await (admin as any)
      .from('values_price_history')
      .upsert(historyRows, { onConflict: 'item_id,history_date' })
    if (histError) throw new Error(`values_price_history upsert: ${histError.message}`)
  }

  // Everything the item pages display after this run (T1 publish step):
  // rows this run did not touch keep their published value, so they count.
  const slugById = new Map(items.map((i) => [i.id, i.slug]))
  const publishedPrices: PublishedPrice[] = []
  for (const [itemId, r] of prev) {
    const slug = slugById.get(itemId)
    if (!slug) continue
    const cheapest = toNumber(r.cheapest_usd)
    const average = toNumber(r.average_usd)
    if (cheapest == null && average == null) continue
    publishedPrices.push({ itemSlug: slug, variant: 'default', prices: { cheapest, average } })
  }

  return {
    game: gameSlug,
    startedAt,
    finishedAt: new Date().toISOString(),
    rawListings: rawRows.length,
    pricedListings: listings.length,
    skippedUnpriceable,
    droppedFakeCheap,
    placeholdersDropped,
    itemsPriced: rows.length,
    itemsUnchanged: unchanged,
    itemsSuppressedForThinEvidence: suppressed,
    publishedPrices,
  }
}

type ExistingPriceRow = {
  item_id: string
  cheapest_usd: number | string | null
  average_usd: number | string | null
  market_low_usd?: number | string | null
  market_high_usd?: number | string | null
  sample_size?: number | string | null
  confidence_label?: string | null
  price_changed_at: string | null
}

const sameNumber = (a: unknown, b: unknown): boolean => {
  const x = toNumber(a as number | string | null)
  const y = toNumber(b as number | string | null)
  if (x == null || y == null) return x === y
  return Math.abs(x - y) < 1e-9
}

/** True when upserting `next` would leave every displayed column as it is. */
export function sameStoredPrice(
  before: ExistingPriceRow,
  next: Pick<
    ExistingPriceRow,
    'cheapest_usd' | 'average_usd' | 'market_low_usd' | 'market_high_usd' | 'sample_size' | 'confidence_label'
  >,
): boolean {
  return (
    sameNumber(before.cheapest_usd, next.cheapest_usd) &&
    sameNumber(before.average_usd, next.average_usd) &&
    sameNumber(before.market_low_usd ?? null, next.market_low_usd ?? null) &&
    sameNumber(before.market_high_usd ?? null, next.market_high_usd ?? null) &&
    sameNumber(before.sample_size ?? null, next.sample_size ?? null) &&
    (before.confidence_label ?? null) === (next.confidence_label ?? null)
  )
}
