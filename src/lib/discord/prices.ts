/**
 * Price reads for the Discord bot.
 *
 * Reads `sab_public_price_catalog_corrected` — the same view the value pages
 * use — so the bot and the site can never quote different numbers for the same
 * item. Estimated mutations are derived with the MEASURED premiums from
 * `sab_mutation_price_multipliers`, not income multipliers, matching the fix
 * applied to the item page.
 */

import { asNumber } from '@/lib/sab/format'
import { botSupabase } from './supabase'

export type VariantPrice = {
  mutationSlug: string
  mutationName: string
  valueUsd: number | null
  lowUsd: number | null
  highUsd: number | null
  confidence: string | null
  sampleSize: number
  sourceCount: number
  updatedAt: string | null
  /** Derived from the default price rather than measured for this mutation. */
  isEstimated: boolean
  /** The correction layer replaced a thin/absurd price with a peer anchor. */
  isAnchored: boolean
  /** This mutation's income/sec (base × mutation multiplier), null if unknown. */
  incomePerSecond: number | null
}

export type BrainrotPricing = {
  id: string
  name: string
  slug: string
  rarity: string | null
  imageUrl: string | null
  incomePerSecond: number | null
  mutations: VariantPrice[]
  defaultPrice: VariantPrice | null
}

const CATALOG_COLUMNS =
  'brainrot_id,brainrot_name,brainrot_slug,rarity,image_url,mutation_id,mutation_name,mutation_slug,market_value_usd,market_low_usd,market_high_usd,confidence_label,external_sample_size,source_count,price_updated_at,is_anchored'

type CatalogRow = {
  brainrot_id: string
  brainrot_name: string
  brainrot_slug: string
  rarity: string | null
  image_url: string | null
  mutation_id: string
  mutation_name: string
  mutation_slug: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  confidence_label: string | null
  external_sample_size: number | null
  source_count: number | null
  price_updated_at: string | null
  is_anchored: boolean | null
}

const MULTIPLIER_TTL_MS = 10 * 60 * 1000

let multiplierCache: { values: Map<string, number>; loadedAt: number } | null =
  null

/** Measured mutation premiums, refreshed daily by the correction cron. */
async function getMeasuredMultipliers(): Promise<Map<string, number>> {
  if (multiplierCache && Date.now() - multiplierCache.loadedAt < MULTIPLIER_TTL_MS) {
    return multiplierCache.values
  }

  const { data, error } = await botSupabase()
    .from('sab_mutation_price_multipliers')
    .select('mutation_slug,price_multiplier')

  if (error) {
    console.error('Discord bot could not load mutation multipliers:', error)
    // An empty map means variants without a real price are simply omitted,
    // which is preferable to reviving the income-multiplier estimate that
    // overstated high-tier mutations roughly threefold.
    return multiplierCache?.values ?? new Map()
  }

  const values = new Map<string, number>()

  for (const row of (data ?? []) as {
    mutation_slug: string
    price_multiplier: number | string
  }[]) {
    const multiplier = Number(row.price_multiplier)
    if (Number.isFinite(multiplier) && multiplier > 0) {
      values.set(row.mutation_slug, multiplier)
    }
  }

  multiplierCache = { values, loadedAt: Date.now() }
  return values
}

function toVariant(row: CatalogRow): VariantPrice {
  return {
    mutationSlug: row.mutation_slug,
    mutationName: row.mutation_name,
    valueUsd: asNumber(row.market_value_usd),
    lowUsd: asNumber(row.market_low_usd),
    highUsd: asNumber(row.market_high_usd),
    confidence: row.confidence_label,
    sampleSize: row.external_sample_size ?? 0,
    sourceCount: row.source_count ?? 0,
    updatedAt: row.price_updated_at,
    isEstimated: false,
    isAnchored: Boolean(row.is_anchored),
    incomePerSecond: null,
  }
}

/**
 * Everything needed to render one Brainrot, including mutations that have no
 * listings of their own (derived from the default price and flagged).
 */
