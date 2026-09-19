/**
 * Nightly retention: roll SAB raw listings older than 30 days into the daily
 * summary, then prune them.
 *
 *   pnpm retention:sab                # 30-day default
 *   pnpm retention:sab --retain-days 60
 *   pnpm retention:sab --dry-run      # report what WOULD be pruned
 *
 * The table grew from ~90k to ~137k rows in five days and that growth is what
 * pushed repricing past its budget. Repricing no longer reads the whole table,
 * but unbounded growth still slows every scan over it, so the raw detail ages
 * out and the daily shape stays.
 *
 * All the work is one service-role RPC (sab_roll_up_raw_listings): the rollup
 * and the prune must not be two round-trips, or a failure between them deletes
 * rows that were never summarised.
 */

import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const args = { retainDays: 30, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true
    else if (argv[i] === '--retain-days') {
      args.retainDays = Number(argv[i + 1])
      i += 1
    }
  }
  return args
}

async function main() {
  const { retainDays, dryRun } = parseArgs(process.argv.slice(2))

  if (!Number.isInteger(retainDays) || retainDays < 1) {
    console.error(`--retain-days must be a positive integer, got: ${retainDays}`)
    process.exitCode = 1
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
    )
    process.exitCode = 1
    return
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const cutoff = new Date(Date.now() - retainDays * 86_400_000)
    .toISOString()
    .slice(0, 10)

  if (dryRun) {
    const { count, error } = await admin
      .from('sab_market_raw_listings')
      .select('id', { count: 'exact', head: true })
      .lt('observed_at', `${cutoff}T00:00:00Z`)

    if (error) {
      console.error(`dry run failed: ${error.message}`)
      process.exitCode = 1
      return
    }
    console.log(
      `DRY RUN: ${count ?? 0} row(s) observed before ${cutoff} would be ` +
        `rolled up and pruned.`,
    )
    return
  }

  console.log(`Rolling up SAB raw listings observed before ${cutoff} …`)
  const startedAt = Date.now()
  const { data, error } = await admin.rpc('sab_roll_up_raw_listings', {
    retain_days: retainDays,
  })

  if (error) {
    console.error(`sab_roll_up_raw_listings failed: ${error.message}`)
    process.exitCode = 1
    return
  }

  const summary = Array.isArray(data) ? data[0] : data
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `✅ rolled ${summary?.days_rolled ?? 0} day(s), ` +
      `pruned ${summary?.rows_pruned ?? 0} row(s) in ${seconds}s`,
  )
}

main().catch((error) => {
  console.error(`retention: ${error?.message ?? error}`)
  process.exitCode = 1
})
