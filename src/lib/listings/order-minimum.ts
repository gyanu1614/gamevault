/**
 * The smallest order a listing accepts — ONE rule for the checkout page
 * (clampCheckoutQty) and the server (createCheckout).
 *
 * A bundle sells whole, so its minimum is always 1, whatever min_quantity
 * says: older bundle listings still store the flexible-mode default (100),
 * which made a one-bundle order impossible at checkout (2026-10-05). Every
 * other listing uses its min_quantity, never below 1.
 */
export function orderMinimum(listing: { min_quantity?: number | null; bundle_id?: string | null }): number {
  if (listing.bundle_id) return 1
  const n = Math.floor(Number(listing.min_quantity ?? 1))
  return Number.isFinite(n) && n >= 1 ? n : 1
}
