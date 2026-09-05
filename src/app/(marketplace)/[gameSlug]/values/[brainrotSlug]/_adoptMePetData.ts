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
  /** When this variant was last repriced (ISO), for the freshness badge. */
  lastPricedAt: string | null
}

/** One daily price point for the trend chart. */
export interface PetPricePoint {
  date: string
  price: number
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
  /** Daily price history keyed by variant (may be empty until it accrues). */
  priceHistory: Record<string, PetPricePoint[]>
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
      'variant,trade_value,cash_value_usd,cheapest_usd,average_usd,is_estimated,confidence,listings_tracked,last_priced_at',
    )
    .eq('pet_id', pet.id)

  // Daily price history for the trend chart. Ordered oldest→newest so the chart
  // reads left-to-right. Keyed by variant; only variants with rows appear.
  const { data: historyRows } = await (supabase as any)
    .from('adopt_me_price_history')
    .select('variant,cash_value_usd,history_date')
    .eq('pet_id', pet.id)
    .order('history_date', { ascending: true })

  const priceHistory: Record<string, PetPricePoint[]> = {}
  for (const r of (historyRows ?? []) as any[]) {
    const price = num(r.cash_value_usd)
    if (price == null) continue
    ;(priceHistory[r.variant] ??= []).push({ date: r.history_date, price })
  }

  const byVariant = new Map<string, any>()
  for (const r of (valueRows ?? []) as any[]) byVariant.set(r.variant, r)

  const variants: AdoptMePetVariant[] = VARIANT_ORDER.map((variant) => {
    const r = byVariant.get(variant)
    const averageUsd = r ? num(r.average_usd) : null
    return {
      variant,
      label: VARIANT_LABEL[variant],
      tradeValue: r ? num(r.trade_value) : null,
      // cashUsd carries ONLY a REAL reputable market price (average). We no
      // longer fall back to the legacy estimated cash_value_usd — when there is
      // no real cash the UI shows the trade-points value instead of a made-up $.
      cashUsd: averageUsd,
      cheapestUsd: r ? num(r.cheapest_usd) : null,
      averageUsd,
      isEstimated: r ? Boolean(r.is_estimated) : true,
      confidence: r?.confidence ?? 'low',
      listingsTracked: r ? Number(r.listings_tracked ?? 0) : 0,
      lastPricedAt: r?.last_priced_at ?? null,
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
    priceHistory,
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
export interface SimilarPet {
  slug: string
  name: string
  imageUrl: string | null
  frCashUsd: number | null
}

/**
 * Pets a buyer looking at this one would genuinely consider — not a random row
 * grab. The set is: same rarity first, then ranked so the CLOSEST in Fly-Ride
 * cash value comes first (a $200 pet's peers are other ~$200 pets, not a $2
 * one), with priced/tradeable pets ahead of unpriced ones. If the rarity is too
 * thin to fill the rail, it's topped up with the next-nearest-value pets from
 * other rarities. Returns enough to make the carousel worth scrolling.
 *
 * @param rarity      the current pet's rarity (the primary similarity signal)
 * @param excludeSlug the current pet (never shown as its own "similar")
 * @param refFrUsd    the current pet's FR cash value, for value-proximity ranking
 * @param limit       how many to return (default 14 — a scrollable rail)
 */
export async function getSimilarPets(
  rarity: string,
  excludeSlug: string,
  refFrUsd: number | null,
  limit = 14,
): Promise<SimilarPet[]> {
  const supabase = await createClient()

  // Pull every page-having pet once (the catalog is small — ~60 rows), with its
  // FR cash, so we can rank in memory by rarity + value proximity.
  const { data: petRows } = await (supabase as any)
    .from('adopt_me_pets')
    .select('id,slug,name,image_url,rarity')
    .eq('has_page', true)
    .neq('slug', excludeSlug)
  const pets = (petRows ?? []) as Array<{
    id: string
    slug: string
    name: string
    image_url: string | null
    rarity: string
  }>
  if (!pets.length) return []

  const { data: frRows } = await (supabase as any)
    .from('adopt_me_pet_values')
    .select('pet_id,cheapest_usd,cash_value_usd')
    .eq('variant', 'FR')
    .in('pet_id', pets.map((p) => p.id))
  // Prefer the cheapest real listing, else the legacy cash value — same headline
  // the rest of the hub uses.
  const frByPet = new Map<string, number | null>(
    ((frRows ?? []) as any[]).map((r) => [r.pet_id, num(r.cheapest_usd) ?? num(r.cash_value_usd)]),
  )

  const enriched = pets.map((p) => ({
    slug: p.slug,
    name: p.name,
    imageUrl: p.image_url,
    frCashUsd: frByPet.get(p.id) ?? null,
    rarity: p.rarity,
  }))

  // Rank: same rarity first; then priced before unpriced; then nearest in value
  // to the current pet (when both are priced), else by value descending.
  const sameRarityFirst = (a: typeof enriched[number], b: typeof enriched[number]) => {
    const ar = a.rarity === rarity ? 0 : 1
    const br = b.rarity === rarity ? 0 : 1
    if (ar !== br) return ar - br
    const ap = a.frCashUsd != null ? 0 : 1
    const bp = b.frCashUsd != null ? 0 : 1
    if (ap !== bp) return ap - bp
    if (refFrUsd != null && a.frCashUsd != null && b.frCashUsd != null) {
      return Math.abs(a.frCashUsd - refFrUsd) - Math.abs(b.frCashUsd - refFrUsd)
    }
    return (b.frCashUsd ?? 0) - (a.frCashUsd ?? 0)
  }

  return enriched
    .sort(sameRarityFirst)
    .slice(0, limit)
    .map(({ slug, name, imageUrl, frCashUsd }) => ({ slug, name, imageUrl, frCashUsd }))
}
