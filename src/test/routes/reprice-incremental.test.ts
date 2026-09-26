/**
 * Incremental repricing — narrow the WRITES, never the READS.
 *
 * The cohort-anchoring constraint is the whole reason this is a separate,
 * heavily-tested unit: thin-sample items take their price from a cohort of
 * well-sampled peers, so every item must still be READ and priced in memory.
 * Only the upsert is narrowed. These tests pin that distinction.
 */
import { describe, it, expect } from 'vitest'

import {
  keysNeedingRecompute,
  newestObservedByKey,
} from '@/lib/pricing/incremental'

describe('newestObservedByKey', () => {
  it('keeps the newest observation per brainrot+mutation', () => {
    const newest = newestObservedByKey([
      { brainrot_id: 'a', mutation_id: 'm1', observed_at: '2026-09-18T00:00:00Z' },
      { brainrot_id: 'a', mutation_id: 'm1', observed_at: '2026-09-19T00:00:00Z' },
      { brainrot_id: 'a', mutation_id: 'm2', observed_at: '2026-09-17T00:00:00Z' },
    ])
    expect(newest.get('a:m1')).toBe('2026-09-19T00:00:00Z')
    expect(newest.get('a:m2')).toBe('2026-09-17T00:00:00Z')
  })

  it('ignores rows with no timestamp', () => {
    const newest = newestObservedByKey([
      { brainrot_id: 'a', mutation_id: 'm1', observed_at: null },
    ])
    expect(newest.size).toBe(0)
  })
})

describe('keysNeedingRecompute', () => {
  it('selects an item whose listings moved since it was priced', () => {
    const stale = keysNeedingRecompute(
      new Map([['a:m1', '2026-09-19T02:00:00Z']]),
      new Map([['a:m1', '2026-09-14T10:13:48Z']]),
    )
    expect([...stale]).toEqual(['a:m1'])
  })

  it('skips an item whose evidence has not moved', () => {
    // Nothing new was seen, so the stored value still stands — recomputing it
    // would produce the identical number.
    const stale = keysNeedingRecompute(
      new Map([['a:m1', '2026-09-14T10:00:00Z']]),
      new Map([['a:m1', '2026-09-14T10:13:48Z']]),
    )
    expect(stale.size).toBe(0)
  })

  it('always includes a never-priced item', () => {
    const stale = keysNeedingRecompute(
      new Map([['new:m1', '2026-09-19T02:00:00Z']]),
      new Map(),
    )
    expect([...stale]).toEqual(['new:m1'])
  })

  it('reproduces the real outage: 214 frozen, 173 fresh', () => {
    const observed = new Map<string, string>()
    const computed = new Map<string, string>()
    // Everything was last computed in the failed Sep 14 run.
    for (let i = 0; i < 387; i += 1) computed.set(`b${i}:m`, '2026-09-14T10:13:48Z')
    // The crawl has since seen new listings for 173 of them.
    for (let i = 0; i < 173; i += 1) observed.set(`b${i}:m`, '2026-09-19T02:00:00Z')
    // The remaining 214 were crawled too, but nothing newer than Sep 14.
    for (let i = 173; i < 387; i += 1) observed.set(`b${i}:m`, '2026-09-13T00:00:00Z')

    const stale = keysNeedingRecompute(observed, computed)
    expect(stale.size).toBe(173)
  })

  it('an empty observation set writes nothing', () => {
    // A crawl that landed no listings must not blank the catalogue.
    expect(keysNeedingRecompute(new Map(), new Map([['a:m', '2026-09-14T00:00:00Z']])).size).toBe(0)
  })
})
