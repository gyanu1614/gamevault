/**
 * How a currency quantity is written, given the admin's granularity.
 *
 * Bulk games (granularity 'thousand' / 'million') store quantities and
 * prices per K or M, so "1,000" means 1,000 M and the unit shown is the
 * magnitude, not the currency's name ("100 M", never "100 Tokens" — that
 * would read as a hundred single tokens). Unit games keep their name
 * ("5,000 Robux"). The seller wizard and the buyer page share this so a
 * seller's "100 M" is the buyer's "100 M".
 */

export type QuantityGranularity = 'unit' | 'thousand' | 'million'

/** Suffix after a quantity: 'K', 'M', or the currency's own name. */
export function quantityUnit(
  granularity: QuantityGranularity | null | undefined,
  unitLabel: string | null | undefined,
): string {
  if (granularity === 'thousand') return 'K'
  if (granularity === 'million') return 'M'
  return unitLabel || 'unit'
}

/** "100 M", "1 K", "5,000 Robux". */
export function formatQuantity(
  n: number,
  granularity: QuantityGranularity | null | undefined,
  unitLabel: string | null | undefined,
): string {
  return `${n.toLocaleString('en-US')} ${quantityUnit(granularity, unitLabel)}`
}

/** What one price covers, for "Price Per …" labels: 'K', 'M' or 'Unit'. */
export function priceUnit(
  granularity: QuantityGranularity | null | undefined,
): string {
  if (granularity === 'thousand') return 'K'
  if (granularity === 'million') return 'M'
  return 'Unit'
}

/**
 * Units for one listing row (seller offers table): what the price covers
 * and what stock / minimum are counted in. Bundle listings are priced and
 * stocked per bundle; flexible currency uses K / M or the currency name;
 * everything else — or a currency row whose config has not loaded — is
 * per Unit.
 */
export function listingUnits(opts: {
  type: string | null | undefined
  bundleId: string | null | undefined
  config:
    | { quantity_granularity?: QuantityGranularity | null; unit_label?: string | null }
    | null
    | undefined
}): { price: string; quantity: string } {
  if (opts.type !== 'currency') return { price: 'Unit', quantity: 'Unit' }
  if (opts.bundleId) return { price: 'Bundle', quantity: 'Bundle' }
  if (!opts.config) return { price: 'Unit', quantity: 'Unit' }
  const u = quantityUnit(opts.config.quantity_granularity, opts.config.unit_label)
  return { price: u, quantity: u }
}
