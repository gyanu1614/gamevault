/**
 * sab_end_listings(uuid[]) — the set-based write behind the expire job.
 *
 * /api/cron/expire-sab-listings used to issue one UPDATE per distinct
 * ended_at. ended_at is the listing's own fetched_at, which has millisecond
 * precision, so that was one round-trip per listing — thousands per run. The
 * route ran 96–265s when it finished and was killed at Vercel's 300s budget in
 * 3 of 8 runs on 2026-09-19/20 ("fetch failed" at exactly 301s). PR #76 made
 * that failure fatal to the collect step, so those runs never repriced.
 *
 * One RPC per 1000 ids sets ended_at from the row's own fetched_at server-side.
 * This static read pins the properties that keep it safe to replay.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function sql(): string {
  const file = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith('_sab_end_listings.sql'),
  )
  if (!file) throw new Error('sab_end_listings migration not found')
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

describe('sab_end_listings', () => {
  const body = sql()

  it('sets ended_at to the row\'s OWN fetched_at — the last moment we saw it', () => {
    // Not now(): survival analysis needs when the listing was last observed,
    // which is why the route grouped by ended_at in the first place.
    expect(body).toMatch(/ended_at\s*=\s*fetched_at/)
    expect(body).toMatch(/listing_status\s*=\s*'ended'/)
  })

  it('touches only rows that are still active, so a replayed batch is a no-op', () => {
    // The read-then-write window: an import may have refreshed a listing in
    // between. Re-asserting the guard server-side keeps the retry idempotent.
    expect(body).toMatch(/where id = any\(p_ids\)\s*and listing_status = 'active'/)
  })

  it('is service-role only and pins search_path', () => {
    expect(body).toMatch(
      /revoke all on function public\.sab_end_listings\(uuid\[\]\) from public, anon, authenticated/,
    )
    expect(body).toMatch(/grant execute on function public\.sab_end_listings\(uuid\[\]\) to service_role/)
    expect(body).toContain('set search_path = public')
  })
})
