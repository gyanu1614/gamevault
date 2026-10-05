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
import type { RepriceOptions } from '@/lib/pricing/registry'
import {
  correctAdoptMePrices,
  type AdoptMeVariantCorrection,
} from '@/lib/pricing/adopt-me-correction'
import type { RawListing } from '@/lib/pricing/reputable-adapter'
import { fetchAllRows } from '@/lib/db/fetch-all'

const PAGE_SIZE = 1000

type RawRow = {
  pet_id: string
  variant: string
  price_usd: number | string | null
  reviews: number | string | null
  listing_status: string | null
}

function toNumber(value: number | string | null | undefined): number | null {
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
): Promise<Record<string, unknown>> {
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

  // Update each priced pet+variant. cash_value_usd is set to the market
  // (average) so the existing values page / snapshot keep working unchanged,
  // while cheapest_usd/average_usd carry the buyer-facing split.
  let updated = 0
  for (const c of corrections) {
    const { error } = await (admin as any)
      .from('adopt_me_pet_values')
      .update({
        cash_value_usd: c.averageUsd,
        cheapest_usd: c.cheapestUsd,
        average_usd: c.averageUsd,
        reputable_count: c.reputableCount,
        listings_tracked: c.reputableCount,
        confidence: c.confidence,
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

  console.log(
    `✅ Adopt Me corrections: ${updated}/${corrections.length} pet-variants priced from ${rawRows.length} active listings`,
  )

  return {
    priced: updated,
    candidates: corrections.length,
    active_listings: rawRows.length,
    history_reconciled: historyReconciled,
  }
}
