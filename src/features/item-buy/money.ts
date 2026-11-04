import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'

/** "$54.99", "$110.00": the pet page always shows cents. */
export const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Quantity ceiling: unlimited stock caps at 99, else the seller's quantity. */
export const maxQtyOf = (o: ItemOffer) => (o.isUnlimited ? 99 : Math.max(1, o.stock ?? 1))
