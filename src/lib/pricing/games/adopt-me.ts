/**
 * Adopt Me correction — DB read/write around the pure reputable pass.
 *
 * Reads active raw listings (with seller review counts), runs the shared
 * reputable model + Adopt Me ladder sanity, and writes cheapest/average/value
 * onto adopt_me_pet_values. Pets/variants without reputable evidence keep their
 * existing estimate — we never overwrite a sensible estimate with nothing.
 *
 * Called by the unified correct-prices cron.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { RepriceOptions, RepriceResult } from '@/lib/pricing/registry'
import {
  correctAdoptMePrices,
  type AdoptMeVariantCorrection,
} from '@/lib/pricing/adopt-me-correction'
import type { RawListing } from '@/lib/pricing/reputable-adapter'
import { fetchAllRows } from '@/lib/db/fetch-all'
import type { PublishedPrice } from '@/lib/pricing/change-rule'

const PAGE_SIZE = 1000

type RawRow = {
  pet_id: string
  variant: string
  price_usd: number | string | null
  reviews: number | string | null
  listing_status: string | null
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * `options.full` is accepted for registry parity but not yet acted on: this
 * game reads ~38k already-filtered rows (listing_status=active) against 488
 * pets, which is comfortably inside budget. Add incremental writes here the
 * same way SAB does it if that ever stops being true.
 */
export async function runAdoptMeCorrection(
  options: RepriceOptions = {},
): Promise<RepriceResult> {
  const admin = createServiceRoleClient()
  const startedAt = new Date().toISOString()

  // Only ACTIVE raw listings feed the price. Ended (vanished) listings stay for
  // history but must not set today's value.
  // Paged with a UNIQUE order (id): paging without ORDER BY lets Postgres
  // return rows in any order, so page seams skip and duplicate rows — the
  // same bug that made SAB reprice differently on identical runs.
  const { data: rawData, error: rawError } = await fetchAllRows<RawRow>(
    (from, to) =>
      (admin as any)
        .from('adopt_me_market_raw_listings')
        .select('pet_id,variant,price_usd,reviews,listing_status')
        .eq('listing_status', 'active')
        .order('id', { ascending: true })
        .range(from, to),
    PAGE_SIZE,
  )
  if (rawError) {
    throw new Error(
      `adopt_me_market_raw_listings: ${(rawError as { message?: string }).message ?? String(rawError)}`,
    )
  }
  const rawRows = rawData ?? []

  const listings: RawListing[] = rawRows.map((row) => ({
    itemId: row.pet_id,
    variant: row.variant,
    priceUsd: toNumber(row.price_usd),
    reviews: toNumber(row.reviews),
  }))

  const corrections: AdoptMeVariantCorrection[] = correctAdoptMePrices(listings)

  // What the pages show today, so only rows that actually moved are written
  // (T1). A crawl that re-confirms the same price must not rewrite the row —
  // it used to UPDATE every priced pet-variant, one request each, every run.
  const { data: existingData, error: existingError } = await fetchAllRows<ValueRow>(
    (from, to) =>
      (admin as any)
        .from('adopt_me_pet_values')
        .select(
          'pet_id,variant,cash_value_usd,cheapest_usd,average_usd,reputable_count,listings_tracked,confidence,is_estimated',
        )
        .order('pet_id', { ascending: true })
        .order('variant', { ascending: true })
        .range(from, to),
    PAGE_SIZE,
  )
  if (existingError) {
    throw new Error(
      `adopt_me_pet_values: ${(existingError as { message?: string }).message ?? String(existingError)}`,
    )
  }
  const existing = new Map<string, ValueRow>()
  for (const row of existingData ?? []) existing.set(`${row.pet_id}:${row.variant}`, row)

  // Update each priced pet+variant whose numbers differ. cash_value_usd is set
  // to the market (average) so the existing values page / snapshot keep
  // working unchanged, while cheapest_usd/average_usd carry the buyer-facing
  // split. last_priced_at therefore means "price last changed".
  let updated = 0
  let unchanged = 0
  for (const c of corrections) {
    const key = `${c.petId}:${c.variant}`
    const next: ValueRow = {
      pet_id: c.petId,
      variant: c.variant,
      cash_value_usd: c.averageUsd,
      cheapest_usd: c.cheapestUsd,
      average_usd: c.averageUsd,
      reputable_count: c.reputableCount,
      listings_tracked: c.reputableCount,
      confidence: c.confidence,
      is_estimated: false,
    }
    const before = existing.get(key)
    if (before && sameValueRow(before, next)) {
      unchanged += 1
      continue
    }
    const { error } = await (admin as any)
      .from('adopt_me_pet_values')
      .update({
        cash_value_usd: next.cash_value_usd,
        cheapest_usd: next.cheapest_usd,
        average_usd: next.average_usd,
        reputable_count: next.reputable_count,
        listings_tracked: next.listings_tracked,
        confidence: next.confidence,
        is_estimated: false,
        last_priced_at: startedAt,
      })
      .eq('pet_id', c.petId)
      .eq('variant', c.variant)
    if (error) {
      console.error(
        `Adopt Me correction ${c.petId}/${c.variant}: ${error.message}`,
      )
    } else {
      updated += 1
      // Only rows that exist are updated (no insert), so merge only those.
      if (before) existing.set(key, next)
    }
  }

  // Reconcile TODAY's price-history snapshot with the freshly corrected values,
  // exactly as the SAB cron does. The GH Actions collector runs hours earlier,
  // so without this the sparkline would record the pre-correction value. Upsert
  // on the per-day key so re-running is safe; only TODAY is touched — earlier
  // days record what the site actually showed then.
  const historyDate = startedAt.slice(0, 10)
  const historyRows = corrections.map((c) => ({
    pet_id: c.petId,
    variant: c.variant,
    cash_value_usd: c.averageUsd,
    is_estimated: false,
    history_date: historyDate,
  }))

  let historyReconciled = 0
  for (let index = 0; index < historyRows.length; index += PAGE_SIZE) {
    const batch = historyRows.slice(index, index + PAGE_SIZE)
    const { error } = await (admin as any)
      .from('adopt_me_price_history')
      .upsert(batch, { onConflict: 'pet_id,variant,history_date' })
    if (error) {
      console.error('Failed to reconcile Adopt Me price history:', error)
      break
    }
    historyReconciled += batch.length
  }

  // Everything the pet pages display after this run (T1 publish step).
  const publishedPrices = await adoptMePublishedPrices(admin, existing)

  console.log(
    `✅ Adopt Me corrections: ${updated} written, ${unchanged} unchanged, of ${corrections.length} pet-variants priced from ${rawRows.length} active listings`,
  )

  return {
    priced: updated,
    unchanged,
    candidates: corrections.length,
    active_listings: rawRows.length,
    history_reconciled: historyReconciled,
    publishedPrices,
  }
}

