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
      .select('pet_id,variant,trade_value,cash_value_usd,is_estimated'),
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
          cashUsd: num(row.cash_value_usd),
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
