import 'server-only'
import { createValueListReadClient } from '@/lib/values/read-client'
import { getCachedGridPrices } from '@/lib/sab/priceCache'
import type { BrainrotDirectoryItem, CardMutation } from './_sabListModel'

/**
 * Every Steal a Brainrot row for the value list. ONE loader for the page
 * (first page + A–Z index + JSON-LD) and for `/steal-a-brainrot/values/rows.json`
 * (the full list the client fetches; lib/values/lazy-list.ts), so the two can
 * never disagree. Reads through the tagged value readers.
 */

type DirectoryTradePriceRow = {
  brainrot_id: string
  market_value_usd: number | string | null
  /** Low/high of the real listings behind the value — the trust-signal range. */
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  /**
   * Reputable-seller prices: cheapest (lowest 100+ review listing) and average
   * (typical reputable price). When present these are the buyer-facing pair —
   * "Cheapest" + "Market price". Null until a row is priced by the reputable path.
   */
  cheapest_usd: number | string | null
  average_usd: number | string | null
  confidence_label: string | null
  is_trade_ready: boolean
  /** Observed listings/sales behind the price — our popularity signal. */
  external_sample_size: number | string | null
}

/**
 * Page through an entire table in 1000-row chunks. Supabase/PostgREST caps a
 * single select at 1000 rows, so `sab_brainrot_mutation_calculator` (~7k rows =
 * 498 brainrots × 14 mutations) silently returned only its first 1000 — which is
 * why most cards showed no mutation chip. A stable `.order()` keeps pages
 * gap-free. `build(query)` applies table-specific columns/filters to each page.
 */
async function selectAllRows<T>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error('selectAllRows:', error)
      break
    }
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE) break
  }
  return rows
}

