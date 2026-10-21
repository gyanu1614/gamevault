/**
 * Where a provider-hosted payment return lands the buyer (same-tab pay,
 * 2026-10-16). Pure: the return route reads the order + asks Payssion, then
 * asks this. The Order Paid page never claims "paid" on its own — it shows
 * "Confirming" until our DB says the webhook confirmed the order.
 */

/** Statuses reached THROUGH a successful payment (safedrop state machine). */
export const PAID_LIFECYCLE: ReadonlySet<string> = new Set(['paid', 'delivering', 'delivered', 'completed'])
const PROVIDER_PAID = new Set(['completed', 'paid_more'])
const PROVIDER_DEAD = new Set(['cancelled', 'failed', 'expired', 'rejected', 'blocked', 'error'])

export interface ReturnInput {
  orderId: string
  listingId: string
  quantity: number
  /** Our order status — the authority. */
  status: string
  /** The method's kind: a voucher may be paid hours later. */
  pmKind: 'instant' | 'voucher' | null
  /** Payssion's own state for the open charge; null when it could not be asked. */
  providerState: string | null
}

export function returnDestination(i: ReturnInput): string {
  const checkout = `/checkout/${i.listingId}?qty=${i.quantity}`
  const paidPage = `/checkout/paid/${i.orderId}`
  const orderPage = `/account/orders/${i.orderId}`

  if (i.status !== 'pending') {
    if (i.status === 'cancelled') return `${checkout}&cancelled=1`
    if (PAID_LIFECYCLE.has(i.status)) return paidPage
    return orderPage
  }
  if (i.providerState && PROVIDER_PAID.has(i.providerState)) return paidPage
  if (i.providerState && PROVIDER_DEAD.has(i.providerState)) return `${checkout}&cancelled=1`
  if (i.pmKind === 'voucher') return orderPage
  if (i.providerState === 'pending') return `${checkout}&order=${i.orderId}`
  return paidPage
}
