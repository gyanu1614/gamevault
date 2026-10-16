/**
 * The Adopt Me "About" section's data (owner, 2026-10-11 revamp): one
 * quotable answer for the picked form, a Quick Facts list, and the Price by
 * Form table (every form, its market numbers, and our own stock). Pure, so
 * the client section and tests share it.
 */
import { VARIANTS, VARIANT_DISPLAY, type Variant } from '@/lib/adopt-me/variants'
import type { ItemStock } from '@/lib/value-listings/buy-state'
import { formatUsd } from '@/lib/value-listings/format'
import type { AdoptMePetVariant } from './_adoptMePetTypes'

const TRADE = new Intl.NumberFormat('en-US')

export interface FormRow {
  code: Variant
  label: string
  cheapestUsd: number | null
  tradeValue: number | null
  listings: number
  isEstimated: boolean
  /** Our own cheapest live offer for this form, and how many. */
  ourFromUsd: number | null
  ourCount: number
  selected: boolean
}

/** The headline price a form is quoted at (the hero's rule). */
export function formPrice(v: Pick<AdoptMePetVariant, 'cheapestUsd' | 'averageUsd' | 'cashUsd'>): number | null {
  return v.cheapestUsd ?? v.averageUsd ?? v.cashUsd ?? null
}

/** Every form the pet has, in ladder order (Normal → Mega Neon Fly Ride). */
export function formRows(
  variants: AdoptMePetVariant[],
  stock: ItemStock | null,
  stockKey: (code: Variant) => string | null,
  selected: Variant,
): FormRow[] {
  const by = new Map(variants.map((v) => [v.variant, v]))
  return VARIANTS.filter((c) => by.has(c)).map((code) => {
    const v = by.get(code)!
    const key = stockKey(code)
    const ours = key ? stock?.byVariant[key] : undefined
    return {
      code,
      label: VARIANT_DISPLAY[code],
      cheapestUsd: formPrice(v),
      tradeValue: v.tradeValue,
      listings: v.listingsTracked,
      isEstimated: v.isEstimated,
      ourFromUsd: ours && ours.count > 0 ? ours.minPriceUsd : null,
      ourCount: ours?.count ?? 0,
      selected: code === selected,
    }
  })
}

/**
 * The one sentence an answer engine lifts, for the picked form: price first,
 * then trade value, nothing else (owner, 2026-10-12: plain, not AI). Where
 * the price comes from is its own quiet line (aboutBasis).
 */
export function aboutAnswer(name: string, v: AdoptMePetVariant | undefined): string | null {
  if (!v) return null
  const form = `${VARIANT_DISPLAY[v.variant]} ${name}`
  const usd = formPrice(v)
  const trade = v.tradeValue != null ? TRADE.format(v.tradeValue) : null
  if (usd != null) return `A ${form} sells for ${formatUsd(usd)}${trade ? `, with a trade value of ${trade}` : ''}.`
  if (trade) return `A ${form} has a trade value of ${trade}.`
  return null
}

/** Where the answer's price comes from, as one short line. */
export function aboutBasis(v: AdoptMePetVariant | undefined): string | null {
  if (!v) return null
  if (formPrice(v) != null && v.listingsTracked > 0) {
    return `Cheapest of ${v.listingsTracked} ${v.listingsTracked === 1 ? 'listing' : 'listings'} from sellers with 100+ reviews.`
  }
  if (formPrice(v) == null && v.tradeValue != null) return 'No cash listings tracked yet.'
  return null
}

export function aboutFacts(
  pet: { rarity: string; originDetail: string | null; originType: string | null; obtainabilityLabel: string },
  variants: AdoptMePetVariant[],
): Array<{ label: string; value: string }> {
  const prices = variants.map(formPrice).filter((p): p is number => p != null && p > 0)
  const facts: Array<{ label: string; value: string }> = [{ label: 'Rarity', value: pet.rarity }]
  const origin = pet.originDetail ?? pet.originType
  if (origin) facts.push({ label: 'Origin', value: origin })
  facts.push({ label: 'Availability', value: pet.obtainabilityLabel })
  if (prices.length > 0) {
    const lo = Math.min(...prices)
    const hi = Math.max(...prices)
    facts.push({ label: 'Price Range', value: lo === hi ? formatUsd(lo) : `${formatUsd(lo)} – ${formatUsd(hi)}` })
  }
  facts.push({ label: 'Forms Priced', value: `${prices.length} of ${variants.length}` })
  return facts
}

/**
 * The stored description, minus any sentence that quotes a price or a form
 * count. Descriptions were written once (2026-10-12) with that day's prices
 * baked in ("about $6.98 … 6 forms … $75.00"), so a week later the page
 * contradicted its own table. The story stays; live numbers come from
 * livePriceSpread, which reads the same rows as the table (2026-10-15).
 */
const STALE_SENTENCE = /\$\s?\d|\bforms? with enough listings\b|\bprices change daily\b/i

export function withoutStalePrices(text: string): string {
  // Split only where a stop is followed by a capital: "$6.98" stays whole.
  const sentences = text.trim().split(/(?<=[.!?])\s+(?=[A-Z])/)
  return sentences.filter((s) => !STALE_SENTENCE.test(s)).join(' ').trim()
}

/** The live version of the old baked-in spread: same numbers as the Price by Form table. */
export function livePriceSpread(_name: string, variants: AdoptMePetVariant[]): string | null {
  const ordered = VARIANTS.flatMap((c) => variants.filter((v) => v.variant === c))
  const priced = ordered
    .map((v) => ({ label: VARIANT_DISPLAY[v.variant], usd: formPrice(v) }))
    .filter((p): p is { label: string; usd: number } => p.usd != null && p.usd > 0)
  if (priced.length === 0) return null
  if (priced.length === 1) return `Only the ${priced[0].label} form has enough listings to price today: ${formatUsd(priced[0].usd)}.`
  const lo = priced.reduce((a, b) => (b.usd < a.usd ? b : a))
  const hi = priced.reduce((a, b) => (b.usd > a.usd ? b : a))
  return `Across the ${priced.length} of ${variants.length} forms we can price today, the cheapest listings run from ${formatUsd(lo.usd)} (${lo.label}) to ${formatUsd(hi.usd)} (${hi.label}).`
}

