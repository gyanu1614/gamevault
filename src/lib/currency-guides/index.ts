import { RAW_CURRENCY_GUIDES } from './data'
import { currencyGuideSchema, type CurrencyGuide } from './schema'

export type { CurrencyGuide, DeliveryMethod } from './schema'
export { applyGuideToFaq, passwordAnswer, ACCOUNT_ACCESS_ANSWER, type FaqEntry } from './faq'
export {
  buildPriceRows,
  bestSaving,
  cheapestUnitPrice,
  ourPriceFor,
  savingPct,
  GRANULARITY_FACTOR,
  type OurPrices,
  type PriceRow,
  type Granularity,
} from './prices'

/**
 * The per-game "<Currency> Guide" fact sheets, validated.
 *
 * A file that fails the schema is skipped here (the page renders without a
 * guide and logs once) — the validator test over every file is what fails, so
 * a bad file breaks CI, never a live page.
 */
const parsed = new Map<string, CurrencyGuide | null>()

export function getCurrencyGuide(gameSlug: string): CurrencyGuide | null {
  if (parsed.has(gameSlug)) return parsed.get(gameSlug)!
  const raw = RAW_CURRENCY_GUIDES[gameSlug]
  let guide: CurrencyGuide | null = null
  if (raw) {
    const result = currencyGuideSchema.safeParse(raw)
    if (result.success && result.data.game === gameSlug) guide = result.data
    else console.warn(`[currency-guides] ${gameSlug}.json failed validation; guide not rendered`)
  }
  parsed.set(gameSlug, guide)
  return guide
}

/** Every slug with a fact sheet (valid or not). */
export const CURRENCY_GUIDE_SLUGS = Object.keys(RAW_CURRENCY_GUIDES)

/**
 * Games whose publisher forbids buying the currency outside the game
 * (README "Safety-copy flags"): the safety section must not promise the
 * account is safe, only what DropMarket itself covers. Owner to confirm the
 * wording.
 */
export const PUBLISHER_FORBIDS_RMT: Record<string, string> = {
  'gta-v': 'Rockstar',
  'escape-from-tarkov': 'Battlestate Games',
}

/** Roblox and the experiences built on it link to each other first. */
export function guideFamily(guide: CurrencyGuide): 'roblox' | 'other' {
  return guide.game === 'roblox' || /roblox experience/i.test(guide.trademark_owner) ? 'roblox' : 'other'
}

/** "2026-10-05" → "October 5, 2026" (UTC, so server and tests agree). */
export function formatCheckedAt(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
