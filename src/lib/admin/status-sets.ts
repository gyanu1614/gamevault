/**
 * Status sets the admin numbers count and sum over — real values only
 * (orders_status_check, dispute_status_enum). Plain module: the client-side
 * admin header imports it too.
 *
 * orders.status: pending (unpaid checkout) | paid | delivering | delivered |
 * disputed | completed | cancelled | refunded. There is no 'processing'.
 */

/** Buyer paid and the money was not returned: what Revenue, GMV and fees sum. */
export const COLLECTED_ORDER_STATUSES = ['paid', 'delivering', 'delivered', 'disputed', 'completed'] as const

/**
 * Paid, not finished, not in dispute — the "Active / In progress" number.
 * Unpaid 'pending' checkouts are left out (nobody can act on them until the
 * buyer pays); 'delivered' is in (awaiting the buyer's confirmation).
 */
export const IN_PROGRESS_ORDER_STATUSES = ['paid', 'delivering', 'delivered'] as const

/**
 * Every dispute still needing work. Same split as the DB's
 * disputes_one_open_per_order index: open = not resolved_* and not closed.
 * There is no plain 'resolved' value.
 */
export const OPEN_DISPUTE_STATUSES = [
  'open',
  'under_review',
  'awaiting_seller_response',
  'awaiting_buyer_response',
  'escalated',
] as const

/** Finished disputes — what "Resolved" counts. */
export const FINISHED_DISPUTE_STATUSES = [
  'resolved_buyer_favor',
  'resolved_seller_favor',
  'resolved_partial',
  'closed',
] as const
