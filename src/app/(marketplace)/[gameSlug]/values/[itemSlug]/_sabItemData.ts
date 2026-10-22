/**
 * Steal a Brainrot item data: the row shapes, number formatters and the reads
 * behind /steal-a-brainrot/values/[itemSlug]. Every read goes through the
 * ITEM's read client, so it carries this item's tags (values:<game> +
 * price:<game>:<item>) and a price crawl refreshes exactly these responses.
 */
import { createValueItemReadClient } from '@/lib/values/read-client'
import { selectAllByKey } from '@/lib/db/select-all-by-key'
import type { MutationOption } from './_ItemHero'

/** The game the sab_* tables price — the tag game of every SAB read below. */
export const SAB_GAME = 'steal-a-brainrot'

export type BrainrotRow = {
  id: string
  name: string
  slug: string
  rarity: string
  obtainability: string
  base_income_per_second: number | string | null
  ingame_cost: number | string | null
  image_url: string | null
  image_alt: string
  source_url: string | null
  cheapest_active_price_usd: number | string | null
  market_value_usd: number | string | null
  quick_sale_usd: number | string | null
  patient_sale_usd: number | string | null
  active_listing_count: number
  completed_sale_count: number
  unique_seller_count: number
  confidence_label: string
  display_price_usd: number | string | null
  display_price_label: string
  display_price_source: string
  price_updated_at: string | null
}

type MutationRow = {
  mutation_slug: string
  mutation_name: string
  income_multiplier: number | string
  mutation_availability: string
  calculated_income_per_second: number | string | null
  income_source: string
  is_verified_variant: boolean
}

type TradePriceRow = {
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
  confidence_label: string
  external_sample_size: number
  price_updated_at: string | null
  is_trade_ready: boolean
}

type MutationMarketPriceRow = {
  mutation_slug: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
  confidence_label: string
  external_sample_size: number
  price_updated_at: string | null
  is_trade_ready: boolean
}

/** Measured market premium per mutation — see sab_mutation_price_multipliers. */
type MutationPriceMultiplierRow = {
  mutation_slug: string
  price_multiplier: number | string
}