export async function getBrainrotPricing(
  slug: string,
): Promise<BrainrotPricing | null> {
  const supabase = botSupabase()

  const [catalogResult, metaResult, incomeResult, multipliers] =
    await Promise.all([
      supabase
        .from('sab_public_price_catalog_corrected')
        .select(CATALOG_COLUMNS)
        .eq('brainrot_slug', slug),
      supabase
        .from('sab_brainrot_market_catalog')
        .select('id,name,slug,rarity,image_url,base_income_per_second')
        .eq('slug', slug)
        .maybeSingle(),
      // Per-mutation income (base × multiplier), so a Radioactive shows its own
      // income, not the base — resolved by slug below.
      supabase
        .from('sab_brainrot_mutation_calculator')
        .select('brainrot_slug,mutation_slug,calculated_income_per_second')
        .eq('brainrot_slug', slug),
      getMeasuredMultipliers(),
    ])

  if (catalogResult.error) {
    console.error('Discord bot price lookup failed:', catalogResult.error)
    return null
  }

  const incomeBySlug = new Map<string, number>()
  for (const row of (incomeResult.data ?? []) as {
    mutation_slug: string
    calculated_income_per_second: number | string | null
  }[]) {
    const income = asNumber(row.calculated_income_per_second)
    if (income != null) incomeBySlug.set(row.mutation_slug, income)
  }

  const rows = (catalogResult.data ?? []) as CatalogRow[]
  const meta = metaResult.data as {
    id: string
    name: string
    slug: string
    rarity: string | null
    image_url: string | null
    base_income_per_second: number | string | null
  } | null

  if (!rows.length && !meta) return null

  const priced = rows.map(toVariant)
  const defaultPrice =
    priced.find((variant) => variant.mutationSlug === 'default') ?? null

  // Derive the mutations that have no listings of their own. Only possible
  // with a default anchor — without one there is nothing honest to scale.
  const seen = new Set(priced.map((variant) => variant.mutationSlug))
  const derived: VariantPrice[] = []

  if (defaultPrice?.valueUsd != null) {
    for (const [mutationSlug, multiplier] of multipliers) {
      if (seen.has(mutationSlug)) continue
      derived.push({
        mutationSlug,
        mutationName: mutationSlug
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        valueUsd: Math.round(defaultPrice.valueUsd * multiplier * 100) / 100,
        lowUsd: null,
        highUsd: null,
        confidence: 'low',
        sampleSize: 0,
        sourceCount: 0,
        updatedAt: defaultPrice.updatedAt,
        isEstimated: true,
        isAnchored: false,
        incomePerSecond: incomeBySlug.get(mutationSlug) ?? null,
      })
    }
  }

  // Stamp each priced variant with its own mutation income.
  for (const variant of priced) {
    variant.incomePerSecond = incomeBySlug.get(variant.mutationSlug) ?? null
  }

  const mutations = [...priced, ...derived].sort(
    (left, right) => (right.valueUsd ?? 0) - (left.valueUsd ?? 0),
  )

  const first = rows[0]

  return {
    id: meta?.id ?? first?.brainrot_id ?? '',
    name: meta?.name ?? first?.brainrot_name ?? slug,
    slug: meta?.slug ?? first?.brainrot_slug ?? slug,
    rarity: meta?.rarity ?? first?.rarity ?? null,
    imageUrl: meta?.image_url ?? first?.image_url ?? null,
    incomePerSecond: asNumber(meta?.base_income_per_second ?? null),
    mutations,
    defaultPrice,
  }
}

export type PricedItem = {
  slug: string
  name: string
  rarity: string | null
  mutationSlug: string
  mutationName: string
  valueUsd: number | null
  isEstimated: boolean
  isAnchored: boolean
}

/**
 * Price several (Brainrot, mutation) pairs in ONE round trip — /wfl compares
 * whole trade sides, and a query per item would blow the interaction budget.
 */
export async function getPricesForSlugs(
  slugs: string[],
): Promise<Map<string, CatalogRow[]>> {
  const unique = [...new Set(slugs)].filter(Boolean)
  const grouped = new Map<string, CatalogRow[]>()

  if (!unique.length) return grouped

  const { data, error } = await botSupabase()
    .from('sab_public_price_catalog_corrected')
    .select(CATALOG_COLUMNS)
    .in('brainrot_slug', unique)

  if (error) {
    console.error('Discord bot batch price lookup failed:', error)
    return grouped
  }

  for (const row of (data ?? []) as CatalogRow[]) {
    const list = grouped.get(row.brainrot_slug)
    if (list) list.push(row)
    else grouped.set(row.brainrot_slug, [row])
  }

  return grouped
}

/** Resolve one (Brainrot, mutation) pair to a price, deriving when needed. */
export async function resolveVariantPrice(
  rows: CatalogRow[] | undefined,
  mutationSlug: string,
): Promise<VariantPrice | null> {
  if (!rows?.length) return null

  const exact = rows.find((row) => row.mutation_slug === mutationSlug)
  if (exact) return toVariant(exact)

  const base = rows.find((row) => row.mutation_slug === 'default')
  if (!base) return null

  const baseVariant = toVariant(base)
  if (baseVariant.valueUsd == null) return null

  const multipliers = await getMeasuredMultipliers()
  const multiplier = multipliers.get(mutationSlug)
  if (!multiplier) return null

  return {
    ...baseVariant,
    mutationSlug,
    mutationName: mutationSlug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    valueUsd: Math.round(baseVariant.valueUsd * multiplier * 100) / 100,
    lowUsd: null,
    highUsd: null,
    isEstimated: true,
  }
}

/** Highest-value Brainrots, optionally within one rarity. */
export async function getTopValues(
  rarity: string | null,
  limit: number,
): Promise<PricedItem[]> {
  let query = botSupabase()
    .from('sab_public_price_catalog_corrected')
    .select(CATALOG_COLUMNS)
    .eq('mutation_slug', 'default')
    .order('market_value_usd', { ascending: false })
    .limit(limit)

  if (rarity) query = query.eq('rarity', rarity)

  const { data, error } = await query

  if (error) {
    console.error('Discord bot top-values lookup failed:', error)
    return []
  }

  return ((data ?? []) as CatalogRow[]).map((row) => ({
    slug: row.brainrot_slug,
    name: row.brainrot_name,
    rarity: row.rarity,
    mutationSlug: row.mutation_slug,
    mutationName: row.mutation_name,
    valueUsd: asNumber(row.market_value_usd),
    isEstimated: false,
    isAnchored: Boolean(row.is_anchored),
  }))
}
