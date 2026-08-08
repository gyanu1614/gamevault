/**
 * Legacy SAB-only price-correction cron.
 *
 * The correction logic now lives in @/lib/pricing/games/sab (runSabCorrection),
 * shared with the unified /api/cron/correct-prices route. This endpoint stays as
 * a thin wrapper so anything still pointed at it (an old schedule, a manual
 * curl) keeps working with identical behaviour. New scheduling uses the unified
 * route; this can be removed once nothing references it.
 */

import { NextRequest, NextResponse } from 'next/server'

import { runSabCorrection } from '@/lib/pricing/games/sab'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const summary = await runSabCorrection()
    return NextResponse.json({ success: true, ...summary })
  } catch (error: any) {
    console.error('Unexpected error in correct-sab-prices cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