export async function getSabBrainrots(): Promise<BrainrotDirectoryItem[]> {
  const supabase = createValueListReadClient('steal-a-brainrot')

  // Default-mutation prices + all priced mutations come from the cached, tagged
  // reader (sab_price_display, indexed → ~5ms). Tagged so the whole grid
  // refreshes the moment a crawl republishes; served from cache in between.
  const gridPricesPromise = getCachedGridPrices()

  const [
    brainrotResult,
    calculatorResult,
    popularityResult,
  ] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select(
        'id,name,slug,rarity,obtainability,base_income_per_second,image_url,display_price_usd,display_price_label,display_price_source,confidence_label',
      )
      .order('name', { ascending: true }),

    // Mutation display metadata (name, income multiplier, per-mutation income) for
    // every brainrot+mutation — drives the picker labels and the income line.
    // PAGINATED: ~7k rows (498 × 14) blow past PostgREST's 1000-row cap, which
    // previously truncated it so most cards showed no mutation chip.
    selectAllRows<{
      brainrot_id: string
      mutation_slug: string
      mutation_name: string | null
      income_multiplier: number | string | null
      calculated_income_per_second: number | string | null
    }>((from, to) =>
      (supabase as any)
        .from('sab_brainrot_mutation_calculator')
        .select(
          'brainrot_id,mutation_slug,mutation_name,income_multiplier,calculated_income_per_second',
        )
        .order('brainrot_id', { ascending: true })
        .range(from, to),
    ).then((data: unknown[]) => ({ data, error: null })),

    // Real marketplace popularity (Eldorado usePopularItems ranking). Read
    // straight from sab_brainrots so the hand-edited catalog view needn't change.
    // The Popular tab sorts by this; null-rank items sort after ranked ones.
    (supabase as any)
      .from('sab_brainrots')
      .select('id,popularity_rank')
      .not('popularity_rank', 'is', null),
  ])

  const { defaults: defaultPriceRows, mutations: mutationPriceRows } =
    await gridPricesPromise

  if (brainrotResult.error) {
    console.error(
      'Unable to load SAB values directory:',
      brainrotResult.error,
    )
    return []
  }

  const priceByBrainrot = new Map(
    (defaultPriceRows as DirectoryTradePriceRow[])
      .filter(
        (row) =>
          row.market_value_usd != null &&
          Number.isFinite(Number(row.market_value_usd)),
      )
      .map((row) => [row.brainrot_id, row]),
  )

  const rankByBrainrot = new Map(
    ((popularityResult?.data ?? []) as { id: string; popularity_rank: number }[])
      .map((row) => [row.id, row.popularity_rank] as const),
  )

  // Per-mutation prices (real cheapest/average) keyed by brainrot then slug.
  const mutationPriceByBrainrot = new Map<
    string,
    Map<string, { cheapest_usd: number | null; average_usd: number | null }>
  >()
  for (const row of mutationPriceRows as {
    brainrot_id: string
    mutation_slug: string
    cheapest_usd: number | string | null
    average_usd: number | string | null
  }[]) {
    const inner = mutationPriceByBrainrot.get(row.brainrot_id) ?? new Map()
    inner.set(row.mutation_slug, {
      cheapest_usd: row.cheapest_usd != null ? Number(row.cheapest_usd) : null,
      average_usd: row.average_usd != null ? Number(row.average_usd) : null,
    })
    mutationPriceByBrainrot.set(row.brainrot_id, inner)
  }

  // Mutation display metadata (name, multiplier, income) keyed by brainrot+slug.
  const mutationMetaByBrainrot = new Map<
    string,
    Map<
      string,
      { name: string; multiplier: number | null; income: number | null }
    >
  >()
  for (const row of (calculatorResult?.data ?? []) as {
    brainrot_id: string
    mutation_slug: string
    mutation_name: string | null
    income_multiplier: number | string | null
    calculated_income_per_second: number | string | null
  }[]) {
    const inner = mutationMetaByBrainrot.get(row.brainrot_id) ?? new Map()
    inner.set(row.mutation_slug, {
      name: row.mutation_name ?? row.mutation_slug,
      multiplier:
        row.income_multiplier != null ? Number(row.income_multiplier) : null,
      income:
        row.calculated_income_per_second != null
          ? Number(row.calculated_income_per_second)
          : null,
    })
    mutationMetaByBrainrot.set(row.brainrot_id, inner)
  }

  /**
   * Build the card's mutation list: EVERY mutation the item has metadata for,
   * carrying its real cheapest/average when priced (null → the card shows "No
   * Sales" for that mutation; we never estimate). Ordered by income multiplier
   * so Default leads and premiums ascend.
   */
  const buildMutations = (brainrotId: string): CardMutation[] => {
    const meta = mutationMetaByBrainrot.get(brainrotId)
    if (!meta) return []
    const prices = mutationPriceByBrainrot.get(brainrotId)
    return [...meta.entries()]
      .map(([slug, m]) => ({
        slug,
        name: m.name,
        multiplier: m.multiplier,
        income: m.income,
        cheapest_usd: prices?.get(slug)?.cheapest_usd ?? null,
        average_usd: prices?.get(slug)?.average_usd ?? null,
      }))
      .sort((a, b) => (a.multiplier ?? 0) - (b.multiplier ?? 0))
  }

  return (
    (brainrotResult.data ?? []) as BrainrotDirectoryItem[]
  ).map((brainrot) => {
    const price = priceByBrainrot.get(brainrot.id)
    const popularityRank = rankByBrainrot.get(brainrot.id) ?? null
    const mutations = buildMutations(brainrot.id)

    if (!price) return { ...brainrot, popularity_rank: popularityRank, mutations }

    return {
      ...brainrot,
      popularity_rank: popularityRank,
      mutations,
      display_price_usd: Number(price.market_value_usd),
      display_price_label: 'Average Current Market Price',
      display_price_source: 'public_market_estimate',
      confidence_label:
        price.confidence_label ?? brainrot.confidence_label,
      // The real-listings range behind the value — shown on the row as a trust
      // signal ("real listings $613–$799"), proving the headline value is
      // grounded in actual market data rather than a community guess. These come
      // straight from the corrected view, which already fences out fakes/stale
      // listings, so no extra trust logic is needed here.
      market_low_usd:
        price.market_low_usd != null ? Number(price.market_low_usd) : null,
      market_high_usd:
        price.market_high_usd != null ? Number(price.market_high_usd) : null,
      // Reputable cheapest + average — the buyer-facing "Cheapest" + "Market
      // price" pair. Null until the reputable path prices this row.
      cheapest_usd:
        price.cheapest_usd != null ? Number(price.cheapest_usd) : null,
      average_usd:
        price.average_usd != null ? Number(price.average_usd) : null,
      // How many real listings/sales we observed for this item. The only
      // popularity signal we actually hold — our own marketplace counts
      // (active_listing_count etc.) are still all zero.
      sample_size: Number(price.external_sample_size ?? 0),
    }
  })
}
