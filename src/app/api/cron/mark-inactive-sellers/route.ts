/**
 * Mark Inactive Sellers Offline Cron Job
 *
 * Marks sellers as offline if they haven't been active for 5 minutes
 * This should be called by a cron service every 5 minutes
 *
 * Also carries the nightly rate_limits sweep (migration 20260916100000).
 * Counter rows are only meaningful for the length of their own window, so
 * without a sweep the table grows unbounded — one row per (key, window), i.e.
 * per IP per route per minute. It rides along here rather than in its own
 * Vercel cron entry because the sweep is a single DELETE and this is the
 * existing daily job.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isCronAuthorized } from '@/lib/security/cron-auth'

// Must be set in environment variables. No fallback — fail closed if unset

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    // PAY-020: constant-time bearer compare, fails closed when CRON_SECRET is unset.
    if (!isCronAuthorized(request.headers)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role: mark_inactive_sellers_offline() is service-only (DB-006).
    // The session client used before had no cookies on a cron request, so
    // the RPC ran as anon.
    const supabase = createServiceRoleClient()

    // Call the database function to mark inactive sellers offline
    const { error } = await supabase.rpc('mark_inactive_sellers_offline')

    if (error) {
      console.error('Error marking inactive sellers offline:', error)
      return NextResponse.json(
        { error: 'Failed to mark sellers offline', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Successfully marked inactive sellers as offline')

    // Nightly rate-limit sweep. Runs AFTER the primary work and never fails
    // the route: housekeeping must not turn into a red cron run, and a missed
    // sweep only costs disk until tomorrow's pass.
    let rateLimitRowsDeleted: number | null = null
    const { data: swept, error: sweepError } = await (supabase as any).rpc(
      'rate_limits_cleanup',
      { p_retain_seconds: 86400 }
    )
    if (sweepError) {
      console.error('[RateLimitSweep] cleanup failed:', sweepError.message)
    } else {
      rateLimitRowsDeleted = swept ?? 0
      console.log(`🧹 Swept ${rateLimitRowsDeleted} stale rate_limits rows`)
    }

    return NextResponse.json({
      success: true,
      message: 'Inactive sellers marked offline',
      rateLimitRowsDeleted,
    })
  } catch (error: any) {
    console.error('Unexpected error in mark-inactive-sellers cron:', error)
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
