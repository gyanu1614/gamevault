import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  NEVER_CRAWLED_STALENESS_HOURS,
  buildQueue,
  selectEligible,
} from '../../../scripts/collect-g2g-sab.mjs'

/**
 * ROUTE-016. The G2G queue froze the way Eldorado's did (ROUTE-012), but by a
 * different and strictly worse mechanism.
 *
 * Eldorado at least HAD a staleness comparator; its signal was null everywhere,
 * so the sort degenerated to its alphabetical tiebreaker. G2G never had
 * staleness in the comparator at all: buildQueue() sorted once by
 * (rarity_weight, name) — both constant across runs — and selectTargets() only
 * filtered. So the order was a fixed permutation and `--max-brainrots 120`
 * against a 385-Brainrot taxonomy took the SAME 120 every single run.
 *
 * Eligibility compounded it: it read `attempted_at` from the COMMITTED progress
 * file, which the workflow never commits back, so every scheduled run saw the
 * same frozen snapshot (one entry, from a 2026-07-31 test run).
 *
 * These tests pin the property that actually matters: across repeated runs the
 * crawl must reach EVERY Brainrot, including the ones past the old cutoff.
 */

const NOW = Date.parse('2026-09-13T05:20:00.000Z')
const HOUR = 60 * 60 * 1000
const MAX_BRAINROTS = 120
const CATALOGUE_SIZE = 385

const opts = (over: Record<string, unknown> = {}) => ({
  usePanelRefresh: true,
  refreshAfterMs: 20 * HOUR,
  progress: { attempts: {} },
  now: NOW,
  ...over,
})

/** A catalogue of `size` items, same rarity weight, alphabetically named. */
function catalogue(size: number, lastCrawledAt: (i: number) => string | null) {
  return Array.from({ length: size }, (_, i) => ({
    id: `fa-${i}`,
    // Zero-padded so localeCompare order equals index order — that is what
    // makes a collapse to the name tiebreaker observable.
    name: `Item ${String(i).padStart(4, '0')}`,
    rarity: 'Secret',
    rarity_weight: 4,
    last_crawled_at: lastCrawledAt(i),
  }))
}

describe('stalenessHours (G2G)', () => {
  it('treats a never-crawled Brainrot as maximally stale, but FINITE', () => {
    const rows = catalogue(2, () => null)
    // Infinity here would multiply to Infinity for every rarity and collapse the
    // weighting, sorting the never-crawled block alphabetically instead.
    expect(Number.isFinite(NEVER_CRAWLED_STALENESS_HOURS)).toBe(true)

    const ordered = selectEligible(rows, opts())
    expect(ordered).toHaveLength(2)
  })

  it('keeps rarity weighting meaningful among never-crawled items', () => {
    const rows = [
      { id: 'a', name: 'Zeta', rarity: 'Epic', rarity_weight: 1, last_crawled_at: null },
      { id: 'b', name: 'Alpha', rarity: 'Secret', rarity_weight: 4, last_crawled_at: null },
    ]
    // Alphabetically 'Alpha' wins anyway, so use the reverse to prove weighting:
    const reversed = [
      { id: 'a', name: 'Alpha', rarity: 'Epic', rarity_weight: 1, last_crawled_at: null },
      { id: 'b', name: 'Zeta', rarity: 'Secret', rarity_weight: 4, last_crawled_at: null },
    ]
    expect(selectEligible(rows, opts())[0].id).toBe('b')
    // The Secret sorts first despite losing the alphabetical tiebreaker.
    expect(selectEligible(reversed, opts())[0].id).toBe('b')
  })
})

