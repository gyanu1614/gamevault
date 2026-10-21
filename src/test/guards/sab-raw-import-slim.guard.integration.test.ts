/**
 * Guard: the SAB raw import stays light (2026-10-20 usage audit, B1/C3).
 *
 * sab_market_raw_listings was 310 MB of a 500 MB plan. Every crawl stored the
 * whole collected item as raw_payload (the reprice reads 4 keys of it) and
 * re-ran the title parser twice per re-observed listing: once on the INSERT
 * attempt of the upsert, once on UPDATE OF title.
 *
 * Proven on the local stack inside one psql transaction that rolls back, so
 * nothing is left behind (no fixture rows, no sab_import_runs rows).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

const DB_URL = process.env.SUPABASE_DB_URL ?? ''
const host = (() => {
  try {
    return new globalThis.URL(DB_URL).hostname
  } catch {
    return ''
  }
})()
const LOCAL = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)

const SOURCE = 'guardtest-raw-slim'
const item = (over: Record<string, unknown> = {}) =>
  JSON.stringify([
    {
      external_listing_id: 'slim-1',
      title: 'Guard Test Raw Listing',
      listed_price: '5',
      total_price_usd: '5',
      seller_name: 'someone',
      seller_sales_count: 12,
      is_canonical_band: 'false',
      income_band: { lower: 1, upper: 2 },
      collector_version: 'v6',
      signals: { a: 1, b: [1, 2, 3] },
      ...over,
    },
  ]).replace(/'/g, "''")

/** Runs the statements in one transaction that always rolls back. Each
 *  `select` prints one `|`-separated line. */
function runRolledBack(statements: string[]): string[] {
  const script = ['BEGIN;', ...statements.map((s) => `${s};`), 'ROLLBACK;'].join('\n')
  const out = execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '|', '-c', script], {
    stdio: 'pipe',
  })
  return out.toString().trim().split('\n').filter(Boolean)
}

const imp = (json: string) =>
  `select records_inserted || '/' || records_updated from public.sab_import_market_listings('${SOURCE}', '${json}'::jsonb)`
const status = `select parse_status || '/' || total_price_usd from public.sab_market_raw_listings where external_listing_id = 'slim-1'`
const markPending = `update public.sab_market_raw_listings set parse_status = 'pending' where external_listing_id = 'slim-1'`

describe.skipIf(!LOCAL)('sab_import_market_listings stays light', () => {
  const setup = `insert into public.sab_market_sources (slug, name, collection_method, status) values ('${SOURCE}', 'Guard Raw Slim', 'scraper', 'active')`

  it('stores only the payload keys anything reads', () => {
    const [, keys] = runRolledBack([
      setup,
      imp(item()),
      `select string_agg(k, ',' order by k) from public.sab_market_raw_listings l, jsonb_object_keys(l.raw_payload) k where l.external_listing_id = 'slim-1'`,
    ])
    expect(keys).toBe('income_band,is_canonical_band,seller_sales_count,title')
  })

  it('keeps income_band.upper (the reprice reads raw_payload->income_band->>upper)', () => {
    const [, band] = runRolledBack([
      setup,
      imp(item()),
      `select raw_payload -> 'income_band' ->> 'upper' from public.sab_market_raw_listings where external_listing_id = 'slim-1'`,
    ])
    expect(band).toBe('2')
  })

  it('a re-crawl with the same title updates the row without re-running the parser', () => {
    const lines = runRolledBack([setup, imp(item()), markPending, imp(item({ listed_price: '6', total_price_usd: '6' })), status])
    expect(lines[0]).toBe('1/0') // first import inserted
    expect(lines[1]).toBe('0/1') // second import updated
    // The parser would have overwritten 'pending'; the price still moved.
    expect(lines[2]).toBe('pending/6.00')
  })

  it('a changed title is parsed again', () => {
    const lines = runRolledBack([setup, imp(item()), markPending, imp(item({ title: 'Guard Test Raw Listing Renamed' })), status])
    expect(lines[2]).not.toMatch(/^pending\//)
  })

  it('sab_reparse_market_listings still forces a re-parse', () => {
    const lines = runRolledBack([setup, imp(item()), markPending, `select processed_count from public.sab_reparse_market_listings(1)`, status])
    expect(lines[1]).toBe('1')
    expect(lines[2]).not.toMatch(/^pending\//)
  })
})
