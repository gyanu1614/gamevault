/**
 * Rank Strikes Cron Job
 *
 * Runs monthly (1st, 04:00 UTC). Calls apply_rank_strikes(): a seller whose
 * trailing-90-day volume/quality no longer supports their rank gets a strike;
 * the second consecutive strike resets them to the highest rank they currently
 * qualify for. Passing months clear strikes. Pinned sellers are skipped.
 * (Daily upgrades stay in /api/cron/upgrade-seller-tiers.)
 *
 * Invoke via:
 *   GET /api/cron/rank-strikes
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/cron/rank-strikes", "schedule": "0 4 1 * *" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CRON_SECRET = process.env.CRON_SECRET

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceClient()

    const { data, error } = await supabase.rpc('apply_rank_strikes')

    if (error) {
      console.error('[rank-strikes] RPC error:', error)
      return NextResponse.json(
        { error: 'Failed to run rank strike check', details: error.message },
        { status: 500 }
      )
    }

    const demotedCount = data as number
    console.log(`[rank-strikes] Demoted ${demotedCount} sellers`)

    return NextResponse.json({
      success: true,
      demoted: demotedCount,
      message:
        demotedCount === 0
          ? 'No sellers demoted this month'
          : `Demoted ${demotedCount} seller${demotedCount === 1 ? '' : 's'} after two strikes`,
      ran_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[rank-strikes] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}

// Allow POST as well (for manual triggers from admin dashboard)
export async function POST(request: NextRequest) {
  return GET(request)
}
