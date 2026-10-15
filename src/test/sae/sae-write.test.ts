import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error -- plain .mjs script helper
import { dedupeOffers } from '../../../scripts/lib/sae-write.mjs'

/**
 * Bug (Values Pricing Daily, Oct 13): the Steal an Egg job died with
 * "duplicate key … values_raw_listings_source_offer_key" — the unique key is
 * (source, source_offer_id, observed_at) and every row of a run shares one
 * timestamp, so one Eldorado offer seen twice in a paged crawl broke the
 * insert. Worse, yesterday's rows had already been switched off, so that
 * day's prices were skipped.
 */
describe('Steal an Egg raw listing write', () => {
  it('keeps one row per offer (the first sighting)', () => {
    const out = dedupeOffers([
      { source: 'eldorado', source_offer_id: 'a', price_usd: 1 },
      { source: 'eldorado', source_offer_id: 'b', price_usd: 2 },
      { source: 'eldorado', source_offer_id: 'a', price_usd: 1 },
      { source: 'g2g', source_offer_id: 'a', price_usd: 3 },
    ])
    expect(out.map((l: { source: string; source_offer_id: string }) => `${l.source}:${l.source_offer_id}`)).toEqual(['eldorado:a', 'eldorado:b', 'g2g:a'])
  })

  it.each([
    ['scripts/lib/sae-write.mjs', 'export async function writeListings'],
    ['scripts/lib/values-import.mjs', 'export async function importEldoradoFeed'],
  ])('%s writes the new rows BEFORE switching the old ones off (a failed insert keeps yesterday counting)', (file, fn) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8')
    const body = src.slice(src.indexOf(fn))
    expect(body).toContain('dedupeOffers(')
    expect(body.indexOf(".insert(")).toBeGreaterThan(-1)
    expect(body.indexOf(".insert(")).toBeLessThan(body.indexOf(".update({ is_active: false })"))
  })
})

// @ts-expect-error -- plain .mjs script helper
import { walkDone } from '../../../scripts/lib/offers.mjs'

describe('cheapest-first walk stop rule (MM2 + Steal an Egg collectors)', () => {
  it('keeps reading past the first page count while pages are full (the list grew)', () => {
    expect(walkDone({ page: 3, totalPages: 5, resultsLength: 50, pageSize: 50 })).toBe(false)
    expect(walkDone({ page: 5, totalPages: 5, resultsLength: 50, pageSize: 50 })).toBe(false)
    expect(walkDone({ page: 6, totalPages: 5, resultsLength: 12, pageSize: 50 })).toBe(true)
    expect(walkDone({ page: 5, totalPages: 5, resultsLength: 30, pageSize: 50 })).toBe(true)
    expect(walkDone({ page: 7, totalPages: 5, resultsLength: 0, pageSize: 50 })).toBe(true)
  })
  it.each(['scripts/collect-eldorado-values.mjs', 'scripts/collect-eldorado-sae.mjs'])('%s uses it', (f) => {
    expect(readFileSync(join(process.cwd(), f), 'utf8')).toContain('walkDone(')
  })
})
