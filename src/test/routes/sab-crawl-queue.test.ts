import { describe, expect, it } from 'vitest'

import {
  NEVER_PRICED_STALENESS_HOURS,
  selectEligible,
  stalenessHours,
} from '../../../scripts/collect-eldorado-sab-api-v6.mjs'

/**
 * ROUTE-012. The crawl re-crawled the same alphabetical head every run and never
 * reached the tail of the catalogue: ~145 of 355 tradeable items had not been
 * looked at in a month, so their listings aged out of the estimate views and
 * their value pages lost every price.
 *
 * The cause was not the sort — it was the SIGNAL. `last_priced_at` came from a
 * batch timestamp that is identical for every row (and was in fact never
 * selected at all, so it was null everywhere). With a constant primary key the
 * comparator falls through to its `name.localeCompare` tiebreaker and the queue
 * becomes strictly alphabetical.
 *
 * These tests pin the property that actually matters: across repeated runs the
 * crawl must reach EVERY item, including the last one.
 */

const NOW = Date.parse('2026-09-12T00:00:00.000Z')
const HOUR = 60 * 60 * 1000
const MAX_BRAINROTS = 210
const CATALOGUE_SIZE = 355

const opts = (over: Record<string, unknown> = {}) => ({
  usePanelRefresh: true,
  refreshAfterMs: 6 * HOUR,
  progress: { attempts: {} },
  collectorVersion: 'v6',
  now: NOW,
  ...over,
})

/** A catalogue of `size` items, all the same rarity weight, named alphabetically. */
function catalogue(size: number, lastPricedAt: (i: number) => string | null) {
  return Array.from({ length: size }, (_, i) => ({
    id: `id-${i}`,
    // Zero-padded so localeCompare order is identical to index order — this is
    // what makes an alphabetical collapse observable.
    name: `Item ${String(i).padStart(4, '0')}`,
    rarity: 'Secret',
    rarity_weight: 4,
    last_priced_at: lastPricedAt(i),
  }))
}

describe('stalenessHours', () => {
  it('treats a never-crawled item as maximally stale, but finite', () => {
    const hours = stalenessHours({ last_priced_at: null }, NOW)
    expect(hours).toBe(NEVER_PRICED_STALENESS_HOURS)
    expect(Number.isFinite(hours)).toBe(true)
  })

  it('measures real elapsed hours', () => {
    const row = { last_priced_at: new Date(NOW - 30 * HOUR).toISOString() }
    expect(stalenessHours(row, NOW)).toBeCloseTo(30, 5)
  })
})

describe('ROUTE-012 regression — the alphabetical collapse', () => {
  it('reproduces the bug: a constant signal starves everything past the cutoff', () => {
    // Every item carries the SAME timestamp — a batch stamp, or null everywhere.
    const stamp = new Date(NOW - 48 * HOUR).toISOString()
    const rows = catalogue(CATALOGUE_SIZE, () => stamp)

    const ordered = selectEligible(rows, opts())

    // Order is alphabetical, so the first 210 are items 0..209 forever and the
    // tail is unreachable.
    expect(ordered.slice(0, MAX_BRAINROTS).map((r: any) => r.id)).toEqual(
      Array.from({ length: MAX_BRAINROTS }, (_, i) => `id-${i}`),
    )
    const reached = new Set(
      ordered.slice(0, MAX_BRAINROTS).map((r: any) => r.id),
    )
    expect(reached.has(`id-${CATALOGUE_SIZE - 1}`)).toBe(false)
  })

  it('a real per-item signal orders stalest-first instead', () => {
    // Item i last seen i hours ago → item 354 is the stalest.
    const rows = catalogue(CATALOGUE_SIZE, (i) =>
      new Date(NOW - (i + 7) * HOUR).toISOString(),
    )

    const ordered = selectEligible(rows, opts())

    expect(ordered[0].id).toBe(`id-${CATALOGUE_SIZE - 1}`)
    // The last item in the catalogue is now at the FRONT, not beyond the cutoff.
    expect(
      ordered.slice(0, MAX_BRAINROTS).map((r: any) => r.id),
    ).toContain(`id-${CATALOGUE_SIZE - 1}`)
  })
})

describe('ROUTE-012 — the queue reaches position 355 across runs', () => {
  it('covers every item in the catalogue, including the last', () => {
    // Start from the real-world state: nothing has been crawled recently.
    const rows = catalogue(CATALOGUE_SIZE, () => null)
    const lastSeen = new Map<string, string | null>(
      rows.map((r) => [r.id, r.last_priced_at]),
    )

    const crawled = new Set<string>()
    let now = NOW

    // Runs are 3h apart, matching the workflow's cron.
    for (let run = 0; run < 2; run += 1) {
      const queue = rows.map((r) => ({
        ...r,
        last_priced_at: lastSeen.get(r.id) ?? null,
      }))
      const targets = selectEligible(queue, opts({ now })).slice(
        0,
        MAX_BRAINROTS,
      )

      for (const target of targets) {
        crawled.add(target.id)
        lastSeen.set(target.id, new Date(now).toISOString())
      }
      now += 3 * HOUR
    }

    // Position 355 — the item that was permanently starved before the fix.
    expect(crawled.has(`id-${CATALOGUE_SIZE - 1}`)).toBe(true)
    expect(crawled.size).toBe(CATALOGUE_SIZE)
  })

  it('does not re-crawl an item it just visited while staler ones wait', () => {
    const rows = catalogue(CATALOGUE_SIZE, () => null)
    const lastSeen = new Map<string, string | null>(
      rows.map((r) => [r.id, null]),
    )

    const firstQueue = rows.map((r) => ({ ...r }))
    const firstTargets = selectEligible(firstQueue, opts()).slice(
      0,
      MAX_BRAINROTS,
    )
    for (const t of firstTargets) lastSeen.set(t.id, new Date(NOW).toISOString())

    const secondQueue = rows.map((r) => ({
      ...r,
      last_priced_at: lastSeen.get(r.id) ?? null,
    }))
    const secondTargets = selectEligible(
      secondQueue,
      opts({ now: NOW + 3 * HOUR }),
    ).slice(0, MAX_BRAINROTS)

    // Everything just crawled is 3h old, inside the 6h refresh window, so it is
    // not even eligible — the second run must go to the untouched remainder.
    const firstIds = new Set(firstTargets.map((t: any) => t.id))
    const overlap = secondTargets.filter((t: any) => firstIds.has(t.id))
    expect(overlap).toHaveLength(0)
  })

  it('rarity still breaks ties, so Secrets outrank commons at equal staleness', () => {
    const stamp = new Date(NOW - 100 * HOUR).toISOString()
    const rows = [
      { id: 'common', name: 'AAA Common', rarity: 'Common', rarity_weight: 1, last_priced_at: stamp },
      { id: 'secret', name: 'ZZZ Secret', rarity: 'Secret', rarity_weight: 4, last_priced_at: stamp },
    ]

    const ordered = selectEligible(rows, opts())

    // Alphabetically 'AAA Common' wins; weighted staleness must put the Secret first.
    expect(ordered[0].id).toBe('secret')
  })
})
