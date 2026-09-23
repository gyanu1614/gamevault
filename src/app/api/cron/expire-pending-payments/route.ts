/**
 * Expire-pending-payments cron (every 30 min).
 *
 * Crypto orders expire themselves (BTCPay fires InvoiceExpired). Payssion
 * does NOT enforce our per-method windows (vouchers 48h, instant 1h), so a
 * buyer who walks away would leave the order pending forever. This sweep:
 *
 *   1. finds orders still 'pending' whose OPEN payment attempt expired (+5 min
 *      grace for a payment landing at the buzzer) — or, with no attempt, whose
 *      fallback expiry passed (round B: expired_pending_payment_attempts),
 *   2. cancels the transaction at Payssion (their notify then mirrors it),
 *   3. drives the SAME canonical cancel path the webhook uses — dispatch()
 *      handles the transition, wallet-credit return, nudge cleanup and the
 *      "Order Cancelled" notification, idempotently — so a racing webhook
 *      or a double-run can never double-apply.
 *
 * If Payssion says the transaction actually COMPLETED (paid at the last
 * second), the order is left alone — the completed webhook confirms it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'

const GRACE_MS = 5 * 60 * 1000
const BATCH = 50

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // PAY-020: constant-time bearer compare, fails closed when CRON_SECRET is unset.
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - GRACE_MS).toISOString()

  // Round B Part 1: the expiry lives on the order's OPEN payment attempt; an
  // order with no attempt at all (PAY-006: the charge was never created)
  // carries the fallback expiry stamped at insert. One service-role read.
  const { expiredPendingAttempts } = await import('@/lib/payments/attempts')
  let rows
  try {
    rows = await expiredPendingAttempts(cutoff, BATCH)
  } catch (e) {
    console.error('[ExpirePayments] fetch failed:', e)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
  if (!rows.length) {
    return NextResponse.json({ ok: true, expired: 0 })
  }

  const { payssionCancelTransaction } = await import('@/lib/payments/providers/payssion')
  const { dispatch } = await import('@/lib/payments/dispatch')

  let expired = 0
  let skippedPaid = 0
  for (const row of rows) {
    try {
      let state = 'cancelled'
      if (row.provider === 'payssion' && row.providerChargeId) {
        state = await payssionCancelTransaction(row.providerChargeId)
      }
      if (state === 'completed' || state === 'paid_more') {
        // Paid at the buzzer — leave it for the completed webhook.
        skippedPaid++
        continue
      }
      await dispatch(
        {
          type: 'CHARGE_FAILED',
          orderId: row.orderId,
          providerChargeId: row.providerChargeId ?? '',
          reason: 'expired:sweep',
        },
        `${row.providerChargeId ?? row.orderId}:expired-sweep`,
        row.providerChargeId ? row.provider ?? undefined : undefined,
        // We are closing it — the provider did not report it dead.
        { closeAttemptAs: 'void' }
      )
      expired++
    } catch (e) {
      console.error(`[ExpirePayments] order ${row.orderId} failed (retried next run):`, e)
    }
  }

  return NextResponse.json({ ok: true, expired, skippedPaid, scanned: rows.length })
}
