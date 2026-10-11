import { describe, it, expect } from 'vitest'
import { nextEvidence, walkAnchor, historyDayCount, type StoredEvidence } from './evidence'

const NOW = '2026-10-09T12:00:00.000Z'

describe('walkAnchor', () => {
  it('moves the anchor only on a material change (5% and $0.25)', () => {
    const r = walkAnchor([
      { day: '2026-10-01', value: 40 },
      { day: '2026-10-02', value: 41 }, // +2.5%: not material
      { day: '2026-10-03', value: 41.9 }, // +4.75% vs anchor 40: not material
      { day: '2026-10-04', value: 42.1 }, // +5.25% vs 40: material
      { day: '2026-10-05', value: 42.3 },
    ])
    expect(r).toEqual({ anchor: 42.1, movedOn: '2026-10-04' })
  })

  it('catches a slow drift against the anchor, not just day over day', () => {
    const days = [10, 10.2, 10.4, 10.6].map((value, i) => ({ day: `2026-10-0${i + 1}`, value }))
    expect(walkAnchor(days)).toEqual({ anchor: 10.6, movedOn: '2026-10-04' })
  })

  it('counts a price appearing or disappearing as a move', () => {
    expect(walkAnchor([{ day: '2026-10-01', value: null }, { day: '2026-10-02', value: 5 }])).toEqual({ anchor: 5, movedOn: '2026-10-02' })
    expect(walkAnchor([{ day: '2026-10-01', value: 5 }, { day: '2026-10-02', value: null }])).toEqual({ anchor: null, movedOn: '2026-10-02' })
  })

  it('returns nothing for an empty or all-null history', () => {
    expect(walkAnchor([])).toEqual({ anchor: null, movedOn: null })
    expect(walkAnchor([{ day: '2026-10-01', value: null }])).toEqual({ anchor: null, movedOn: null })
  })
})

describe('historyDayCount', () => {
  it('counts distinct priced days across every series', () => {
    expect(
      historyDayCount({
        FR: [{ day: '2026-10-01', value: 1 }, { day: '2026-10-02', value: 1 }],
        NFR: [{ day: '2026-10-02', value: 3 }, { day: '2026-10-03', value: null }],
      }),
    ).toBe(2)
  })
})

describe('nextEvidence', () => {
  const series = {
    '': Array.from({ length: 10 }, (_, i) => ({ day: `2026-09-${String(20 + i).padStart(2, '0')}`, value: i < 5 ? 40 : 44 })),
  }
  const current = { observations: 18, valueUsd: 44, values: { '': 44 }, sourceChangedAt: '2026-10-08T09:00:00.000Z' }

  it('backfills the last material move from history on the first run', () => {
    const r = nextEvidence({ current, series, stored: null, now: NOW, isProtected: false })
    expect(r.row.priceMovedAt).toBe('2026-09-25T00:00:00.000Z')
    expect(r.row.anchors).toEqual({ '': 44 })
    expect(r.row.historyDays).toBe(10)
    expect(r.row.passesGate).toBe(true)
    expect(r.priceMoved).toBe(false)
    expect(r.gateFlipped).toBe(false)
  })

  it('backfills an item with no history from its own source date, never "now"', () => {
    const r = nextEvidence({ current, series: {}, stored: null, now: NOW, isProtected: false })
    expect(r.row.priceMovedAt).toBe('2026-10-08T09:00:00.000Z')
    // No history yet, but a brand-new page with 18 offers passes on offers alone.
    expect(r.row.passesGate).toBe(true)
    expect(r.row.firstSeenAt).toBe(NOW)
  })

  const stored: StoredEvidence = {
    anchors: { '': 44 },
    priceMovedAt: '2026-09-25T00:00:00.000Z',
    passesGate: true,
    passesChangedAt: '2026-10-01T00:00:00.000Z',
  }

  it('keeps the date when a re-crawl finds the same (or barely different) price', () => {
    const r = nextEvidence({ current: { ...current, valueUsd: 44.5, values: { '': 44.5 } }, series, stored, now: NOW, isProtected: false })
    expect(r.row.priceMovedAt).toBe(stored.priceMovedAt)
    expect(r.row.anchors).toEqual({ '': 44 })
    expect(r.priceMoved).toBe(false)
  })

  it('stamps now and moves the anchor on a material move', () => {
    const r = nextEvidence({ current: { ...current, valueUsd: 50, values: { '': 50 } }, series, stored, now: NOW, isProtected: false })
    expect(r.row.priceMovedAt).toBe(NOW)
    expect(r.row.anchors).toEqual({ '': 50 })
    expect(r.priceMoved).toBe(true)
  })

  it('moves when ANY variant moves (Adopt Me)', () => {
    const s: StoredEvidence = { ...stored, anchors: { FR: 290, NFR: 600 } }
    const r = nextEvidence({ current: { observations: 15, valueUsd: 290, values: { FR: 290, NFR: 700 } }, series: {}, stored: s, now: NOW, isProtected: false })
    expect(r.priceMoved).toBe(true)
    expect(r.row.anchors).toEqual({ FR: 290, NFR: 700 })
  })

  it('records a gate flip and when it happened', () => {
    const r = nextEvidence({ current: { ...current, observations: 3 }, series, stored, now: NOW, isProtected: true })
    expect(r.gateFlipped).toBe(true)
    expect(r.row.passesGate).toBe(false)
    expect(r.row.passesChangedAt).toBe(NOW)
    expect(r.row.isProtected).toBe(true)
    const same = nextEvidence({ current, series, stored, now: NOW, isProtected: false })
    expect(same.row.passesChangedAt).toBe(stored.passesChangedAt)
  })
})

