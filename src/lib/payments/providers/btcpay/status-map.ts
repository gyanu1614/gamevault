/**
 * BTCPay invoice status → canonical event mapping (pure, table-tested).
 *
 * Greenfield invoice statuses:
 *   New        — invoice created, unpaid                     → no event
 *   Processing — payment seen on-chain, awaiting confs       → CHARGE_PENDING
 *   Settled    — fully paid & confirmed (incl. PaidOver, and
 *                Marked = admin manually settled a late/partial
 *                payment — that IS the sanctioned admin-queue path) → CHARGE_CONFIRMED
 *   Expired    — payment window closed (additionalStatus
 *                PaidPartial = underpaid)                    → CHARGE_FAILED
 *   Invalid    — payment failed / admin marked invalid       → CHARGE_FAILED
 *
 * Only Settled releases the money flow. The settled amount is the invoice's
 * EUR-priced amount — our ledger settles EUR; the crypto actually received
 * lives in BTCPay/the cold wallet and is reconciled at off-ramp time.
 *
 * Policy notes (design session 2026-09-03, round B Part 3):
 *   PaidOver    → order proceeds; the excess (Σ totalPaid × rate − amount)
 *                 rides on the event as `paid` and order_confirm_payment
 *                 credits it to the buyer's wallet (PAY-011).
 *   PaidLate    → invoice already Expired/Invalid; admin either marks it
 *                 Settled in BTCPay (webhook re-fires → normal flow) or
 *                 wallet-credits the buyer.
 *   PaidPartial → order cancels on expiry; the partial crypto received is
 *                 wallet-credited from the admin queue (manual v1).
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import { fromDecimal, type Money } from '@/lib/money'

export type BtcpayStatus = 'New' | 'Processing' | 'Settled' | 'Expired' | 'Invalid'

export type BtcpayAdditionalStatus =
  | 'None'
  | 'PaidLate'
  | 'PaidPartial'
  | 'PaidOver'
  | 'Marked'
  | 'Invalid'

/** A Greenfield invoice (fields we use), as returned by
 *  GET /api/v1/stores/{storeId}/invoices/{invoiceId}. */
export interface BtcpayInvoice {
  id: string
  storeId?: string
  status: string
  additionalStatus?: string
  amount: string // decimal string in `currency`
  currency: string // EUR for us
  metadata?: { orderId?: string; [k: string]: unknown }
  /** Unix seconds (Greenfield convention). */
  expirationTime?: number
  /** Unix seconds — when the invoice was created (chain-watch lower bound). */
  createdTime?: number
  checkoutLink?: string
}

/**
 * Map an authoritative (re-fetched) invoice to 0..1 canonical events.
 * Throws if the invoice carries no metadata.orderId — every invoice we mint
 * embeds it, so its absence means the invoice is not ours (e.g. created by
 * hand in the BTCPay UI) and must not drive any order transition.
 */
/**
 * PAY-011: what a PaidOver invoice actually received, in the invoice
 * currency — Σ totalPaid × rate over the payment methods, to the cent.
 * Undefined when any method that received money carries no usable rate:
 * an overpayment credit must never be a guess.
 */
export function btcpayPaidFromMethods(
  methods: ReadonlyArray<{ totalPaid?: string; rate?: string }>,
  currency: string
): Money | undefined {
  let total = 0
  let any = false
  for (const m of methods) {
    const paid = Number(m.totalPaid ?? 0)
    if (!(paid > 0)) continue
    const rate = Number(m.rate)
    if (!Number.isFinite(rate) || rate <= 0) return undefined
    total += paid * rate
    any = true
  }
  if (!any) return undefined
  return fromDecimal(total.toFixed(2), currency)
}

export function btcpayToCanonical(inv: BtcpayInvoice, paid?: Money): CanonicalEvent[] {
  const orderId = inv.metadata?.orderId
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('btcpay: invoice has no metadata.orderId (not a marketplace invoice)')
  }
  const chargeId = inv.id
  const extra = (inv.additionalStatus ?? 'None') as BtcpayAdditionalStatus

  switch (inv.status as BtcpayStatus) {
    case 'Processing':
      return [{ type: 'CHARGE_PENDING', orderId, providerChargeId: chargeId }]

    case 'Settled':
      return [
        {
          type: 'CHARGE_CONFIRMED',
          orderId,
          providerChargeId: chargeId,
          settled: fromDecimal(inv.amount, inv.currency),
          ...(paid ? { paid } : {}),
        },
      ]

    case 'Expired':
    case 'Invalid':
      return [
        {
          type: 'CHARGE_FAILED',
          orderId,
          providerChargeId: chargeId,
          reason: extra !== 'None' ? `${inv.status.toLowerCase()}:${extra}` : inv.status.toLowerCase(),
        },
      ]

    case 'New':
    default:
      return []
  }
}

/** Stable dedupe id: invoice id + authoritative status. Multiple webhook
 *  deliveries that re-fetch to the same state collapse to one event —
 *  including a stale Processing delivery arriving after Settled (it re-fetches
 *  Settled, dispatches CHARGE_CONFIRMED once, and the real Settled delivery
 *  then dedupes). */
export function btcpayEventId(inv: BtcpayInvoice): string {
  return `${inv.id}:${inv.status}`
}
