/**
 * Wallet list math, kept pure so it can be tested.
 *
 * Purchases (buyer): the row is what the buyer paid; seller commission and
 * payout never appear. "Total spent" = paid orders that were not cancelled
 * or refunded ('pending' is an unpaid checkout).
 *
 * Sales (seller): sale = item price (subtotal — buyer-side fees are not the
 * seller's), fee = the commission that implies (sale − payout), net = what
 * the seller actually gets: 0 when refunded, the kept amount after a partial
 * refund, else seller_payout. So sale − fee = net on an ordinary sale.
 */

export const PURCHASE_IN_PROGRESS = ['paid', 'delivering', 'delivered', 'disputed'] as const

export function lifetimeSpentOf(orders: Array<{ status: string; total_amount?: number | null }>): number {
  const cents = orders
    .filter((o) => !['pending', 'cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + Math.round(Number(o.total_amount ?? 0) * 100), 0)
  return cents / 100
}

export function matchesPurchaseFilter(status: string, filter: string): boolean {
  if (filter === 'all') return true
  if (filter === 'in_progress') return (PURCHASE_IN_PROGRESS as readonly string[]).includes(status)
  return status === filter
}

export function saleRowAmounts(
  order: { status: string; subtotal?: number | null; total_amount?: number | null; seller_payout?: number | null },
  keptAfterPartial?: number,
): { amount: number; platformFee: number; netAmount: number } {
  const sale = Number(order.subtotal ?? order.total_amount ?? 0)
  const payout = Number(order.seller_payout ?? 0)
  const net = order.status === 'refunded' ? 0 : keptAfterPartial ?? payout
  return {
    amount: sale,
    platformFee: Math.max(0, Math.round((sale - payout) * 100) / 100),
    netAmount: net,
  }
}
