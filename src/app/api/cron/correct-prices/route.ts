/**
 * Unified daily price-correction cron — all games, one route.
 *
 * Each game's reputable pricing runs here, isolated in its own try/catch so a
 * failure in one game (a slow read, a bad row) can never block another. Adding
 * a game is adding one entry to GAMES below — the shared reputable adapter does
 * the actual pricing for every game.
 *
 * SAB keeps its richer correction (income multipliers, cohort anchoring, floor
 * logic) via runSabCorrection; Adopt Me runs the plain reputable model. Both
 * write a buyer-facing cheapest + average.
 *
 * Scheduled after the collectors land (see vercel.json). Idempotent: re-running
 * fully repairs each game's corrected values.
 */

import { NextRequest, NextResponse } from 'next/server'

import { runSabCorrection } from '@/lib/pricing/games/sab'
import { runAdoptMeCorrection } from '@/lib/pricing/games/adopt-me'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * The game registry. Each entry owns its own read → price → write, so games
 * stay fully independent. `run` returns a small summary for the response.
 */
const GAMES: {
  key: string
  run: () => Promise<Record<string, unknown>>
}[] = [
  { key: 'sab', run: runSabCorrection },
  { key: 'adopt-me', run: runAdoptMeCorrection },
]

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional ?game=sab to run just one (manual re-runs / debugging).
  const only = request.nextUrl.searchParams.get('game')
  const games = only ? GAMES.filter((g) => g.key === only) : GAMES
  if (only && !games.length) {
    return NextResponse.json(
      { error: `Unknown game: ${only}` },
      { status: 400 },
    )
  }

  const results: Record<string, unknown> = {}
  let anyFailed = false

  // Sequential, each isolated: one game's failure is recorded and the rest
  // still run. (The work is DB-bound and light; parallelism isn't worth the
  // shared-connection contention here.)
  for (const game of games) {
    try {
      results[game.key] = { ok: true, ...(await game.run()) }
    } catch (error: any) {
      anyFailed = true
      console.error(`correct-prices: ${game.key} failed:`, error)
      results[game.key] = { ok: false, error: error?.message ?? String(error) }
    }
  }

  return NextResponse.json(
    { success: !anyFailed, games: results },
    // 207-ish: if some games failed but others succeeded, still 200 so the
    // successful writes aren't treated as a total failure by the scheduler.
    { status: 200 },
  )
}

export async function POST(request: NextRequest) {
  return GET(request)
}
