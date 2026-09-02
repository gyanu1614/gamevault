import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  VARIANTS,
  type Variant,
  type CalcVariantValue,
  type CalcPet,
} from './_adoptMeCalcTypes'

/**
 * Server-side data loader for the Adopt Me calculators — every active pet with
 * its full 8-variant trade + cash values. Types + constants live in
 * _adoptMeCalcTypes.ts (no server imports) so client components can share them.
 */

// Re-export the shared types for server callers' convenience.
export type { Variant, CalcVariantValue, CalcPet } from './_adoptMeCalcTypes'
export { VARIANTS, VARIANT_LABEL } from './_adoptMeCalcTypes'

function num(v: number | string | null): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getAdoptMeCalcPets(): Promise<CalcPet[]> {
  const supabase = await createClient()

  const [petsRes, valuesRes] = await Promise.all([
    (supabase as any)
      .from('adopt_me_pets')
      .select('id,slug,name,rarity,image_url')
      .eq('is_active', true),
    (supabase as any)
      .from('adopt_me_pet_values')
      .select('pet_id,variant,trade_value,cash_value_usd,cheapest_usd,average_usd,is_estimated'),
  ])

  if (petsRes.error) {
    console.error('Unable to load Adopt Me calc pets:', petsRes.error)
    return []
  }

  const valuesByPet = new Map<string, any[]>()
  for (const row of (valuesRes.data ?? []) as any[]) {
    const list = valuesByPet.get(row.pet_id) ?? []
    list.push(row)
    valuesByPet.set(row.pet_id, list)
  }

  return ((petsRes.data ?? []) as any[])
    .map((pet) => {
      const values: Partial<Record<Variant, CalcVariantValue>> = {}
      for (const row of valuesByPet.get(pet.id) ?? []) {
        if (!(VARIANTS as readonly string[]).includes(row.variant)) continue
        values[row.variant as Variant] = {
          tradeValue: num(row.trade_value),
          // CHEAPEST is the price a buyer actually pays — the headline used on
          // the values list + pet page. Prefer it, then the reputable average.
          // REAL cash only: we no longer fall back to the estimated
          // cash_value_usd. A pet with no real cash contributes to the trade
          // calc via its trade-points value instead of a fabricated dollar.
          cashUsd: num(row.cheapest_usd) ?? num(row.average_usd),
          isEstimated: Boolean(row.is_estimated),
        }
      }
      return {
        slug: pet.slug,
        name: pet.name,
        rarity: pet.rarity,
        imageUrl: pet.image_url,
        values,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** One row of the calculator's "top values" table. */
export type AdoptMeTopValue = {
  slug: string
  name: string
  rarity: string
  /** FR cheapest cash (the trading benchmark), null if unpriced. */
  cheapestUsd: number | null
}

/**
 * Top page-having pets ranked by FR cheapest cash — for the calculator's SEO
 * value table. Only pets with a live page are returned (they're the crawlable
 * link targets), newest prices via the reputable columns.
 */
export async function getAdoptMeTopValues(limit = 20): Promise<AdoptMeTopValue[]> {
  const supabase = await createClient()

  const [petsRes, valuesRes] = await Promise.all([
    (supabase as any)
      .from('adopt_me_pets')
      .select('id,slug,name,rarity')
      .eq('is_active', true)
      .eq('has_page', true),
    (supabase as any)
      .from('adopt_me_pet_values')
      .select('pet_id,cheapest_usd,average_usd,cash_value_usd')
      .eq('variant', 'FR'),
  ])

  if (petsRes.error || valuesRes.error) {
    console.error(
      'Unable to load Adopt Me top values:',
      petsRes.error ?? valuesRes.error,
    )
    return []
  }

  const frByPet = new Map<string, any>()
  for (const r of (valuesRes.data ?? []) as any[]) frByPet.set(r.pet_id, r)

  return ((petsRes.data ?? []) as any[])
    .map((pet) => {
      const fr = frByPet.get(pet.id)
      // Real cash only — this is a cash ranking, so estimate-only pets are
      // excluded (filtered below) rather than ranked on a fabricated price.
      const cheapestUsd = fr
        ? num(fr.cheapest_usd) ?? num(fr.average_usd)
        : null
      return { slug: pet.slug, name: pet.name, rarity: pet.rarity, cheapestUsd }
    })
    .filter((r) => r.cheapestUsd != null)
    .sort((a, b) => (b.cheapestUsd as number) - (a.cheapestUsd as number))
    .slice(0, limit)
}
