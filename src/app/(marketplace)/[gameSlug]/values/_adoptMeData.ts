import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { AdoptMePetItem, AdoptMeVariantValue } from './_AdoptMeValuesClient'

/**
 * Server-side loader for the Adopt Me value list. Reads the two catalog tables
 * (pets + per-variant values) and reshapes them into the flat, variant-keyed
 * structure the client reprices against. Defensive: any error yields an empty
 * list so the page shows an "unavailable" state rather than throwing.
 */

const VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'] as const
type Variant = (typeof VARIANTS)[number]

type PetRow = {
  id: string
  slug: string
  name: string
  rarity: string
  image_url: string | null
  has_page: boolean
}
type ValueRow = {
  pet_id: string
  variant: string
  trade_value: number | string | null
  cash_value_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
  is_estimated: boolean
  confidence: string | null
}

function num(v: number | string | null): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getAdoptMePets(): Promise<AdoptMePetItem[]> {
  const supabase = await createClient()

  const [petsRes, valuesRes] = await Promise.all([
    (supabase as any)
      .from('adopt_me_pets')
      .select('id,slug,name,rarity,image_url,has_page')
      .eq('is_active', true),
    (supabase as any)
      .from('adopt_me_pet_values')
      .select(
        'pet_id,variant,trade_value,cash_value_usd,cheapest_usd,average_usd,is_estimated,confidence',
      ),
  ])

  if (petsRes.error) {
    console.error('Unable to load Adopt Me pets:', petsRes.error)
    return []
  }
  if (valuesRes.error) {
    console.error('Unable to load Adopt Me values:', valuesRes.error)
  }

  const valuesByPet = new Map<string, ValueRow[]>()
  for (const row of (valuesRes.data ?? []) as ValueRow[]) {
    const list = valuesByPet.get(row.pet_id) ?? []
    list.push(row)
    valuesByPet.set(row.pet_id, list)
  }

  return ((petsRes.data ?? []) as PetRow[]).map((pet) => {
    const values = {} as Record<Variant, AdoptMeVariantValue | undefined>
    let topTradeValue = 0

    for (const row of valuesByPet.get(pet.id) ?? []) {
      if (!(VARIANTS as readonly string[]).includes(row.variant)) continue
      const tradeValue = num(row.trade_value)
      const averageUsd = num(row.average_usd)
      const cheapestUsd = num(row.cheapest_usd)
      // Headline cash = the reputable market (average) when we have it, else the
      // legacy cash_value_usd. Cheapest is shown alongside on the pet page.
      const cashUsd = averageUsd ?? num(row.cash_value_usd)
      if (tradeValue != null && tradeValue > topTradeValue) topTradeValue = tradeValue
      values[row.variant as Variant] = {
        variant: row.variant as Variant,
        tradeValue,
        cashUsd,
        cheapestUsd,
        averageUsd,
        isEstimated: row.is_estimated,
        confidence: row.confidence ?? 'low',
      }
    }

    return {
      slug: pet.slug,
      name: pet.name,
      rarity: pet.rarity,
      imageUrl: pet.image_url,
      topTradeValue,
      hasPage: Boolean(pet.has_page),
      values,
    }
  })
}
