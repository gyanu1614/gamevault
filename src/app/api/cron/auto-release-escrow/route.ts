/**
 * Auto-complete cron (PR 7).
 *
 * Runs HOURLY from .github/workflows/auto-complete-orders.yml (Vercel Hobby
 * cannot schedule sub-daily crons; the vercel.json daily entry is the backstop).
 * Two idempotent, paginated steps:
 *   1. every delivered, unconfirmed order whose SafeDrop Protection window has
 *      closed → AUTO_RELEASED (seller credited in the same RPC, matures now);
 *   2. every delivered order past the halfway point of its window that has not
 *      been reminded → ONE "please confirm receipt" email + notification. The
 *      claim (order_confirm_reminders_claim) stamps confirm_reminder_sent_at
 *      atomically, so overlapping runs cannot send twice.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { releaseDueOrder, type AutoReleaseResult } from '@/lib/escrow/auto-release'
import { sendConfirmReminders } from '@/lib/escrow/confirm-reminders'
import { isCronAuthorized } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Orders per page — bounded so one run stays inside maxDuration. */
const AUTO_COMPLETE_PAGE = 200
/** Pages per run — 2,000 orders/hour is far beyond current volume. */
const AUTO_COMPLETE_MAX_PAGES = 10

export async function GET(request: NextRequest) {
  try {
    // PAY-020: constant-time bearer compare, fails closed when CRON_SECRET is unset.
    if (!isCronAuthorized(request.headers)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role: get_orders_ready_for_auto_release() is service-only
    // (DB-004). A cron request has no cookies, so a session client is anon.
    const supabase = createServiceRoleClient()

    const results: AutoReleaseResult[] = []
    let pages = 0
    while (pages < AUTO_COMPLETE_MAX_PAGES) {
      pages += 1
      const { data: orders, error: fetchError } = await (supabase.rpc as any)('get_orders_ready_for_auto_release', {
        p_limit: AUTO_COMPLETE_PAGE,
      })
      if (fetchError) {
        console.error('Error fetching orders ready for auto-release:', fetchError)
        return NextResponse.json(
          { error: 'Failed to fetch orders', details: fetchError.message },
          { status: 500 }
        )
      }
      const page: Array<{ id: string }> = orders ?? []
      if (page.length === 0) break

      // Gate re-check, atomic release + seller credit, and completion comms
      // all live in releaseDueOrder, shared with the admin manual trigger.
      const before = results.length
      for (const order of page) {
        results.push(await releaseDueOrder(order.id))
      }
      // A short page means the queue is drained; a page that released nothing
      // (every row skipped by a concurrent confirm/dispute) would otherwise be
      // refetched identically forever.
      if (page.length < AUTO_COMPLETE_PAGE || results.slice(before).every((r) => r.skipped)) break
    }

    const reminders = await sendConfirmReminders(supabase)

    const successCount = results.filter((r) => r.success && !r.skipped).length
    const skippedCount = results.filter((r) => r.skipped).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: results.length === 0 ? 'No orders ready for auto-release' : `Processed ${results.length} orders`,
      processed: results.length,
      successful: successCount,
      skipped: skippedCount,
      failed: failureCount,
      pages,
      reminders,
      results,
    })
  } catch (error: any) {
    console.error('Unexpected error in auto-release cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
