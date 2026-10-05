/**
 * A game's currency category is stored with a generic name ("Currency"), but
 * the page itself is titled by the currency's own unit ("Buy Gems", "Buy
 * V-Bucks"). Tabs and hub cards should say the same thing: show the currency
 * config's unit_label for the currency-type category. Plain module.
 */

/** Placeholder unit labels that say nothing a tab should show. */
const GENERIC_UNIT_LABELS = new Set(['currency', 'units', 'unit'])

/** The unit label worth showing, or null when unset / a generic placeholder. */
export function currencyUnitLabel(unitLabel: string | null | undefined): string | null {
  const label = unitLabel?.trim()
  if (!label || GENERIC_UNIT_LABELS.has(label.toLowerCase())) return null
  return label
}

/** Rename the currency-type category to the currency's unit label. */
export function withCurrencyNavLabel<T extends { name: string; type?: string | null }>(
  categories: T[],
  unitLabel: string | null | undefined,
): T[] {
  const label = currencyUnitLabel(unitLabel)
  if (!label) return categories
  return categories.map((c) => (c.type === 'currency' ? { ...c, name: label } : c))
}
