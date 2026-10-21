/**
 * Guard: raw market tables stay bounded (2026-10-20 usage audit, B2/B4/C4).
 *
 * values_raw_listings (188 MB) and adopt_me_market_raw_listings (79 MB) kept
 * every crawl's rows forever, although pricing reads only active rows. The
 * SAB rollup filtered on `(observed_at at time zone 'utc')::date < cutoff`,
 * which no index can serve, so each night read the 300 MB table twice.
 *
 * Behaviour is proven on the local stack in rolled-back transactions.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DB_IS_LOCAL, runRolledBack } from './local-psql'

const TAG = 'guardtest-retention'
const ago = (days: number) => `now() - interval '${days} days'`

const valuesRow = (offer: string, active: boolean, days: number) =>
  `insert into public.values_raw_listings (game_id, source, source_offer_id, title, price_usd, is_active, observed_at)
   values ((select id from public.games order by slug limit 1), 'eldorado', '${TAG}-${offer}', '${TAG}', 1, ${active}, ${ago(days)})`

const PET = `insert into public.adopt_me_pets (slug, name, rarity) values ('${TAG}', '${TAG}', 'common')`
const amRow = (seller: string, status: 'active' | 'ended', collectedDays: number, endedDays: number | null) =>
  `insert into public.adopt_me_market_raw_listings (pet_id, variant, price_usd, seller_id, title, listing_status, collected_at, ended_at)
   values ((select id from public.adopt_me_pets where slug = '${TAG}'), 'N', 1, '${TAG}-${seller}', '${TAG}', '${status}', ${ago(collectedDays)}, ${endedDays == null ? 'null' : ago(endedDays)})`

describe.skipIf(!DB_IS_LOCAL)('raw_market_prune', () => {
  const run = () =>
    runRolledBack([
      valuesRow('old-inactive', false, 5),
      valuesRow('new-inactive', false, 1),
      valuesRow('old-active', true, 10),
      PET,
      amRow('ended-long-ago', 'ended', 12, 10),
      amRow('ended-recently', 'ended', 3, 2),
      amRow('active-old', 'active', 30, null),
      amRow('ended-no-date', 'ended', 10, null),
      `select values_rows_pruned || '/' || adopt_me_rows_pruned from public.raw_market_prune()`,
      `select string_agg(source_offer_id, ',' order by source_offer_id) from public.values_raw_listings where title = '${TAG}'`,
      `select string_agg(seller_id, ',' order by seller_id) from public.adopt_me_market_raw_listings where title = '${TAG}'`,
    ])

  it('deletes inactive values rows older than 3 days and Adopt Me rows ended over 7 days ago', () => {
    const [pruned] = run()
    expect(pruned).toBe('1/2')
  })

  it('keeps every active row and the recent history', () => {
    const [, values, adoptMe] = run()
    expect(values).toBe(`${TAG}-new-inactive,${TAG}-old-active`)
    expect(adoptMe).toBe(`${TAG}-active-old,${TAG}-ended-recently`)
  })

  it('refuses a nonsense window instead of deleting everything', () => {
    expect(() => runRolledBack([`select * from public.raw_market_prune(0, 7)`])).toThrow(/must be >= 1/)
  })
})

describe.skipIf(!DB_IS_LOCAL)('sab_roll_up_raw_listings still rolls up and prunes by day', () => {
  it('prunes rows observed before the cutoff day and keeps the rest', () => {
    const lines = runRolledBack([
      `insert into public.sab_market_sources (slug, name, collection_method, status) values ('${TAG}', '${TAG}', 'scraper', 'active')`,
      `insert into public.sab_market_raw_listings (source_id, external_listing_id, listing_type, title, listed_price, total_price_usd, observed_at)
       select id, '${TAG}-old', 'active_listing', '${TAG}', 1, 1, ${ago(40)} from public.sab_market_sources where slug = '${TAG}'`,
      `insert into public.sab_market_raw_listings (source_id, external_listing_id, listing_type, title, listed_price, total_price_usd, observed_at)
       select id, '${TAG}-new', 'active_listing', '${TAG}', 1, 1, ${ago(5)} from public.sab_market_sources where slug = '${TAG}'`,
      `select rows_pruned from public.sab_roll_up_raw_listings(30)`,
      `select string_agg(external_listing_id, ',') from public.sab_market_raw_listings where title = '${TAG}'`,
    ])
    expect(lines).toEqual(['1', `${TAG}-new`])
  })
})

describe('sab_roll_up_raw_listings can use its observed_at index', () => {
  // The latest definition wins: read the newest migration that defines it.
  const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
  const latest = readdirSync(MIGRATIONS)
    .filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes('function public.sab_roll_up_raw_listings('))
    .sort()
    .at(-1)!
  const sql = readFileSync(join(MIGRATIONS, latest), 'utf8')
  const body = sql.slice(sql.indexOf('function public.sab_roll_up_raw_listings('))

  it('filters on the raw observed_at column, not on a cast of it', () => {
    expect(body).not.toMatch(/where[^;]*\(observed_at at time zone 'utc'\)::date\s*</i)
    expect(body).toMatch(/observed_at\s*<\s*v_cutoff_at/)
  })
})
