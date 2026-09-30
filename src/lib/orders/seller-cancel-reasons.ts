/**
 * Why a seller cancelled a paid order (the Cancel Order popup, the server
 * check and the chat notice all read this list). The common set on game
 * marketplaces: stock, timing, pricing, the buyer, or something else.
 */
export const SELLER_CANCEL_REASONS = [
  { id: 'out_of_stock', label: 'Out Of Stock' },
  { id: 'cannot_deliver_in_time', label: "Can't Deliver In Time" },
  { id: 'price_error', label: 'Price Error' },
  { id: 'buyer_requested', label: 'Buyer Asked To Cancel' },
  { id: 'buyer_unresponsive', label: 'Buyer Not Responding' },
  { id: 'other', label: 'Other' },
] as const

export type SellerCancelReason = (typeof SELLER_CANCEL_REASONS)[number]['id']

export function sellerCancelReasonLabel(id: string | null | undefined): string | null {
  return SELLER_CANCEL_REASONS.find((r) => r.id === id)?.label ?? null
}

/**
 * Refund policy (2026-09-30): whose fault a seller cancel is. The buyer
 * asking, or going quiet, is the buyer's (item price back, service fee
 * kept); everything else is the seller's (full refund, a fault on their
 * record, the 5-in-7-days non-delivery fee).
 */
export function sellerCancelFault(reason: string | null | undefined): 'buyer' | 'seller' {
  return reason === 'buyer_requested' || reason === 'buyer_unresponsive' ? 'buyer' : 'seller'
}

/** A reason is required; "Other" also needs a short note (5+ characters). */
export function validateSellerCancel(reason: string | null | undefined, note: string | null | undefined): string | null {
  if (!sellerCancelReasonLabel(reason)) return 'Pick a reason for cancelling.'
  if (reason === 'other' && (note ?? '').trim().length < 5) return 'Add a short note for "Other".'
  if ((note ?? '').trim().length > 500) return 'Keep the note under 500 characters.'
  return null
}
