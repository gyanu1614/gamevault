/**
 * Daily SAB Price Snapshot Cron Job
 *
 * Captures one immutable row per (brainrot, mutation) into sab_price_snapshots,
 * sourced from the public price catalog. Price history CANNOT be backfilled, so
 * this must run every day — each missed day is permanently lost data.
 *
 * Scheduled at 06:00 UTC (see vercel.json), after the other daily crons settle.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Must be set in environment variables. No fallback — fail closed if unset
// so a missing CRON_SECRET can never be triggered with a known default token.
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Capture today's catalog. Idempotent per calendar day (UTC).
    const { data, error } = await supabase.rpc('sab_capture_price_history')

    if (error) {
      console.error('Error capturing SAB price snapshot:', error)
      return NextResponse.json(
        { error: 'Failed to capture price snapshot', details: error.message },
        { status: 500 }
      )
    }

    const capturedCount = typeof data === 'number' ? data : 0
    console.log(`✅ Captured ${capturedCount} SAB price snapshot rows`)

    return NextResponse.json({
      success: true,
      captured: capturedCount,
      message: `Captured ${capturedCount} SAB price snapshot rows`,
    })
  } catch (error: any) {
    console.error('Unexpected error in snapshot-sab-prices cron:', error)
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
