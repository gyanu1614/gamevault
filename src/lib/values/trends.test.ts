import { describe, it, expect } from 'vitest'
import { changesBetween, trendWindowStart, visibleTrend } from './trends'

describe('7-day trends', () => {
  it('looks back seven days from the newest snapshot day', () => {
    expect(trendWindowStart('2026-10-23')).toBe('2026-10-16')
    expect(trendWindowStart('2026-03-03')).toBe('2026-02-24')
  })

  it('rounds to 0.1 and drops moves under the floor or without a base', () => {
    expect(visibleTrend(100, 104.54)).toBe(4.5)
    expect(visibleTrend(100, 93.3)).toBe(-6.7)
    expect(visibleTrend(100, 100.01)).toBeNull()
    expect(visibleTrend(0, 5)).toBeNull()
    expect(visibleTrend(null, 5)).toBeNull()
  })

  it('compares each key across exactly the two days, ignoring keys seen on one day', () => {
    const rows = [
      { k: 'owl', d: '2026-10-16', v: 10 },
      { k: 'owl', d: '2026-10-23', v: 11 },
      { k: 'frog', d: '2026-10-23', v: 3 },
      { k: 'bat', d: '2026-10-16', v: 50 },
      { k: 'bat', d: '2026-10-23', v: 40 },
    ]
    const m = changesBetween(rows, { fromDate: '2026-10-16', toDate: '2026-10-23', keyOf: (r) => r.k, dateOf: (r) => r.d, valueOf: (r) => r.v })
    expect([...m]).toEqual([
      ['owl', 10],
      ['bat', -20],
    ])
  })
})
