/**
 * Expire vanished SAB listings, on the RUNNER — not in a Vercel function.
 *
 *   pnpm sab:expire
 *
 * WHY THIS EXISTS. The collector used to call /api/cron/expire-sab-listings at
 * the end of each crawl. That route read ~36–42k active listings and issued
 * one UPDATE per distinct ended_at — millisecond fetched_at, so one round-trip
 * per listing — and ran 96–265s when it finished. Vercel killed it at the 300s
 * budget in 3 of 8 runs on 2026-09-19/20 ("fetch failed" at exactly 301s).
 * PR #76 made a failed post-crawl trigger fatal to the collect step, which is
 * right, but it meant each of those runs also skipped its reprice.
 *
 * The runner has no such limit, it is where the crawl that produced the data
 * already ran, and a failure here fails the job. The decision is unchanged
 * (src/lib/sab/expire-listings.ts); the write is one RPC per 1000 ids.
 *
 * Run with tsx: the module is app TypeScript importing through `@/`.
 */

import process from 'node:process'

import { runExpireSabListings } from '../src/lib/sab/expire-listings.ts'

async function main() {
  const startedAt = Date.now()
  console.log('\n▶ Expiring vanished SAB listings …')
  try {
    const summary = await runExpireSabListings()
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`✅ expired ${summary.expired} listing(s) in ${seconds}s`)
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.error(`❌ expire FAILED after ${seconds}s: ${error?.message ?? error}`)
    if (error?.stack) console.error(error.stack)
    // A broken lifecycle step must be a red workflow, not a log line — the
    // whole point of moving off the route.
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`expire: ${error?.message ?? error}`)
  process.exitCode = 1
})
