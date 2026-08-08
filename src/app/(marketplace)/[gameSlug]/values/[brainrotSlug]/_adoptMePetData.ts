import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Per-pet data for /adopt-me/values/{slug}. A pet is only servable when
 * has_page is true (active + a real description), so a thin or unpriced pet
 * 404s rather than publishing an empty page.
 */

export const VARIANT_ORDER = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'] as const
export type Variant = (typeof VARIANT_ORDER)[number]

export const VARIANT_LABEL: Record<Variant, string> = {
  N: 'Normal',
  F: 'Fly',
  R: 'Ride',
  FR: 'Fly Ride',
  NEON: 'Neon',
  NFR: 'Neon Fly Ride',
  MEGA: 'Mega Neon',
  MFR: 'Mega Fly Ride',
}

export interface AdoptMePetVariant {
  variant: Variant
  label: string
  tradeValue: number | null
  /** Headline cash = reputable market (average) when present, else legacy value. */
  cashUsd: number | null
  /** Lowest reputable-seller price (100+ reviews). Null until priced. */
  cheapestUsd: number | null
  /** Reputable market price (median of cheapest reputable listings). */
  averageUsd: number | null
  isEstimated: boolean
  confidence: string
  listingsTracked: number
}

export interface AdoptMePetDetail {
  slug: string
  name: string
  rarity: string
  obtainability: string
  originType: string | null
  originDetail: string | null
  imageUrl: string | null
  description: string
  variants: AdoptMePetVariant[]
}

function num(v: number | string | null): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Full detail for one pet, or null if it isn't publishable (has_page=false). */
export async function getAdoptMePet(slug: string): Promise<AdoptMePetDetail | null> {
  const supabase = await createClient()

  const { data: pet, error } = await (supabase as any)
    .from('adopt_me_pets')
    .select('id,slug,name,rarity,obtainability,origin_type,origin_detail,image_url,description,has_page')
    .eq('slug', slug)
    .eq('has_page', true)
    .maybeSingle()

  if (error || !pet) return null

  const { data: valueRows } = await (supabase as any)
    .from('adopt_me_pet_values')
    .select(
      'variant,trade_value,cash_value_usd,cheapest_usd,average_usd,is_estimated,confidence,listings_tracked',
    )
    .eq('pet_id', pet.id)

  const byVariant = new Map<string, any>()
  for (const r of (valueRows ?? []) as any[]) byVariant.set(r.variant, r)

  const variants: AdoptMePetVariant[] = VARIANT_ORDER.map((variant) => {
    const r = byVariant.get(variant)
    const averageUsd = r ? num(r.average_usd) : null
    return {
      variant,
      label: VARIANT_LABEL[variant],
      tradeValue: r ? num(r.trade_value) : null,
      // Headline = reputable market when present, else the legacy cash value.
      cashUsd: averageUsd ?? (r ? num(r.cash_value_usd) : null),
      cheapestUsd: r ? num(r.cheapest_usd) : null,
      averageUsd,
      isEstimated: r ? Boolean(r.is_estimated) : true,
      confidence: r?.confidence ?? 'low',
      listingsTracked: r ? Number(r.listings_tracked ?? 0) : 0,
    }
  })

  return {
    slug: pet.slug,
    name: pet.name,
    rarity: pet.rarity,
    obtainability: pet.obtainability,
    originType: pet.origin_type,
    originDetail: pet.origin_detail,
    imageUrl: pet.image_url,
    description: pet.description,
    variants,
  }
}

/** Slugs of all publishable pets — for generateStaticParams + similar-pets. */
export async function getPublishablePetSlugs(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('adopt_me_pets')
    .select('slug')
    .eq('has_page', true)
  return ((data ?? []) as { slug: string }[]).map((r) => r.slug)
}

/**
 * A few similar pets (same rarity) for internal linking. Gated on has_page, not
 * is_active — a "similar pet" link must go to a page that exists, or it's just
 * another soft-404. Falls back to same-rarity if that yields too few is fine:
 * an empty section self-hides rather than linking to dead pages.
 */
export async function getSimilarPets(
  rarity: string,
  excludeSlug: string,
  limit = 6,
): Promise<Array<{ slug: string; name: string; imageUrl: string | null; frCashUsd: number | null }>> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('adopt_me_pets')
    .select('id,slug,name,image_url')
    .eq('has_page', true)
    .neq('slug', excludeSlug)
    .limit(limit)
  const pets = (data ?? []) as any[]
  if (!pets.length) return []

  // FR cash for the carousel price line (only observed values).
  const { data: frRows } = await (supabase as any)
    .from('adopt_me_pet_values')
    .select('pet_id,cash_value_usd')
    .eq('variant', 'FR')
    .in('pet_id', pets.map((p) => p.id))
  const frByPet = new Map<string, number | null>(
    ((frRows ?? []) as any[]).map((r) => [r.pet_id, num(r.cash_value_usd)]),
  )

  return pets.map((r) => ({
    slug: r.slug,
    name: r.name,
    imageUrl: r.image_url,
    frCashUsd: frByPet.get(r.id) ?? null,
  }))
}