describe('first seen + new pages (owner 2026-10-10)', () => {
  const now = '2026-10-10T12:00:00.000Z'
  const cur = { observations: 9, valueUsd: 12, values: { '': 12 } }

  it('takes first seen from the earliest priced history day, and lets a young page pass on offers', () => {
    const series = { '': [{ day: '2026-10-08', value: 12 }, { day: '2026-10-09', value: 12 }] }
    const r = nextEvidence({ current: cur, series, stored: null, now, isProtected: false })
    expect(r.row.firstSeenAt).toBe('2026-10-08T00:00:00.000Z')
    expect(r.row.historyDays).toBe(2)
    expect(r.row.passesGate).toBe(true)
    expect(r.isNewPage).toBe(true)
  })

  it('uses now for a priced page with no history yet, and never calls an unpriced page new', () => {
    expect(nextEvidence({ current: cur, series: {}, stored: null, now, isProtected: false }).row.firstSeenAt).toBe(now)
    const unpriced = nextEvidence({ current: { observations: 0, valueUsd: null, values: { '': null } }, series: {}, stored: null, now, isProtected: false })
    expect(unpriced.row.firstSeenAt).toBeNull()
    expect(unpriced.isNewPage).toBe(false)
  })

  it('keeps a stored first-seen date, backfills a missing one, and a stored page is not new', () => {
    const stored: StoredEvidence = { anchors: { '': 12 }, priceMovedAt: null, passesGate: true, passesChangedAt: null, firstSeenAt: '2026-09-01T00:00:00.000Z' }
    const r = nextEvidence({ current: cur, series: {}, stored, now, isProtected: false })
    expect(r.row.firstSeenAt).toBe('2026-09-01T00:00:00.000Z')
    expect(r.isNewPage).toBe(false)
    const old = nextEvidence({ current: cur, series: { '': [{ day: '2026-09-05', value: 12 }] }, stored: { ...stored, firstSeenAt: null }, now, isProtected: false })
    expect(old.row.firstSeenAt).toBe('2026-09-05T00:00:00.000Z')
  })

  it('a page that was priced but is no longer new needs 7 days of history again', () => {
    const stored: StoredEvidence = { anchors: { '': 12 }, priceMovedAt: null, passesGate: true, passesChangedAt: null, firstSeenAt: '2026-09-20T00:00:00.000Z' }
    const r = nextEvidence({ current: cur, series: { '': [{ day: '2026-10-09', value: 12 }] }, stored, now, isProtected: false })
    expect(r.row.passesGate).toBe(false)
    expect(r.gateFlipped).toBe(true)
  })
})
