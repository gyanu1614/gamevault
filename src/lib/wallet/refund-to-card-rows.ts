/**
 * Wallet "Refund To Card" rows (refund rule, 2026-10-16).
 *
 * Every refund lands as store credit for the item price. Any refunded order
 * paid through a provider can go back to that payment method for the FULL
 * amount (store credit + the kept service fee). The numbers come from SQL
 * (refund_to_source_quotes); this only maps a row to what the card shows.
 */

export type RefundToCardState =
  | 'available'
  | 'store_credit_only'
  | 'credit_spent'
  | 'requested'
  | 'sent'
  | 'rejected'
  | 'failed'

export interface RefundToCardRow {
  orderId: string
  orderNumber: string
  /** Store credit this order put in the Store Balance (the item price). */
  creditMinor: number
  /** Service fee kept on the refund; a card refund pays it back. */
  feeMinor: number
  /** What a card refund sends: creditMinor + feeMinor. */
  totalMinor: number
  currency: string
  methodLabel: string | null
  state: RefundToCardState
}

export interface RefundToCardQuoteRow {
  order_id: string
  order_number: string | null
  credit_minor: number | string
  fee_minor: number | string
  total_minor: number | string
  currency: string
  method_label: string | null
  refundable: boolean | null
  request_status: string | null
}

export function toRefundToCardRow(r: RefundToCardQuoteRow, walletBalanceMinor: number): RefundToCardRow {
  const creditMinor = Number(r.credit_minor)
  const status = r.request_status
  const state: RefundToCardState =
    status === 'pending' || status === 'approved'
      ? 'requested'
      : status === 'sent'
        ? 'sent'
        : status === 'rejected'
          ? 'rejected'
          : status === 'failed'
            ? 'failed'
            : r.refundable !== true
              ? 'store_credit_only'
              : walletBalanceMinor < creditMinor
                ? 'credit_spent'
                : 'available'
  return {
    orderId: r.order_id,
    orderNumber: r.order_number || r.order_id.slice(0, 8).toUpperCase(),
    creditMinor,
    feeMinor: Number(r.fee_minor),
    totalMinor: Number(r.total_minor),
    currency: r.currency,
    methodLabel: r.method_label ?? null,
    state,
  }
}

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`

/** Rows worth showing: a choice to make or a request under way. Nothing to do means no row. */
export const refundRowsToShow = (rows: readonly RefundToCardRow[]): RefundToCardRow[] =>
  rows.filter((r) => r.state !== 'store_credit_only' && r.state !== 'credit_spent')

/** One plain sentence per refund. `#order` is in there so the row can link it. */
export function refundSentence(row: RefundToCardRow): string {
  const method = row.methodLabel ?? 'your payment method'
  const order = `#${row.orderNumber}`
  switch (row.state) {
    case 'available':
      return `Your refund for order ${order} is in your balance as ${money(row.creditMinor)} store credit. Want it back on ${method} instead? You'd get ${money(row.totalMinor)}, service fee included.`
    case 'requested':
      return `We're sending ${money(row.totalMinor)} back to ${method} for order ${order}. Support reviews it within 48 hours.`
    case 'sent':
      return `We sent ${money(row.totalMinor)} back to ${method} for order ${order}.`
    case 'rejected':
      return `We couldn't send your refund for order ${order} back to ${method}, so ${money(row.creditMinor)} stays in your balance as store credit.`
    case 'failed':
      return `Sending your refund for order ${order} back to ${method} didn't go through. Please contact Support.`
    default:
      return ''
  }
}
