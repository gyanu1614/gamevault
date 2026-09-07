/**
 * Expire-pending-payments cron (every 30 min).
 *
 * Crypto orders expire themselves (BTCPay fires InvoiceExpired). Payssion
 * does NOT enforce our per-method windows (vouchers 48h, instant 1h), so a
 * buyer who walks away would leave the order pending forever. This sweep:
 *
 *   1. finds payssion orders still 'pending' past payment_expires_at (+5 min
 *      grace for a payment landing at the buzzer),
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
import { createServiceRoleClient } from '@/lib/supabase/service'

const CRON_SECRET = process.env.CRON_SECRET
const GRACE_MS = 5 * 60 * 1000
const BATCH = 50

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString()

  const { data: orders, error } = (await supabase
    .from('orders')
    .select('id, provider_charge_id, payment_expires_at')
    .eq('status', 'pending')
    .eq('payment_provider', 'payssion')
    .lt('payment_expires_at', cutoff)
    .limit(BATCH)) as any

  if (error) {
    console.error('[ExpirePayments] fetch failed:', error)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
  if (!orders?.length) {
    return NextResponse.json({ ok: true, expired: 0 })
  }

  const { payssionCancelTransaction } = await import('@/lib/payments/providers/payssion')
  const { dispatch } = await import('@/lib/payments/dispatch')

  let expired = 0
  let skippedPaid = 0
  for (const order of orders) {
    try {
      let state = 'cancelled'
      if (order.provider_charge_id) {
        state = await payssionCancelTransaction(order.provider_charge_id)
      }
      if (state === 'completed' || state === 'paid_more') {
        // Paid at the buzzer — leave it for the completed webhook.
        skippedPaid++
        continue
      }
      await dispatch(
        {
          type: 'CHARGE_FAILED',
          orderId: order.id,
          providerChargeId: order.provider_charge_id ?? '',
          reason: 'expired:sweep',
        },
        `${order.provider_charge_id ?? order.id}:expired-sweep`
      )
      expired++
    } catch (e) {
      console.error(`[ExpirePayments] order ${order.id} failed (retried next run):`, e)
    }
  }

  return NextResponse.json({ ok: true, expired, skippedPaid, scanned: orders.length })
}
