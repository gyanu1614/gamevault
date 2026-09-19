/**
 * Retention SQL — the prune must never outrun the rollup.
 *
 * A static read of the migration, in the spirit of sab-refresh-display-sql:
 * the dangerous property here is a DELETE that removes rows the INSERT did not
 * summarise, and that is visible in the SQL itself.
 *
 * This is not hypothetical. The first draft rolled up only rows with a
 * non-null brainrot_id but pruned on age alone, so every listing the parse
 * trigger could not match (it nulls brainrot_id) was deleted with its volume
 * never recorded. Local verification reported rows_pruned=3 against
 * days_rolled=0 — silent data loss.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function retentionSql(): string {
  const file = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith('_sab_raw_listing_retention.sql'),
  )
  if (!file) throw new Error('retention migration not found')
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

describe('sab_roll_up_raw_listings', () => {
  const sql = retentionSql()

  it('summarises every row in the window, matched or not', () => {
    // The guard: no brainrot_id filter may narrow the rollup's SELECT, or
    // unmatched rows get pruned without ever being counted.
    const insertBlock = sql.slice(
      sql.indexOf('from public.sab_market_raw_listings'),
      sql.indexOf('group by 1, 2, 3'),
    )
    expect(insertBlock).not.toContain('brainrot_id is not null')
  })

  it('keeps the summary key idempotent over nullable columns', () => {
    // NULL != NULL, so a bare unique constraint would let duplicates through
    // and ON CONFLICT would never fire — the rollup would grow a new row per
    // run. The coalesced index is what makes a re-run a no-op.
    expect(sql).toContain('sab_raw_listing_daily_key')
    expect(sql).toMatch(/coalesce\(brainrot_id,\s*'00000000-0000-0000-0000-000000000000'/)
    expect(sql).toMatch(/coalesce\(mutation_id,\s*'00000000-0000-0000-0000-000000000000'/)
  })

  it('refuses a nonsense retention window instead of deleting everything', () => {
    expect(sql).toContain('retain_days must be >= 1')
  })

  it('is service-role only — it deletes rows', () => {
    expect(sql).toMatch(
      /revoke all on function public\.sab_roll_up_raw_listings\(integer\) from public, anon, authenticated/,
    )
    expect(sql).toContain('set search_path = public')
  })
})
