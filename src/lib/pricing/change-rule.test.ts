/**
 * T1 (2026-10-04) — one revalidation contract for every value game.
 *
 * A price only counts as CHANGED when it moves more than
 * max(minRelative × |previous|, minAbsoluteUsd) against the LAST PUBLISHED
 * value. Sub-threshold moves are stored but never rebuild a page; the diff is
 * against the published snapshot (not the previous run), so a slow drift still
 * publishes once it adds up.
 */
import { describe, it, expect } from 'vitest'

import {
  DEFAULT_PRICE_CHANGE_RULE,
  diffPublishedPrices,
  isPublishablePriceChange,
  type PublishedPrice,
} from './change-rule'

const rule = DEFAULT_PRICE_CHANGE_RULE

describe('isPublishablePriceChange — |Δ| > max(3%, $0.05)', () => {
  it('defaults to 3% / 5 cents', () => {
    expect(rule).toEqual({ minRelative: 0.03, minAbsoluteUsd: 0.05 })
  })

  it('ignores a cent wobble on a cheap item (the $0.05 floor wins)', () => {
    expect(isPublishablePriceChange(1.0, 1.04, rule)).toBe(false)
    expect(isPublishablePriceChange(1.0, 0.96, rule)).toBe(false)
    expect(isPublishablePriceChange(1.0, 1.06, rule)).toBe(true)
  })

  it('ignores a sub-3% move on an expensive item (the relative step wins)', () => {
    expect(isPublishablePriceChange(200, 205.9, rule)).toBe(false)
    expect(isPublishablePriceChange(200, 206.01, rule)).toBe(true)
    expect(isPublishablePriceChange(200, 193.9, rule)).toBe(true)
  })

  it('is strict: a move exactly on the threshold is not a change', () => {
    expect(isPublishablePriceChange(1.0, 1.05, rule)).toBe(false)
  })

  it('a price appearing or disappearing is always a change; nothing → nothing is not', () => {
    expect(isPublishablePriceChange(null, 3.2, rule)).toBe(true)
    expect(isPublishablePriceChange(3.2, null, rule)).toBe(true)
    expect(isPublishablePriceChange(null, null, rule)).toBe(false)
  })

  it('treats non-finite input as missing', () => {
    expect(isPublishablePriceChange(Number.NaN, null, rule)).toBe(false)
    expect(isPublishablePriceChange(Number.NaN, 2, rule)).toBe(true)
  })

  it('takes a per-game rule', () => {
    const loose = { minRelative: 0.1, minAbsoluteUsd: 0.5 }
    expect(isPublishablePriceChange(10, 10.9, loose)).toBe(false)
    expect(isPublishablePriceChange(10, 11.01, loose)).toBe(true)
  })
})

const row = (
  itemSlug: string,
  variant: string,
  prices: PublishedPrice['prices'],
): PublishedPrice => ({ itemSlug, variant, prices })

describe('diffPublishedPrices — changed item slugs vs the last published snapshot', () => {
  it('zero changes → zero slugs, zero writes', () => {
    const snap = [row('owl', 'FR', { average: 60, cheapest: 55 })]
    const now = [row('owl', 'FR', { average: 60.4, cheapest: 55.2 })]
    const diff = diffPublishedPrices(snap, now, rule)
    expect(diff.changedSlugs).toEqual([])
    expect(diff.upserts).toEqual([])
    expect(diff.deletes).toEqual([])
  })

  it('an item is changed when ANY of its variants or price fields moves past the rule', () => {
    const snap = [
      row('owl', 'FR', { average: 60, cheapest: 55 }),
      row('owl', 'NFR', { average: 200, cheapest: 190 }),
      row('dog', 'FR', { average: 1, cheapest: 0.9 }),
    ]
    const now = [
      row('owl', 'FR', { average: 60, cheapest: 55 }),
      row('owl', 'NFR', { average: 200, cheapest: 170 }), // cheapest −10.5%
      row('dog', 'FR', { average: 1.01, cheapest: 0.91 }),
    ]
    const diff = diffPublishedPrices(snap, now, rule)
    expect(diff.changedSlugs).toEqual(['owl'])
    // Only the moved row is re-published: the unchanged FR row keeps its
    // published baseline, so a later drift is measured from what pages show.
    expect(diff.upserts).toEqual([row('owl', 'NFR', { average: 200, cheapest: 170 })])
  })

  it('a new item or variant is a change (and is published)', () => {
    const diff = diffPublishedPrices([], [row('frog', 'default', { average: 2 })], rule, {
      seedWhenEmpty: false,
    })
    expect(diff.changedSlugs).toEqual(['frog'])
    expect(diff.upserts).toHaveLength(1)
  })

  it('a vanished row is a change and is deleted from the snapshot', () => {
    const diff = diffPublishedPrices(
      [row('frog', 'default', { average: 2 }), row('owl', 'FR', { average: 60 })],
      [row('owl', 'FR', { average: 60 })],
      rule,
    )
    expect(diff.changedSlugs).toEqual(['frog'])
    expect(diff.deletes).toEqual([{ itemSlug: 'frog', variant: 'default' }])
  })

  it('slow drift publishes once it adds up, because the baseline is the PUBLISHED value', () => {
    // Day 1 → 2 → 3: +2% each run. Run-over-run it never crosses 3%; against
    // the published 100 it does on the second step.
    let snapshot = [row('crate', 'default', { average: 100 })]
    const d2 = diffPublishedPrices(snapshot, [row('crate', 'default', { average: 102 })], rule)
    expect(d2.changedSlugs).toEqual([])
    snapshot = applyForTest(snapshot, d2)
    const d3 = diffPublishedPrices(snapshot, [row('crate', 'default', { average: 104.04 })], rule)
    expect(d3.changedSlugs).toEqual(['crate'])
  })

  it('an empty snapshot is SEEDED silently by default (first run after the migration)', () => {
    const now = [row('owl', 'FR', { average: 60 }), row('dog', 'FR', { average: 1 })]
    const diff = diffPublishedPrices([], now, rule)
    expect(diff.seeded).toBe(true)
    expect(diff.changedSlugs).toEqual([])
    expect(diff.upserts).toEqual(now)
  })

  it('returns each changed slug once, sorted', () => {
    const diff = diffPublishedPrices(
      [row('b', 'x', { average: 1 }), row('b', 'y', { average: 1 }), row('a', 'x', { average: 1 })],
      [row('b', 'x', { average: 2 }), row('b', 'y', { average: 2 }), row('a', 'x', { average: 2 })],
      rule,
    )
    expect(diff.changedSlugs).toEqual(['a', 'b'])
  })
})

function applyForTest(
  snapshot: PublishedPrice[],
  diff: ReturnType<typeof diffPublishedPrices>,
): PublishedPrice[] {
  const key = (r: { itemSlug: string; variant: string }) => `${r.itemSlug}\u0000${r.variant}`
  const map = new Map(snapshot.map((r) => [key(r), r]))
  for (const d of diff.deletes) map.delete(key(d))
  for (const u of diff.upserts) map.set(key(u), u)
  return [...map.values()]
}
