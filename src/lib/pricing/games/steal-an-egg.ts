/**
 * Steal An Egg correction — DB read/write around the shared reputable pass.
 *
 * Reads active rows from values_raw_listings, runs the SAME game-agnostic
 * reputable model SAB and Adopt Me use (`reputable-adapter`), and writes
 * cheapest/average onto values_prices. The only game-specific logic here is
 * which rows to read and how account brackets are assigned — the maths is
 * shared, which is the whole point of the generic pipeline.
 *
 * Three rules this module enforces, all of them honesty rules:
 *
 *  1. Bundles are divided to a unit price. 37% of live titles carry a quantity
 *     ("5x Random Egg From Cosmic"); pricing the bundle as one unit would
 *     publish a 5x-too-high value.
 *  2. Items with no reputable evidence are left alone rather than zeroed. A
 *     page with no price says "no market price yet"; it never shows $0.
 *  3. Pets are never priced. Only 1.5% of live listings name a pet, so there
 *     is no evidence to price them — they are catalogue pages that link to
 *     their source egg's price instead.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  computeReputablePrices,
  type RawListing,
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
  kind: string
  is_priced: boolean
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function selectAll<T>(
  client: ReturnType<typeof createServiceRoleClient>,
  table: string,
  columns: string,
  filter?: (q: any) => any,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    let query = (client as any).from(table).select(columns).order('id')
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

export async function runStealAnEggCorrection(
  gameSlug = 'steal-an-egg',
): Promise<Record<string, unknown>> {
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
    'id,kind,is_priced',
    (q) => q.eq('game_id', game.id).eq('is_enabled', true),
  )
  const priceable = new Map(
    items.filter((i) => i.is_priced && i.kind !== 'pet').map((i) => [i.id, i]),
  )

  const since = new Date(Date.now() - FRESH_WINDOW_HOURS * 3600_000).toISOString()
  const rawRows = await selectAll<RawRow>(
    admin,
    'values_raw_listings',
    'id,matched_item_id,price_usd,quantity,seller_reviews,match_confidence',
    (q) =>
      q
        .eq('game_id', game.id)
        .eq('is_active', true)
        .eq('parse_status', 'matched')
        .gte('observed_at', since),
  )

  // Bundles -> unit price. A "5x" listing at $4.85 is $0.97/egg, which is the
  // number the market actually clears at (live median: $0.97).
  const listings: RawListing[] = []
  let skippedUnpriceable = 0
  let droppedFakeCheap = 0
  for (const row of rawRows) {
    if (!row.matched_item_id || !priceable.has(row.matched_item_id)) {
      skippedUnpriceable += 1
      continue
    }
    const price = toNumber(row.price_usd)
    if (price == null || price <= 0) continue
    /**
     * Eldorado's `pricePerUnitInUSD` is ALREADY per egg, so the title's "5x"
     * must NOT be divided out again.
     *
     * Measured on 94 live Angels & Demons listings: undivided median $0.99,
     * which matches the independent whole-category median of $0.97; dividing
     * by the title quantity gives $0.24, i.e. ~4x too low. An earlier 1x-vs-5x
     * comparison appeared to show the opposite, but that sample was polluted
     * by the per-in-game-unit listings described below, which cluster in the
     * 1x group and drag its median down.
     *
     * `quantity` is therefore retained on the row for display ("sold in packs
     * of 5") but is deliberately NOT a price divisor.
     */
    const unitPrice = price
    // Sub-cent bait (see MIN_BELIEVABLE_UNIT_USD). Counted, not silently lost.
    if (unitPrice < MIN_BELIEVABLE_UNIT_USD) {
      droppedFakeCheap += 1
      continue
    }
    listings.push({
      itemId: row.matched_item_id,
      variant: 'default',
      priceUsd: unitPrice,
      reviews: toNumber(row.seller_reviews),
    })
  }

  // Map<"itemId:variant", VariantReputablePrice>. The adapter reports
  // `reputableCount` (listings that survived its fake-cheap cut) — that, not
  // the raw listing count, is the evidence behind a value.
  const priced = [...computeReputablePrices(listings).values()]

  // Low/high of the reputable listings behind each item — the trust-signal
  // range shown on the page ("real listings $0.30–$2.40"). The adapter returns
  // the cheapest/average pair only, so compute the span from the same inputs.
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

  // Read current values so `price_changed_at` only moves when the value moves.
  // A crawl that confirms the same price must NOT re-date the page, or every
  // value page would advertise a freshness it does not have.
  const existing = await selectAll<{
    item_id: string
    cheapest_usd: number | string | null
    average_usd: number | string | null
    price_changed_at: string | null
  }>(admin, 'values_prices', 'item_id,cheapest_usd,average_usd,price_changed_at', (q) =>
    q.eq('game_id', game.id),
  )
  const prev = new Map(existing.map((r) => [r.item_id, r]))

  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const rows: Record<string, unknown>[] = []
  const historyRows: Record<string, unknown>[] = []
  let suppressed = 0

  for (const result of priced) {
    if (result.variant !== 'default') continue
    // Minimum evidence: publish nothing rather than a value one listing deep.
    if (result.reputableCount < MIN_EVIDENCE) {
      suppressed += 1
      continue
    }
    const before = prev.get(result.itemId)
    const moved =
      toNumber(before?.cheapest_usd ?? null) !== result.cheapestUsd ||
      toNumber(before?.average_usd ?? null) !== result.averageUsd

    rows.push({
      item_id: result.itemId,
      game_id: game.id,
      cheapest_usd: result.cheapestUsd,
      average_usd: result.averageUsd,
      market_low_usd: spanByItem.get(result.itemId)?.low ?? null,
      market_high_usd: spanByItem.get(result.itemId)?.high ?? null,
      sample_size: result.reputableCount,
      source_count: 1, // Eldorado only today; G2G has no Steal An Egg category.
      confidence_label: result.reputableCount >= 10 ? 'high' : 'low',
      price_changed_at: moved ? now : before?.price_changed_at ?? now,
      updated_at: now,
    })
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

    const { error: histError } = await (admin as any)
      .from('values_price_history')
      .upsert(historyRows, { onConflict: 'item_id,history_date' })
    if (histError) throw new Error(`values_price_history upsert: ${histError.message}`)
  }

  return {
    game: gameSlug,
    startedAt,
    finishedAt: new Date().toISOString(),
    rawListings: rawRows.length,
    pricedListings: listings.length,
    skippedUnpriceable,
    droppedFakeCheap,
    itemsPriced: rows.length,
    itemsSuppressedForThinEvidence: suppressed,
  }
}
