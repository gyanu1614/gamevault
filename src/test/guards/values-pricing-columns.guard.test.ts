/**
 * The pricing writer and the migration must agree about values_prices.
 *
 * A production run failed with `column values_prices.id does not exist`: the
 * paginating reader hardcoded `.order('id')`, which is right for values_items
 * and values_raw_listings but wrong for values_prices, whose primary key is
 * `item_id` with no surrogate id. Nothing caught it because the column name
 * lived in a string inside a `(client as any)` chain — invisible to tsc — and
 * the failure only appears against a real database.
 *
 * These tests read the MIGRATION as the source of truth and check the module's
 * strings against it, so the same class of drift fails in CI with no DB.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20260918225751_values_generic_pipeline.sql',
)
const MODULE = path.join(ROOT, 'src/lib/pricing/games/steal-an-egg.ts')

const sql = fs.readFileSync(MIGRATION, 'utf8')
const moduleSource = fs.readFileSync(MODULE, 'utf8')

/** Columns declared for one table in the migration. */
function columnsOf(table: string): string[] {
  const re = new RegExp(
    `create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`,
  )
  const body = sql.match(re)?.[1]
  if (!body) throw new Error(`table ${table} not found in the migration`)
  return body
    .split('\n')
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter(Boolean)
    // Skip table-level constraint lines; keep column definitions.
    .filter((line) => !/^(constraint|primary key|unique|check|foreign key)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0])
    .filter((name) => /^[a-z_]+$/.test(name))
}

const PRICE_COLUMNS = columnsOf('values_prices')
const HISTORY_COLUMNS = columnsOf('values_price_history')
const ITEM_COLUMNS = columnsOf('values_items')
const RAW_COLUMNS = columnsOf('values_raw_listings')

describe('values_prices schema contract', () => {
  it('is keyed by item_id and has NO surrogate id column', () => {
    // The bug in one line: anything ordering or filtering values_prices by
    // `id` is wrong, and will only fail against a real database.
    expect(PRICE_COLUMNS).toContain('item_id')
    expect(PRICE_COLUMNS).not.toContain('id')
  })

  it('declares every column the pricing writer sets', () => {
    // The row literal the module upserts into values_prices.
    const written = [
      'item_id',
      'game_id',
      'cheapest_usd',
      'average_usd',
      'market_low_usd',
      'market_high_usd',
      'sample_size',
      'source_count',
      'confidence_label',
      'price_changed_at',
      'updated_at',
    ]
    for (const column of written) {
      expect(PRICE_COLUMNS, `values_prices.${column}`).toContain(column)
    }
    // …and the module must still be writing exactly those.
    for (const column of written) {
      expect(moduleSource, `module no longer writes ${column}`).toContain(
        `${column}:`,
      )
    }
  })

  it('declares every column the history writer sets', () => {
    for (const column of [
      'item_id',
      'game_id',
      'history_date',
      'cheapest_usd',
      'average_usd',
      'sample_size',
    ]) {
      expect(HISTORY_COLUMNS, `values_price_history.${column}`).toContain(column)
    }
  })
})

describe('paginated reads order by a column that exists', () => {
  /**
   * Every `selectAll(admin, '<table>', '<columns>', '<orderBy>')` call: the
   * order key must be a real column of that table. This is the assertion that
   * would have caught the production failure.
   */
  const CALLS = [...moduleSource.matchAll(
    /selectAll<[\s\S]*?>\(\s*admin,\s*'([a-z_]+)',\s*'([^']*)',\s*(?:\/\/[^\n]*\n\s*)?'([a-z_]+)'/g,
  )].map((m) => ({ table: m[1], columns: m[2], orderBy: m[3] }))

  const COLUMNS: Record<string, string[]> = {
    values_prices: PRICE_COLUMNS,
    values_price_history: HISTORY_COLUMNS,
    values_items: ITEM_COLUMNS,
    values_raw_listings: RAW_COLUMNS,
  }

  it('finds every paginated read in the module', () => {
    // Guards the regex itself: if the call shape changes, this fails loudly
    // rather than silently checking nothing.
    expect(CALLS.length).toBeGreaterThanOrEqual(3)
  })

  it.each([
    ['values_items'],
    ['values_raw_listings'],
    ['values_prices'],
  ])('orders %s by one of its own columns', (table) => {
    const call = CALLS.find((c) => c.table === table)
    expect(call, `no paginated read of ${table} found`).toBeDefined()
    expect(COLUMNS[table]).toContain(call!.orderBy)
  })

  it('selects only columns the migration declares', () => {
    for (const call of CALLS) {
      const declared = COLUMNS[call.table]
      if (!declared) continue
      for (const column of call.columns.split(',').map((c) => c.trim())) {
        if (!column || column.includes('(')) continue
        expect(declared, `${call.table}.${column}`).toContain(column)
      }
    }
  })
})
