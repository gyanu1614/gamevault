/**
 * The quantity a checkout renders and quotes for — ONE clamp shared by the
 * page (which quotes the buyer fee for this subtotal, checkout B3) and the
 * form (which displays it), so the two can never disagree.
 *
 * Deep-linked ?qty is clamped to [min_quantity, quantity]; bundles ignore the
 * listing's min_quantity (a bundle is one unit).
 */
export function clampCheckoutQty(
  listing: { min_quantity?: number | null; quantity?: number | null },
  initialQty: number | undefined,
  isBundle: boolean,
): number {
  if (!initialQty) return 1
  const min = isBundle ? 1 : Math.max(1, listing.min_quantity ?? 1)
  const max = Math.max(min, listing.quantity ?? min)
  return Math.min(max, Math.max(min, initialQty))
}
