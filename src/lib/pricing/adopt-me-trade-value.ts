/**
 * DropMarket's own Adopt Me trade value, from our own market prices
 * (owner, 2026-10-19: no third-party values). Points: Frost Dragon (Fly Ride)
 * = 100, every other form scored by its real sale price against it, so
 * "320" ≈ 3.2 Frost Dragons. Pure; the daily reprice reads and writes.
 *
 * A form with no reliable price is filled from the SAME pet's priced forms,
 * using the gap between forms measured across our own prices (median per
 * rarity, recalculated every run), and flagged estimated. Fewer than 5 pets
 * behind a ratio → no estimate.
 */

export const TRADE_BENCHMARK = { petSlug: 'frost-dragon', variant: 'FR', points: 100 } as const
const MIN_PAIRS = 5

export interface ObservedPrice {
  petId: string
  rarity: string
  variant: string
  priceUsd: number
}

export interface TradeValueResult {
  benchmarkUsd: number
  /** Median price of each form relative to FR, per rarity ('all' = every rarity). */
  ratios: Record<string, Record<string, number>>
  /** `${petId}:${variant}` → points (two decimals) and whether it was estimated. */
  values: Map<string, { trade: number; estimated: boolean }>
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round2 = (n: number) => Math.round(n * 100) / 100

export function computeAdoptMeTradeValues(prices: ObservedPrice[], benchmarkPetId = 'frost'): TradeValueResult | null {
  const benchmark = prices.find((p) => p.petId === benchmarkPetId && p.variant === TRADE_BENCHMARK.variant)
  if (!benchmark || !(benchmark.priceUsd > 0)) return null
  const benchmarkUsd = benchmark.priceUsd
  const points = (usd: number) => round2((usd / benchmarkUsd) * TRADE_BENCHMARK.points)

  const pets = new Map<string, { rarity: string; forms: Map<string, number> }>()
  for (const p of prices) {
    if (!(p.priceUsd > 0)) continue
    const pet = pets.get(p.petId) ?? { rarity: p.rarity, forms: new Map() }
    pet.forms.set(p.variant, p.priceUsd)
    pets.set(p.petId, pet)
  }

  // Form-to-FR price gaps, measured from pets that have both.
  const samples: Record<string, Record<string, number[]>> = {}
  for (const pet of pets.values()) {
    const fr = pet.forms.get('FR')
    if (!fr) continue
    for (const [variant, usd] of pet.forms) {
      if (variant === 'FR') continue
      for (const key of [pet.rarity, 'all']) ((samples[key] ??= {})[variant] ??= []).push(usd / fr)
    }
  }
  const ratios: Record<string, Record<string, number>> = {}
  for (const [key, byVariant] of Object.entries(samples)) {
    for (const [variant, xs] of Object.entries(byVariant)) {
      if (xs.length >= MIN_PAIRS) (ratios[key] ??= { FR: 1 })[variant] = round2(median(xs))
    }
  }
  const ratioFor = (rarity: string, variant: string) =>
    variant === 'FR' ? 1 : ratios[rarity]?.[variant] ?? ratios.all?.[variant] ?? null

  const values = new Map<string, { trade: number; estimated: boolean }>()
  const allForms = new Set(prices.map((p) => p.variant))
  for (const [petId, pet] of pets) {
    for (const [variant, usd] of pet.forms) values.set(`${petId}:${variant}`, { trade: points(usd), estimated: false })
    // The pet's FR-equivalent price, from every priced form that has a ratio.
    const anchors = [...pet.forms].map(([v, usd]) => {
      const r = ratioFor(pet.rarity, v)
      return r ? usd / r : null
    }).filter((x): x is number => x != null)
    if (anchors.length === 0) continue
    const frUsd = median(anchors)
    for (const variant of new Set([...allForms, 'FR'])) {
      if (pet.forms.has(variant)) continue
      const r = ratioFor(pet.rarity, variant)
      if (r) values.set(`${petId}:${variant}`, { trade: points(frUsd * r), estimated: true })
    }
  }
  return { benchmarkUsd, ratios, values }
}
