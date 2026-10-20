/**
 * Not-delivered sweep (every 15 min: a second step in
 * .github/workflows/reconcile-payments.yml — Vercel Hobby rejects sub-daily
 * crons — plus a daily vercel.json backstop).
 *
 * Finalizes every "Cancel – Not Delivered" report whose grace hour ran out:
 * order_not_delivered_finalize closes it to match the order, records a seller
 * response, or cancels the order as a seller fault through the refund seams.
 * Idempotent: the order page finalizes on view too, and a replay is a no-op
 * in SQL. One failing report never stops the rest; it stays open for the
 * next run and the run answers 500 so the workflow shows it.
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
  const { finalizeNotDelivered } = await import('@/lib/orders/not-delivered-finalize')

  const { data, error } = await (createServiceRoleClient() as any).rpc('order_not_delivered_due', { p_limit: BATCH })
  if (error) {
    console.error('[NotDeliveredSweep] list failed:', error.message)
    return NextResponse.json({ error: 'list failed' }, { status: 500 })
  }
  const ids: string[] = data ?? []
  let autoCancelled = 0
  let errors = 0
  for (const id of ids) {
    try {
      const r = await finalizeNotDelivered(id)
      if (r.outcome === 'auto_cancelled') autoCancelled++
    } catch (e) {
      errors++
      console.error('[NotDeliveredSweep] finalize failed:', id, e)
    }
  }
  return NextResponse.json({ due: ids.length, autoCancelled, errors }, { status: errors ? 500 : 200 })
}
