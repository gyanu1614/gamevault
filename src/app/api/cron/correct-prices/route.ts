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
import { revalidateTag } from 'next/cache'

import { PRICING_GAMES } from '@/lib/pricing/registry'
import { PRICE_CACHE_TAG } from '@/lib/sab/priceCache'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Next reads this as a literal only — it cannot follow a re-export or a
 * computed value (CLAUDE.md). 300s is the Vercel maximum; the scheduled path
 * lives on the runner precisely because even 300s was not enough for SAB.
 */
export const maxDuration = 300

/**
 * Repricing normally runs on the GH Actions runner (scripts/reprice.mjs), right
 * after each game's crawl. This route stays as a THIN MANUAL TRIGGER for one-off
 * re-runs — it is not on the scheduled path any more.
 *
 * It was the scheduled path until 2026-09-14, when the SAB read outgrew the
 * function budget and it 504'd on every crawl for five days without anyone
 * noticing. maxDuration below buys the manual path the full budget; the runner
 * is what makes the scheduled path reliable.
 *
 * The game list comes from the shared registry so this route and the runner can
 * never price different sets of games.
 */
const GAMES = PRICING_GAMES

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

  // Prices just changed (sab_price_display was refreshed inside the SAB run).
  // Revalidate the price-tagged ISR pages so they re-read the fresh snapshot on
  // their next request instead of serving up to an hour of stale cache. Reads
  // opt in via getCachedPrices() (unstable_cache + PRICE_CACHE_TAG); untagged
  // pages still refresh on their normal 1h ISR cycle.
  try {
    revalidateTag(PRICE_CACHE_TAG)
  } catch (error) {
    console.error('correct-prices: revalidateTag failed:', error)
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
