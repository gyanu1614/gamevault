/**
 * SAB listing-lifecycle — THIN MANUAL TRIGGER.
 *
 * The job itself lives in src/lib/sab/expire-listings.ts and runs on the GH
 * Actions runner as its own workflow step between the crawl and the reprice
 * (scripts/expire-listings.mjs). This route stays for one-off re-runs and for
 * the daily vercel.json backstop; the reasoning, the guards and the history
 * are documented on the module.
 *
 * Why it moved (2026-09-20): as a route it scanned ~36–42k active listings and
 * then issued one UPDATE per distinct ended_at — millisecond fetched_at, so one
 * round-trip per listing — and was killed at Vercel's 300s budget in 3 of 8
 * runs. PR #76 made that failure fatal to the collect step (correctly), so
 * those runs never repriced either.
 */

import { NextRequest, NextResponse } from 'next/server'

import {
  ExpireListingsError,
  runExpireSabListings,
} from '@/lib/sab/expire-listings'

/**
 * Next reads this as a literal only (CLAUDE.md). 300s is the Vercel maximum;
 * the scheduled path lives on the runner precisely because even 300s was not
 * reliably enough here.
 */
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await runExpireSabListings())
  } catch (error: any) {
    if (error instanceof ExpireListingsError) {
      console.error(`Failed to ${error.stage} SAB listings:`, error.message)
      return NextResponse.json(
        error.stage === 'read'
          ? { error: 'Failed to read listings', details: error.message }
          : {
              error: 'Failed to expire listings',
              details: error.message,
              expired: error.expired,
            },
        { status: 500 },
      )
    }
    console.error('Unexpected error in expire-sab-listings cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message ?? String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
