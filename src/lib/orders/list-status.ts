/**
 * The one status an orders-list row shows (Purchases + Sold).
 *
 * Owner, 2026-09-28: a row says what happened to the order, nothing more:
 * Delivering, Completed, Refunded or Cancelled (plus the live states a
 * party must act on: Awaiting Payment, Delivered, Disputed). No dispute
 * outcome badges (Won / Lost / Closed / Partial): the order page carries
 * the dispute story. A cancelled order says Cancelled even when the payment
 * went back to the buyer's wallet; Refunded is only an order whose status
 * is refunded.
 */
export type ListStatusKey =
  | 'awaiting_payment'
  | 'delivering'
  | 'delivered'
  | 'disputed'
  | 'completed'
  | 'refunded'
  | 'cancelled'

export interface ListStatus {
  key: ListStatusKey
  label: string
}

const LABEL: Record<ListStatusKey, string> = {
  awaiting_payment: 'Awaiting Payment',
  delivering: 'Delivering',
  delivered: 'Delivered',
  disputed: 'Disputed',
  completed: 'Completed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
}

export function orderListStatus(status: string | null | undefined): ListStatus {
  const key: ListStatusKey =
    status === 'pending'
      ? 'awaiting_payment'
      : status === 'paid' || status === 'delivering'
        ? 'delivering'
        : status === 'delivered' || status === 'disputed' || status === 'completed' ||
            status === 'refunded' || status === 'cancelled'
          ? status
          : 'delivering'
  return { key, label: LABEL[key] }
}
