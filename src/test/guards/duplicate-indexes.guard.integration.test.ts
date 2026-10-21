/**
 * Guard: no duplicate or dead indexes on the hot tables (2026-10-20 usage
 * audit, B5/B8). Each one costs disk on a 500 MB plan and a write on every
 * insert/update of its table.
 *
 * Dropped, each with the index that still serves its lookups:
 *   sab_price_history_variant_time_idx         -> UNIQUE (brainrot_id, mutation_id, history_date)
 *   adopt_me_price_history_pet_variant_date_idx -> UNIQUE (pet_id, variant, history_date)
 *   idx_listings_category_id                    -> listings_category_id_idx (identical)
 *   idx_listings_slug                           -> UNIQUE listings_slug_key
 *   sab_market_evidence_display_variant_idx     -> ..._group_idx (it was a strict prefix)
 *   sab_market_raw_listings_source_idx          -> none needed: no query filters
 *                                                  source_id ordered by fetched_at (51 MB)
 */
import { describe, it, expect } from 'vitest'
import { DB_IS_LOCAL, runRolledBack } from './local-psql'

const DROPPED = [
  'sab_price_history_variant_time_idx',
  'adopt_me_price_history_pet_variant_date_idx',
  'idx_listings_category_id',
  'idx_listings_slug',
  'sab_market_evidence_display_variant_idx',
  'sab_market_raw_listings_source_idx',
]

const KEPT = [
  'sab_price_history_brainrot_id_mutation_id_history_date_key',
  'adopt_me_price_history_pet_id_variant_history_date_key',
  'listings_category_id_idx',
  'listings_slug_key',
  'sab_market_evidence_display_group_idx',
]

const present = (names: string[]) =>
  runRolledBack([
    `select coalesce(string_agg(indexname, ',' order by indexname), '') from pg_indexes
      where schemaname = 'public' and indexname in (${names.map((n) => `'${n}'`).join(',')})`,
  ])[0] ?? ''

describe.skipIf(!DB_IS_LOCAL)('duplicate indexes', () => {
  it('the duplicates are gone', () => {
    expect(present(DROPPED)).toBe('')
  })

  it('the index that serves each lookup is still there', () => {
    expect(present(KEPT).split(',').sort()).toEqual([...KEPT].sort())
  })
})
