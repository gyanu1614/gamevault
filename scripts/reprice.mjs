/**
 * Reprice a game, on the RUNNER — not in a Vercel function.
 *
 *   pnpm reprice --game=sab
 *   pnpm reprice --game=steal-an-egg
 *   pnpm reprice --game=sab --full     # backfill: rewrite every row
 *   pnpm reprice --all
 *
 * WHY THIS EXISTS. Repricing used to be a POST to /api/cron/correct-prices at
 * the end of each crawl. On 2026-09-14 that route began exceeding the 300s
 * Vercel function budget — sab_market_raw_listings had grown from ~90k to ~137k
 * rows — and it 504'd on every single run afterwards. triggerCron logged the
 * failure and returned, so the workflow stayed green while
 * sab_price_corrections sat frozen and 214 of 393 brainrots served five-day-old
 * prices behind a confident "Updated" badge.
 *
 * A GH Actions runner has no such limit (the job already budgets 120 minutes),
 * it is where the crawl that produces the data already runs, and — the part
 * that actually matters — a failure here FAILS THE JOB instead of scrolling
 * past in a log nobody reads.
 *
 * The route stays as a thin manual trigger for one-off re-runs.
 *
 * Run with tsx: the pricing modules are app TypeScript that imports through the
 * `@/` alias, which Node's type-stripper cannot resolve.
 */

import process from 'node:process'

import { findPricingGame, pricingGameKeys } from '../src/lib/pricing/registry.ts'

function parseArgs(argv) {
  const args = { games: [], full: false }
  for (const arg of argv) {
    if (arg === '--full') args.full = true
    else if (arg === '--all') args.games = pricingGameKeys()
    else if (arg.startsWith('--game=')) args.games.push(arg.slice('--game='.length))
  }
  return args
}

async function main() {
  const { games, full } = parseArgs(process.argv.slice(2))

  if (!games.length) {
    console.error(
      `Usage: pnpm reprice --game=<${pricingGameKeys().join('|')}> [--full]\n` +
        `       pnpm reprice --all [--full]`,
    )
    process.exitCode = 1
    return
  }

  // Fail fast and loudly on an unknown slug rather than silently pricing
  // nothing — "no such game" must never look like a successful run.
  const unknown = games.filter((key) => !findPricingGame(key))
  if (unknown.length) {
    console.error(
      `Unknown game(s): ${unknown.join(', ')}. ` +
        `Known: ${pricingGameKeys().join(', ')}`,
    )
    process.exitCode = 1
    return
  }

  const failures = []

  for (const key of games) {
    const game = findPricingGame(key)
    const startedAt = Date.now()
    console.log(`\n▶ Repricing ${key}${full ? ' (full)' : ''} …`)
    try {
      const summary = await game.run({ full })
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.log(`✅ ${key} repriced in ${seconds}s`)
      console.log(JSON.stringify(summary, null, 2))
    } catch (error) {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.error(`❌ ${key} FAILED after ${seconds}s: ${error?.message ?? error}`)
      if (error?.stack) console.error(error.stack)
      failures.push(key)
    }
  }

  // Every game runs even if an earlier one fails (they are independent), but
  // ANY failure fails the job. This is the whole point of moving off the route:
  // a broken reprice must be a red workflow, not a log line.
  if (failures.length) {
    console.error(`\nReprice failed for: ${failures.join(', ')}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`reprice: ${error?.message ?? error}`)
  process.exitCode = 1
})
