/**
 * The admin Pricing Rules card's pure half: the four amount boxes as text
 * (so "0.000" can be typed on the way to "0.0000045"), their validation in
 * plain words, and the live example lines. The card itself is
 * src/app/(admin)/admin/games/_components/CurrencyPricingRules.tsx.
 */
import { formatRuleAmount, formatUnitPrice, parseRuleAmount } from './price-format'
import { granularityMultiplier, priceRuleInputsOf, type PriceRuleConfig, type PriceRuleInputs } from './price-rules'
import type { QuantityGranularity } from './quantity-unit'

export interface RuleTexts {
  unitMin: string
  unitMax: string
  bundleMin: string
  bundleMax: string
}

export type RuleErrors = Partial<Record<keyof RuleTexts, string>>

/** Smallest per-unit price a listing can carry (listings.price is numeric(12,4)). */
export const LISTING_PRICE_STEP = 0.0001

export function ruleTextsOf(cfg: PriceRuleConfig | null | undefined): RuleTexts {
  const r = priceRuleInputsOf(cfg)
  return {
    unitMin: formatRuleAmount(r.unitMin),
    unitMax: formatRuleAmount(r.unitMax),
    bundleMin: formatRuleAmount(r.bundleMin),
    bundleMax: formatRuleAmount(r.bundleMax),
  }
}

export function parseRuleTexts(
  t: RuleTexts,
): { ok: true; value: PriceRuleInputs } | { ok: false; errors: RuleErrors; value: PriceRuleInputs } {
  const errors: RuleErrors = {}
  const read = (k: keyof RuleTexts): number | null => {
    const r = parseRuleAmount(t[k])
    if (!r.ok) {
      errors[k] = r.error
      return null
    }
    return r.value != null && r.value > 0 ? r.value : null
  }
  const value: PriceRuleInputs = {
    unitMin: read('unitMin'),
    unitMax: read('unitMax'),
    bundleMin: read('bundleMin'),
    bundleMax: read('bundleMax'),
  }
  if (!errors.unitMax && value.unitMin != null && value.unitMax != null && value.unitMax < value.unitMin) {
    errors.unitMax = 'The maximum is lower than the minimum.'
  }
  if (!errors.unitMax && value.unitMax != null && value.unitMax < LISTING_PRICE_STEP) {
    errors.unitMax = 'Sellers price to 4 decimal places, so a maximum under $0.0001 would block every listing. Use a bigger Unit Size instead.'
  }
  if (!errors.bundleMax && value.bundleMin != null && value.bundleMax != null && value.bundleMax < value.bundleMin) {
    errors.bundleMax = 'The maximum is lower than the minimum.'
  }
  return Object.keys(errors).length ? { ok: false, errors, value } : { ok: true, value }
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * "A seller listing 1,000 K Sheckles (1,000,000 Sheckles) at $0.0045 per K
 * ($0.0000045 each) charges $4.50." Uses the minimum (else the maximum) and
 * a round quantity that makes the order at least $1. Null with no price.
 */
export function flexibleExample(o: {
  unitMin: number | null
  unitMax: number | null
  granularity: QuantityGranularity | null | undefined
  unitLabel: string
  minQuantity: number
}): string | null {
  const price = o.unitMin ?? o.unitMax
  if (price == null || price <= 0) return null
  const minQty = Math.max(1, Math.floor(o.minQuantity) || 1)
  const qty = Math.max(minQty, 10 ** Math.max(0, Math.ceil(Math.log10(1 / price))))
  const mult = granularityMultiplier(o.granularity)
  const unit = o.unitLabel.trim() || 'units'
  const total = money(price * qty)
  if (mult === 1) {
    return `A seller listing ${qty.toLocaleString('en-US')} ${unit} at ${formatUnitPrice(price)} each charges ${total}.`
  }
  const tag = o.granularity === 'thousand' ? 'K' : 'M'
  return (
    `A seller listing ${qty.toLocaleString('en-US')} ${tag} ${unit} (${(qty * mult).toLocaleString('en-US')} ${unit}) ` +
    `at ${formatUnitPrice(price)} per ${tag} (${formatUnitPrice(price / mult)} each) charges ${total}.`
  )
}

/** "A seller listing “1400 Diamonds” can charge from $1.00 to $40.00." */
export function bundleExample(o: { bundleMin: number | null; bundleMax: number | null; bundleName: string | null }): string {
  const what = o.bundleName ? `“${o.bundleName}”` : 'a bundle'
  if (o.bundleMin != null && o.bundleMax != null) {
    return `A seller listing ${what} can charge from ${formatUnitPrice(o.bundleMin)} to ${formatUnitPrice(o.bundleMax)}.`
  }
  if (o.bundleMin != null) return `A seller listing ${what} can charge ${formatUnitPrice(o.bundleMin)} or more.`
  if (o.bundleMax != null) return `A seller listing ${what} can charge up to ${formatUnitPrice(o.bundleMax)}.`
  return `A seller listing ${what} can charge any price from $0.01.`
}