describe('ROUTE-016 regression — the fixed-permutation starve', () => {
  it('reproduces the bug: a constant signal starves everything past the cutoff', () => {
    // Pre-fix reality: no per-item signal at all. Emulate it with one constant
    // value for every row, which is what the old ordering effectively had.
    const stamp = new Date(NOW - 48 * HOUR).toISOString()
    const rows = catalogue(CATALOGUE_SIZE, () => stamp)

    const ordered = selectEligible(rows, opts())

    // With a constant primary key the comparator falls through to the name
    // tiebreaker: the first 120 are items 0..119 forever.
    expect(ordered.slice(0, MAX_BRAINROTS).map((r: any) => r.id)).toEqual(
      Array.from({ length: MAX_BRAINROTS }, (_, i) => `fa-${i}`),
    )
    const reached = new Set(ordered.slice(0, MAX_BRAINROTS).map((r: any) => r.id))
    // Position ~210 and the tail are unreachable — the ROUTE-016 symptom.
    expect(reached.has('fa-210')).toBe(false)
    expect(reached.has(`fa-${CATALOGUE_SIZE - 1}`)).toBe(false)
  })

  it('a real per-item signal orders stalest-first instead', () => {
    // Item i last seen (i+21)h ago → the LAST item is the stalest.
    const rows = catalogue(CATALOGUE_SIZE, (i) =>
      new Date(NOW - (i + 21) * HOUR).toISOString(),
    )

    const ordered = selectEligible(rows, opts())

    expect(ordered[0].id).toBe(`fa-${CATALOGUE_SIZE - 1}`)

    // The stalest 120 are the TAIL of the catalogue (items 384..265) — exactly
    // the block the old fixed permutation could never reach. fa-210 is
    // deliberately NOT here: it is stale, but 55 items are staler, so it waits
    // its turn rather than being starved forever. The across-runs coverage test
    // below is what proves it is reached.
    const reached = new Set(ordered.slice(0, MAX_BRAINROTS).map((r: any) => r.id))
    expect(reached.has(`fa-${CATALOGUE_SIZE - 1}`)).toBe(true)
    expect(reached.has('fa-265')).toBe(true)
    expect(reached.has('fa-264')).toBe(false)
  })
})

describe('ROUTE-016 — eligibility is DB-driven, not progress-file driven', () => {
  it('ignores the committed progress file in panel-refresh mode', () => {
    // The real committed file: one stale entry that CI replays every run.
    const progress = {
      attempts: {
        'fa-0': {
          brainrot_name: 'Item 0000',
          status: 'collected',
          attempted_at: '2026-07-31T05:23:07.105Z',
          listing_count: 144,
          collector_version: 1,
        },
      },
    }
    // Freshly crawled per the DB, even though the progress file is ancient.
    const rows = catalogue(3, (i) =>
      i === 0 ? new Date(NOW - 1 * HOUR).toISOString() : null,
    )

    const eligible = selectEligible(rows, opts({ progress }))

    // fa-0 is excluded because the DATABASE says it was crawled an hour ago —
    // the progress file's month-old `attempted_at` is not consulted.
    expect(eligible.map((r: any) => r.id)).not.toContain('fa-0')
    expect(eligible.map((r: any) => r.id)).toEqual(['fa-1', 'fa-2'])
  })

  it('re-crawls an item the progress file claims was collected, once it goes stale', () => {
    const progress = {
      attempts: { 'fa-0': { status: 'collected', attempted_at: new Date(NOW).toISOString() } },
    }
    // The DB says we last saw it 30h ago, past the 20h refresh window.
    const rows = catalogue(1, () => new Date(NOW - 30 * HOUR).toISOString())

    const eligible = selectEligible(rows, opts({ progress }))

    // Pre-fix this returned nothing: a "collected" progress entry with a recent
    // attempted_at suppressed the item regardless of real crawl freshness.
    expect(eligible.map((r: any) => r.id)).toEqual(['fa-0'])
  })

  it('backfill mode (refresh-after-hours 0) still honours the progress file', () => {
    const progress = { attempts: { 'fa-0': { status: 'collected' } } }
    const rows = catalogue(2, () => null)

    const eligible = selectEligible(
      rows,
      opts({ usePanelRefresh: false, progress }),
    )

    expect(eligible.map((r: any) => r.id)).toEqual(['fa-1'])
  })
})

