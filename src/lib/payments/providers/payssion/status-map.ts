/**
 * Payssion transaction state → canonical events.
 *
 *   completed (paid > 0) / paid_more → CHARGE_CONFIRMED
 *   completed with paid <= 0        → CHARGE_PENDING (suspicious — wait for
 *                                     the details to show real money; the
 *                                     confirm rule is paid > 0 AND completed)
 *   pending / awaiting_confirm /
 *   paid_partial                    → CHARGE_PENDING (partial = admin path,
 *                                     never an auto-confirm)
 *   failed / cancelled / expired /
 *   rejected / blocked / error      → CHARGE_FAILED (reason = state)
 *   refunded                        → REFUND_COMPLETED
 *   chargeback / disputed           → CHARGEBACK_OPENED
 *   refund_pending / refund_error /
 *   refund_failed / refund_cancelled→ no order event (refund bookkeeping)
 *
 * Dedupe event id = `${transaction_id}:${state}`.
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import { fromDecimal } from '@/lib/money'

/** The transaction object as returned by /api/v1/payment/details. */
export interface PayssionTxn {
  transaction_id: string
  pm_id?: string
  amount: string
  currency: string
  /** Our order UUID — Payssion echoes it as order_id (docs) or track_id (WHMCS). */
  order_id?: string
  track_id?: string
  paid?: string
  state: string
  created?: number
  updated?: number
}

export function payssionOrderId(txn: PayssionTxn): string {
  const id = txn.order_id ?? txn.track_id
  if (!id) throw new Error('payssion: transaction has no order_id/track_id — not ours')
  return id
}

export function payssionEventId(txn: PayssionTxn): string {
  return `${txn.transaction_id}:${txn.state}`
}

const FAILED_STATES = new Set(['failed', 'cancelled', 'expired', 'rejected', 'blocked', 'error'])
const PENDING_STATES = new Set(['pending', 'awaiting_confirm', 'paid_partial'])
const REFUND_NOOP_STATES = new Set([
  'refund_pending',
  'refund_error',
  'refund_failed',
  'refund_cancelled',
])

export function payssionToCanonical(txn: PayssionTxn): CanonicalEvent[] {
  const orderId = payssionOrderId(txn)
  const chargeId = txn.transaction_id
  const amount = fromDecimal(txn.amount, txn.currency.toUpperCase())
  const paid = Number(txn.paid ?? 0)

  if (txn.state === 'completed' || txn.state === 'paid_more') {
    if (!(paid > 0)) {
      // "completed" with zero paid never confirms — treat as still pending.
      return [{ type: 'CHARGE_PENDING', orderId, providerChargeId: chargeId }]
    }
    return [{ type: 'CHARGE_CONFIRMED', orderId, providerChargeId: chargeId, settled: amount }]
  }
  if (PENDING_STATES.has(txn.state)) {
    return [{ type: 'CHARGE_PENDING', orderId, providerChargeId: chargeId }]
  }
  if (FAILED_STATES.has(txn.state)) {
    return [{ type: 'CHARGE_FAILED', orderId, providerChargeId: chargeId, reason: txn.state }]
  }
  if (txn.state === 'refunded') {
    return [
      { type: 'REFUND_COMPLETED', orderId, refundId: `${chargeId}:refund`, amount },
    ]
  }
  if (txn.state === 'chargeback' || txn.state === 'disputed') {
    return [{ type: 'CHARGEBACK_OPENED', orderId, providerChargeId: chargeId, amount }]
  }
  if (REFUND_NOOP_STATES.has(txn.state)) {
    return []
  }
  // Unknown state: no event (the dedupe key still records we saw it).
  console.warn(`[Payssion] unmapped state "${txn.state}" on ${chargeId}`)
  return []
}