export function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatMoney(value: number | string | null | undefined): string | null {
  const amount = asNumber(value)
  if (amount == null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatIncome(value: number | string | null | undefined): string {
  const amount = asNumber(value)
  if (amount == null) return 'Unknown'

  return `${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount)}/s`
}

/** In-game currency cost, compact — "$250B" not "$250,000,000,000". */
export function formatIngameCost(value: number | string | null | undefined): string | null {
  const amount = asNumber(value)
  if (amount == null) return null
  return `$${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(amount)}`
}

export function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function getBrainrot(slug: string): Promise<BrainrotRow | null> {
  const supabase = createValueItemReadClient(SAB_GAME, slug)
  const { data, error } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    // STATE-012 — explicit columns, exactly the BrainrotRow contract above.
    .select(
      'id,name,slug,rarity,obtainability,base_income_per_second,ingame_cost,image_url,image_alt,source_url,cheapest_active_price_usd,market_value_usd,quick_sale_usd,patient_sale_usd,active_listing_count,completed_sale_count,unique_seller_count,confidence_label,display_price_usd,display_price_label,display_price_source,price_updated_at',
    )
    .eq('slug', slug)
    .maybeSingle()

  // A read error throws, never a 404 (ISR would cache it for 7 days — 2026-10-20 outage).
  if (error) throw new Error(`sab_brainrot_market_catalog read failed: ${error.message ?? String(error)}`)

  return (data as BrainrotRow | null) ?? null
}

export async function getDefaultTradePrice(
  itemSlug: string,
  brainrotId: string,
): Promise<TradePriceRow | null> {
  const supabase = createValueItemReadClient(SAB_GAME, itemSlug)
  const { data, error } = await (supabase as any)
    .from('sab_price_display')
    .select(
      'market_value_usd,market_low_usd,market_high_usd,cheapest_usd,average_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
    )
    .eq('brainrot_id', brainrotId)
    .eq('mutation_slug', 'default')
    .maybeSingle()

  if (error) {
    console.error('Unable to load default mutation market price:', error)
    return null
  }

  return (data as TradePriceRow | null) ?? null
}

export async function getMutations(itemSlug: string, brainrotId: string): Promise<MutationOption[]> {
  const supabase = createValueItemReadClient(SAB_GAME, itemSlug)

  // Fetch mutation income data, per-mutation market prices, and the measured
  // mutation price premiums in parallel, then merge so each mutation carries
  // its real USD market value (not just income).
  const [calculatorResult, pricesResult, multiplierResult] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_mutation_calculator')
      .select(
        'mutation_slug,mutation_name,income_multiplier,mutation_availability,calculated_income_per_second,income_source,is_verified_variant',
      )
      .eq('brainrot_id', brainrotId)
      .order('income_multiplier', { ascending: true }),
    (supabase as any)
      .from('sab_price_display')
      .select(
        'mutation_slug,market_value_usd,market_low_usd,market_high_usd,cheapest_usd,average_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
      )
      .eq('brainrot_id', brainrotId),
    (supabase as any)
      .from('sab_mutation_price_multipliers')
      .select('mutation_slug,price_multiplier'),
  ])

  if (calculatorResult.error) {
    console.error('Unable to load Brainrot mutations:', calculatorResult.error)
    return []
  }

  if (pricesResult.error) {
    console.error('Unable to load Brainrot mutation prices:', pricesResult.error)
  }

  const priceBySlug = new Map<string, MutationMarketPriceRow>(
    ((pricesResult.data ?? []) as MutationMarketPriceRow[]).map((row) => [
      row.mutation_slug,
      row,
    ]),
  )

  const rows = (calculatorResult.data ?? []) as MutationRow[]

  /**
   * MEASURED price premium per mutation, not the income multiplier.
   *
   * This used to scale the default price by the mutation's INCOME multiplier,
   * which badly overstated high-tier mutations: measured across 1,155
   * well-sampled variant/default pairs, the market premium saturates around
   * 2.5-3.5x however high income scales (Rainbow is 10x income but ~3.0x
   * price). A Rainbow estimate was therefore roughly threefold too high.
   *
   * The table is refreshed daily by /api/cron/correct-prices. If it hasn't
   * been populated yet we fall back to the old income-multiplier behaviour
   * rather than showing nothing.
   */
  const priceMultiplierBySlug = new Map<string, number>(
    ((multiplierResult?.data ?? []) as MutationPriceMultiplierRow[]).map(
      (row) => [row.mutation_slug, Number(row.price_multiplier)],
    ),
  )

  // Anchor for the fallback estimate: the default mutation's real price and
  // multiplier. When a mutation has NO market listings, we scale the default
  // price by the measured premium so the page still shows a number (clearly
  // flagged as estimated) — anything beats a blank.
  const defaultRow = rows.find((r) => r.mutation_slug === 'default')
  const defaultPrice = asNumber(
    priceBySlug.get('default')?.market_value_usd ?? null,
  )
  const defaultMultiplier = Number(defaultRow?.income_multiplier) || 1

  return rows.map((row) => {
    const price = priceBySlug.get(row.mutation_slug)
    const realValue = asNumber(price?.market_value_usd ?? null)

    // Derive an estimate only when there's no real value, we have a default
    // anchor, and this isn't the default itself.
    let estimatedValue: number | null = null
    if (realValue == null && defaultPrice != null && row.mutation_slug !== 'default') {
      const ratio =
        priceMultiplierBySlug.get(row.mutation_slug) ??
        Number(row.income_multiplier) / defaultMultiplier
      if (Number.isFinite(ratio) && ratio > 0) {
        estimatedValue = Math.round(defaultPrice * ratio * 100) / 100
      }
    }

    return {
      slug: row.mutation_slug,
      name: row.mutation_name,
      multiplier: Number(row.income_multiplier),
      availability: row.mutation_availability,
      calculatedIncomePerSecond: asNumber(row.calculated_income_per_second),
      incomeSource: row.income_source,
      isVerifiedVariant: row.is_verified_variant,
      marketValueUsd: realValue ?? estimatedValue,
      marketLowUsd: asNumber(price?.market_low_usd ?? null),
      marketHighUsd: asNumber(price?.market_high_usd ?? null),
      cheapestUsd: asNumber(price?.cheapest_usd ?? null),
      averageUsd: asNumber(price?.average_usd ?? null),
      marketConfidenceLabel: price?.confidence_label ?? null,
      marketSampleSize: price?.external_sample_size ?? 0,
      marketUpdatedAt: price?.price_updated_at ?? null,
      isEstimated: realValue == null && estimatedValue != null,
    }
  })
}

