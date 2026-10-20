/**
 * Writes DropMarket's own Adopt Me trade values after the daily reprice
 * (pure model: src/lib/pricing/adopt-me-trade-value.ts). Reads the prices the
 * reprice just stored, scores every form against Frost Dragon FR = 100, and
 * upserts only the rows whose value changed. A form with no price and no
 * estimate is cleared, so no third-party number survives. "Estimated" needs no
 * column: a trade value is estimated exactly when its form has no observed
 * cash price, which the page already knows (tradeIsEstimated in the pet data).
 */
import { fetchAllRows } from '@/lib/db/fetch-all'
import type { createServiceRoleClient } from '@/lib/supabase/service'
import { TRADE_BENCHMARK, computeAdoptMeTradeValues, type ObservedPrice } from '@/lib/pricing/adopt-me-trade-value'

type Admin = ReturnType<typeof createServiceRoleClient>
type Row = {
  pet_id: string
  variant: string
  average_usd: number | string | null
  cheapest_usd: number | string | null
  is_estimated: boolean | null
  trade_value: number | string | null
  adopt_me_pets: { slug: string | null; rarity: string | null } | null
}

const num = (v: unknown) => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const CHUNK = 500

export async function writeOwnTradeValues(admin: Admin): Promise<{ written: number; skipped?: string }> {
  const { data, error } = await fetchAllRows<Row>(
    (from, to) =>
      (admin as any)
        .from('adopt_me_pet_values')
        .select('pet_id,variant,average_usd,cheapest_usd,is_estimated,trade_value,adopt_me_pets!inner(slug,rarity)')
        .order('pet_id', { ascending: true })
        .order('variant', { ascending: true })
        .range(from, to),
    1000,
  )
  if (error) throw new Error(`adopt_me_pet_values (trade): ${(error as { message?: string }).message ?? String(error)}`)
  const rows = data ?? []

  const benchmark = rows.find((r) => r.adopt_me_pets?.slug === TRADE_BENCHMARK.petSlug)
  // Observed prices only: the market price, else the cheapest reputable listing.
  const observed: ObservedPrice[] = []
  for (const r of rows) {
    const usd = num(r.average_usd) ?? num(r.cheapest_usd)
    if (r.is_estimated || usd == null || usd <= 0) continue
    observed.push({ petId: r.pet_id, rarity: r.adopt_me_pets?.rarity ?? 'unknown', variant: r.variant, priceUsd: usd })
  }
  const result = benchmark ? computeAdoptMeTradeValues(observed, benchmark.pet_id) : null
  if (!result) return { written: 0, skipped: 'no Frost Dragon FR price; trade values left as they were' }

  const changed = rows
    .map((r) => {
      const trade = result.values.get(`${r.pet_id}:${r.variant}`)?.trade ?? null
      return num(r.trade_value) === trade ? null : { pet_id: r.pet_id, variant: r.variant, trade_value: trade }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)

  for (let i = 0; i < changed.length; i += CHUNK) {
    const { error: upsertError } = await (admin as any)
      .from('adopt_me_pet_values')
      .upsert(changed.slice(i, i + CHUNK), { onConflict: 'pet_id,variant' })
    if (upsertError) throw new Error(`adopt_me_pet_values trade upsert: ${upsertError.message}`)
  }
  return { written: changed.length }
}
