/**
 * Expire-pending-payments cron (every 30 min).
 *
 * Payssion does NOT enforce our per-method windows (vouchers 48h, instant
 * 1h), and a lost BTCPay InvoiceExpired webhook would leave a crypto order
 * pending too, so a buyer who walks away must be swept by us. This sweep:
 *
 *   1. finds orders still 'pending' whose OPEN payment attempt expired (+5 min
 *      grace for a payment landing at the buzzer) — or, with no attempt, whose
 *      fallback expiry passed (round B: expired_pending_payment_attempts),
 *   2. asks the provider to void the charge (round B: every provider; a
 *      charge the provider reports paid is skipped for its webhook),
 *   3. drives the SAME canonical cancel path the webhook uses — dispatch()
 *      handles the transition, wallet-credit return, nudge cleanup and the
 *      "Order Cancelled" notification, idempotently — so a racing webhook
 *      or a double-run can never double-apply.
 *
 * A void that fails is not fatal: the order is cancelled and the outbox
 * (provider_cancel_outbox, drained by /api/cron/reconcile-payments) retries
 * the provider with backoff and alerts once at the cap.
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

  const { getProvider } = await import('@/lib/payments/registry')
  const { dispatch } = await import('@/lib/payments/dispatch')

  let expired = 0
  let skippedPaid = 0
  let voidDeferred = 0
  for (const row of rows) {
    try {
      // Round B Part 2: ask the provider FIRST, for every provider. A charge
      // paid at the buzzer is left for its confirmation webhook; a voided /
      // already-closed / unsupported one is cancelled with its outbox row
      // written as done; a provider that cannot be reached is cancelled
      // anyway and the outbox drain voids it later with backoff.
      let voidOutcome: 'voided' | 'already_closed' | 'unsupported' | undefined
      if (row.provider && row.providerChargeId) {
        try {
          const v = await getProvider(row.provider).voidCharge(row.providerChargeId)
          if (v.outcome === 'paid') {
            skippedPaid++
            continue
          }
          voidOutcome = v.outcome
        } catch (e) {
          voidDeferred++
          console.error(`[ExpirePayments] void of ${row.provider}/${row.providerChargeId} failed (outbox retries):`, e)
        }
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
        { closeAttemptAs: 'void', providerVoidOutcome: voidOutcome }
      )
      expired++
    } catch (e) {
      console.error(`[ExpirePayments] order ${row.orderId} failed (retried next run):`, e)
    }
  }

  return NextResponse.json({ ok: true, expired, skippedPaid, voidDeferred, scanned: rows.length })
}
