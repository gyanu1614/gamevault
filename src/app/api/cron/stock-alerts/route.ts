import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'
import { sendDueStockAlerts } from '@/lib/stock-alerts/dispatch'

/**
 * Daily backstop for Notify Me: sends any due stock alerts the post-mutation
 * dispatch missed (a send that failed and was released, a listing activated
 * by a DB-side edit). The normal path sends within seconds of the listing
 * going live (revalidateListingSurfaces → scheduleStockAlertDispatch).
 *
 * Auth: the same CRON_SECRET bearer every cron uses; unset → 401.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let sent = 0
  let failed = 0
  // Drain in batches; stop on a batch with nothing claimed or after a few rounds.
  for (let round = 0; round < 10; round += 1) {
    const r = await sendDueStockAlerts(100)
    sent += r.sent
    failed += r.failed
    if (r.sent + r.failed === 0) break
  }
  return NextResponse.json({ ok: true, sent, failed })
}
