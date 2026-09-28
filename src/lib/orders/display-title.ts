/**
 * The order page's item title, with the amount bought.
 *
 *  - Flexible currency (priced per unit / K / M): "2,000 - Roblox Robux",
 *    "100 M - Blade Ball Tokens" (K/M games count in thousands/millions).
 *  - Anything else bought more than once (items, bundles): "3 × Title".
 *  - A single item: the listing title as is.
 *
 * A currency title that already starts with a number ("10,000 Robux Pack")
 * falls back to the "× " form so the two numbers never run together.
 */

import type { QuantityGranularity } from '@/lib/currency/quantity-unit'

export function orderDisplayTitle(opts: {
  title: string
  quantity: number | null | undefined
  /** game_categories.type === 'currency' */
  isCurrency: boolean
  /** Currency config's quantity_granularity (null when not loaded). */
  granularity?: QuantityGranularity | null
  /** Currency config sells fixed bundles, so quantity counts bundles. */
  hasBundles?: boolean
}): string {
  const title = opts.title.trim()
  const qty = Number(opts.quantity ?? 1)
  if (!Number.isFinite(qty) || qty <= 0) return title

  const flexibleCurrency = opts.isCurrency && !opts.hasBundles
  if (flexibleCurrency && !/^\d/.test(title)) {
    const magnitude =
      opts.granularity === 'thousand' ? ' K' : opts.granularity === 'million' ? ' M' : ''
    return `${qty.toLocaleString('en-US')}${magnitude} - ${title}`
  }
  return qty > 1 ? `${qty.toLocaleString('en-US')} × ${title}` : title
}
