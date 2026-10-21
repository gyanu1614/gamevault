/**
 * Not-delivered sweep (every 15 min: a second step in
 * .github/workflows/reconcile-payments.yml — Vercel Hobby rejects sub-daily
 * crons — plus a daily vercel.json backstop).
 *
 * Syncs every "Cancel – Not Delivered" report whose response window ran out
 * (order_not_delivered_sync): it records a seller response made inside the
 * window, or marks the report expired and sends the "seller did not respond"
 * notices. It NEVER cancels or refunds — the buyer requests cancellation and
 * an admin decides. Idempotent: the order page syncs on view too. One failing
 * report never stops the rest; it stays as it was for the next run and the
 * run answers 500 so the workflow shows it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/security/cron-auth'

const BATCH = 50

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { createServiceRoleClient } = await import('@/lib/supabase/service')
  const { syncNotDelivered } = await import('@/lib/orders/not-delivered-sync')

  const { data, error } = await (createServiceRoleClient() as any).rpc('order_not_delivered_due', { p_limit: BATCH })
  if (error) {
    console.error('[NotDeliveredSweep] list failed:', error.message)
    return NextResponse.json({ error: 'list failed' }, { status: 500 })
  }
  const ids: string[] = data ?? []
  let expired = 0
  let errors = 0
  for (const id of ids) {
    try {
      const r = await syncNotDelivered(id)
      if (r.outcome === 'expired') expired++
    } catch (e) {
      errors++
      console.error('[NotDeliveredSweep] sync failed:', id, e)
    }
  }
  return NextResponse.json({ due: ids.length, expired, errors }, { status: errors ? 500 : 200 })
}