// Daily price history per mutation, for the trend chart. Resilient: returns an
// empty map if the table isn't present yet (migration not applied) or on error,
// so the page renders fine before history exists — the chart shows a
// "collecting history" state in that case.
export async function getPriceHistory(
  itemSlug: string,
  brainrotId: string,
): Promise<Record<string, { date: string; median: number }[]>> {
  const supabase = createValueItemReadClient(SAB_GAME, itemSlug)
  // The WHOLE history (the chart has an "All" range), by keyset on the unique
  // (history_date, mutation_id) within this brainrot. One unlimited request was
  // capped at 1,000 rows oldest-first, so after ~71 days × 14 mutations the
  // newest days fell off the chart (2026-10-20 usage audit).
  let data: any[]
  try {
    data = await selectAllByKey<any>(supabase, {
      table: 'sab_price_history',
      columns: 'history_date,median_usd,mutation_id,sab_mutations(slug)',
      key: ['history_date', 'mutation_id'],
      filter: (q) => q.eq('brainrot_id', brainrotId),
    })
  } catch {
    return {}
  }

  const bySlug: Record<string, { date: string; median: number }[]> = {}
  for (const row of data) {
    const slug = row.sab_mutations?.slug
    const median = asNumber(row.median_usd)
    if (!slug || median == null) continue
    ;(bySlug[slug] = bySlug[slug] ?? []).push({ date: row.history_date, median })
  }
  return bySlug
}

export async function getRelatedBrainrots(brainrot: BrainrotRow): Promise<Array<BrainrotRow & { compare_usd?: number | null }>> {
  // Read on this item's page → this item's tags, never the game list tag.
  const supabase = createValueItemReadClient(SAB_GAME, brainrot.slug)
  const { data } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    .select('id,name,slug,rarity,image_url,display_price_usd,display_price_label,base_income_per_second,ingame_cost')
    .eq('rarity', brainrot.rarity)
    .neq('id', brainrot.id)
    .order('name', { ascending: true })
    .limit(24)

  const rows = (data ?? []) as BrainrotRow[]
  if (rows.length === 0) return rows

  // display_price_usd only reflects verified trade-ready prices (often null).
  // Pull the real default cash value from the public catalog so cards show a
  // price instead of "pending", matching what the item page displays.
  const { data: prices } = await (supabase as any)
    .from('sab_price_display')
    .select('brainrot_id,market_value_usd,average_usd')
    .eq('mutation_slug', 'default')
    .in(
      'brainrot_id',
      rows.map((r) => r.id),
    )

  const priceRows = (prices ?? []) as Array<{ brainrot_id: string; market_value_usd: number | string | null; average_usd: number | string | null }>
  const priceById = new Map<string, number | string | null>(priceRows.map((p) => [p.brainrot_id, p.market_value_usd]))
  // The compare section's price: the reputable average first, like the page's own headline.
  const compareById = new Map<string, number | null>(priceRows.map((p) => [p.brainrot_id, asNumber(p.average_usd) ?? asNumber(p.market_value_usd)]))

  return rows
    .map((r) => ({ ...r, display_price_usd: priceById.get(r.id) ?? r.display_price_usd, compare_usd: compareById.get(r.id) ?? null }))
    .sort((a, b) => (asNumber(b.display_price_usd) ?? 0) - (asNumber(a.display_price_usd) ?? 0))
    // 20 sibling links (was 12): a denser related-items block is the strongest
    // internal-link-mesh lever competitors (Rolimons) use — every item page
    // feeds keyword-rich links to 20 others, spreading crawl + equity.
    .slice(0, 20)
}

/** A brainrot with the price the compare section uses: the reputable average, else the market value. */
export type ComparableBrainrot = Pick<BrainrotRow, 'id' | 'name' | 'slug' | 'rarity' | 'image_url' | 'base_income_per_second' | 'ingame_cost'> & {
  compare_usd: number | null
}

/**
 * Brainrots priced near `refUsd` (within 1.6×, any rarity) for "Worth About
 * the Same". Two small reads under THIS item's tags: the default-mutation
 * prices in the band, then those brainrots' catalogue rows.
 */
export async function getBrainrotsNearValue(brainrot: BrainrotRow, refUsd: number | null): Promise<ComparableBrainrot[]> {
  if (refUsd == null || !(refUsd > 0)) return []
  const supabase = createValueItemReadClient(SAB_GAME, brainrot.slug)
  const { data: prices, error } = await (supabase as any)
    .from('sab_price_display')
    .select('brainrot_id,market_value_usd,average_usd')
    .eq('mutation_slug', 'default')
    .neq('brainrot_id', brainrot.id)
    .gte('market_value_usd', refUsd / 1.6)
    .lte('market_value_usd', refUsd * 1.6)
    .limit(40)
  if (error || !prices?.length) return []
  const priceById = new Map<string, number | null>(
    (prices as Array<{ brainrot_id: string; market_value_usd: number | string | null; average_usd: number | string | null }>).map((p) => [
      p.brainrot_id,
      asNumber(p.average_usd) ?? asNumber(p.market_value_usd),
    ]),
  )
  const { data: rows } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    .select('id,name,slug,rarity,image_url,base_income_per_second,ingame_cost')
    .in('id', [...priceById.keys()])
  return ((rows ?? []) as ComparableBrainrot[]).map((r) => ({ ...r, compare_usd: priceById.get(r.id) ?? null }))
}
