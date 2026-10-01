import type { ChipTone } from '../components/kit'

/**
 * Model C display labels for orders.escrow_status (the DB identifiers stay).
 * One map for the orders list, the filters and the order page.
 */
export const PAYOUT_LABEL: Record<string, string> = {
  pending: 'Pending',
  held: 'Payout Pending',
  frozen: 'Frozen',
  released: 'Seller Paid Out',
  refunded: 'Refunded',
}

export const PAYOUT_TONE: Record<string, ChipTone> = {
  pending: 'neutral',
  held: 'warning',
  frozen: 'error',
  released: 'success',
  refunded: 'error',
}
