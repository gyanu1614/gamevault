/**
 * Reconcile-payments cron (every 15 min, GitHub Actions — see
 * .github/workflows/reconcile-payments.yml; Vercel Hobby rejects sub-daily
 * schedules in vercel.json, so this route is deliberately NOT listed there).
 *
 * Round B Part 2: drains provider_cancel_outbox — charges the money RPCs
 * closed in their own transaction and that still need voiding at the
 * provider (a superseded invoice, a cancelled voucher, an orphaned late
 * activation). Retries back off; the cap alerts admins once.
 *
 * Authenticated with the same CRON_SECRET bearer as every /api/cron route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OUTBOX_BATCH = 50

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

  return NextResponse.json({ ok: true, outbox })
}