describe('ROUTE-016 — the queue reaches the whole catalogue across runs', () => {
  it('covers every item, including the ones past position 210', () => {
    const rows = catalogue(CATALOGUE_SIZE, () => null)
    const lastSeen = new Map<string, string | null>(
      rows.map((r) => [r.id, null]),
    )

    const crawled = new Set<string>()
    let now = NOW

    // Daily runs, matching the `20 5 * * *` cron.
    for (let run = 0; run < 4; run += 1) {
      const queue = rows.map((r) => ({
        ...r,
        last_crawled_at: lastSeen.get(r.id) ?? null,
      }))
      const targets = selectEligible(queue, opts({ now })).slice(0, MAX_BRAINROTS)

      for (const target of targets) {
        crawled.add(target.id)
        lastSeen.set(target.id, new Date(now).toISOString())
      }
      now += 24 * HOUR
    }

    // The items the old fixed permutation could never reach.
    expect(crawled.has('fa-210')).toBe(true)
    expect(crawled.has(`fa-${CATALOGUE_SIZE - 1}`)).toBe(true)
    expect(crawled.size).toBe(CATALOGUE_SIZE)
  })

  it('does not re-crawl an item it just visited while staler ones wait', () => {
    const rows = catalogue(CATALOGUE_SIZE, () => null)
    const firstTargets = selectEligible(rows, opts()).slice(0, MAX_BRAINROTS)
    const justCrawled = new Set(firstTargets.map((r: any) => r.id))

    const secondQueue = rows.map((r) => ({
      ...r,
      last_crawled_at: justCrawled.has(r.id) ? new Date(NOW).toISOString() : null,
    }))
    const secondTargets = selectEligible(
      secondQueue,
      opts({ now: NOW + 24 * HOUR }),
    ).slice(0, MAX_BRAINROTS)

    // Nothing from run 1 reappears in run 2 while 265 never-crawled items wait.
    expect(
      secondTargets.filter((r: any) => justCrawled.has(r.id)),
    ).toHaveLength(0)
  })
})

describe('ROUTE-016 — against the real committed G2G taxonomy', () => {
  const taxonomy = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'data/sab-market-feeds/g2g-taxonomy.json'),
      'utf8',
    ),
  )

  it('buildQueue no longer imposes the order (that is selectEligible s job)', () => {
    const queue = buildQueue(taxonomy, undefined, new Map())
    expect(queue.length).toBe(CATALOGUE_SIZE)

    // Pre-fix, buildQueue returned rarity-then-name order. It must not now, or
    // the fixed permutation would survive underneath the new sort.
    const rarityOrdered = [...queue].sort(
      (l: any, r: any) =>
        r.rarity_weight - l.rarity_weight ||
        l.name.localeCompare(r.name, 'en', { sensitivity: 'base' }),
    )
    expect(queue.map((r: any) => r.id)).not.toEqual(
      rarityOrdered.map((r: any) => r.id),
    )
  })

  it('attaches the per-item freshness signal by normalised name', () => {
    const first = buildQueue(taxonomy, undefined, new Map())[0]
    const stamp = '2026-09-12T00:00:00.000Z'
    const withSignal = buildQueue(
      taxonomy,
      undefined,
      new Map([[first.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), stamp]]),
    )
    const matched = withSignal.filter((r: any) => r.last_crawled_at === stamp)

    // At least the intended Brainrot picked up the signal. (Four taxonomy names
    // appear twice under different rarities, so a name can match 2 entries —
    // both are the same Brainrot, so marking both fresh is correct.)
    expect(matched.length).toBeGreaterThanOrEqual(1)
    expect(matched.map((r: any) => r.name)).toContain(first.name)
  })

  it('reaches every distinct Brainrot in the real 385-entry taxonomy', () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const lastSeen = new Map<string, string>()
    const seenNames = new Set<string>()
    let now = NOW

    for (let run = 0; run < 4; run += 1) {
      const queue = buildQueue(taxonomy, undefined, lastSeen)
      const targets = selectEligible(queue, opts({ now })).slice(0, MAX_BRAINROTS)
      for (const target of targets) {
        seenNames.add(norm(target.name))
        lastSeen.set(norm(target.name), new Date(now).toISOString())
      }
      now += 24 * HOUR
    }

    const allNames = new Set(
      buildQueue(taxonomy, undefined, new Map()).map((r: any) => norm(r.name)),
    )
    // 385 taxonomy entries, 381 distinct names (4 are listed under 2 rarities).
    expect(allNames.size).toBe(381)
    expect(seenNames.size).toBe(allNames.size)
  })
})
