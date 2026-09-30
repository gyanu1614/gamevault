/**
 * Format a USD price for titles/descriptions. Whole dollars drop the
 * cents; sub-dollar prices (per-unit currency rates) keep up to four
 * decimals with trailing zeros trimmed so "$0.0045" reads correctly
 * instead of rounding to "$0.00".
 *
 * Pure (no imports): shared by page-stats (server) and the game hub model.
 */
export function formatStatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '0'
  if (price >= 1) {
    return Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)
  }
  return price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
