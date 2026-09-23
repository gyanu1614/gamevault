/**
 * Reconcile-payments cron (every 15 min, GitHub Actions — see
 * .github/workflows/reconcile-payments.yml; Vercel Hobby rejects sub-daily
 * schedules in vercel.json, so this route is deliberately NOT listed there).
 *
 * Round B Part 2: drains provider_cancel_outbox — charges the money RPCs
 * closed in their own transaction and that still need voiding at the
 * provider (a superseded invoice, a cancelled voucher, an orphaned late
 * activation). Retries back off; the cap alerts admins once.
 * Round B Part 4: re-runs webhook events stuck `received` for > 15 min
 * (crash between claim and mark) from the events stored at claim time,
 * through the same dispatch; poison rows are capped and alerted once.
 *
 * Authenticated with the same CRON_SECRET bearer as every /api/cron route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OUTBOX_BATCH = 50
const STUCK_BATCH = 50

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { drainProviderCancelOutbox } = await import('@/lib/payments/cancel-outbox')
  let outbox
  try {
    outbox = await drainProviderCancelOutbox({ limit: OUTBOX_BATCH })
  } catch (e) {
    console.error('[ReconcilePayments] outbox drain failed:', e)
    return NextResponse.json({ ok: false, error: 'outbox drain failed' }, { status: 500 })
  }

  // Round B Part 4 (PAY-010): webhook events stuck `received` > 15 min are
  // re-run from their stored events through the same dispatch; poison rows
  // are capped and alerted once.
  const { reconcileStuckWebhookEvents } = await import('@/lib/payments/reconcile')
  let stuck
  try {
    stuck = await reconcileStuckWebhookEvents({ limit: STUCK_BATCH })
  } catch (e) {
    console.error('[ReconcilePayments] stuck webhook reconcile failed:', e)
    return NextResponse.json({ ok: false, outbox, error: 'stuck webhook reconcile failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, outbox, stuck })
}