type ValueRow = {
  pet_id: string
  variant: string
  cash_value_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
  reputable_count: number | string | null
  listings_tracked: number | string | null
  confidence: string | null
  is_estimated: boolean | null
}

const sameNumber = (a: unknown, b: unknown): boolean => {
  const x = toNumber(a as number | string | null)
  const y = toNumber(b as number | string | null)
  if (x == null || y == null) return x === y
  return Math.abs(x - y) < 1e-9
}

/** True when writing `next` would not change any stored column. */
export function sameValueRow(before: ValueRow, next: ValueRow): boolean {
  return (
    sameNumber(before.cash_value_usd, next.cash_value_usd) &&
    sameNumber(before.cheapest_usd, next.cheapest_usd) &&
    sameNumber(before.average_usd, next.average_usd) &&
    sameNumber(before.reputable_count, next.reputable_count) &&
    sameNumber(before.listings_tracked, next.listings_tracked) &&
    (before.confidence ?? null) === (next.confidence ?? null) &&
    before.is_estimated === next.is_estimated
  )
}

/**
 * The headline numbers each pet page shows, per form: the reputable average
 * (the "Market" cash value) and the cheapest reputable listing. Keyed by the
 * pet's page slug.
 */
async function adoptMePublishedPrices(
  admin: ReturnType<typeof createServiceRoleClient>,
  values: Map<string, ValueRow>,
): Promise<PublishedPrice[]> {
  const { data: pets, error } = await fetchAllRows<{ id: string; slug: string | null }>(
    (from, to) =>
      (admin as any)
        .from('adopt_me_pets')
        .select('id,slug')
        .order('id', { ascending: true })
        .range(from, to),
    PAGE_SIZE,
  )
  if (error) {
    throw new Error(`adopt_me_pets: ${(error as { message?: string }).message ?? String(error)}`)
  }
  const slugById = new Map((pets ?? []).filter((p) => p.slug).map((p) => [p.id, p.slug as string]))
  const out: PublishedPrice[] = []
  for (const row of values.values()) {
    const slug = slugById.get(row.pet_id)
    if (!slug) continue
    const average = toNumber(row.average_usd)
    const cheapest = toNumber(row.cheapest_usd)
    if (average == null && cheapest == null) continue
    out.push({ itemSlug: slug, variant: row.variant, prices: { average, cheapest } })
  }
  return out
}
