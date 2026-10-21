import { describe, expect, it } from 'vitest'
import { bingWeek, delta, pct, weeklyMessage, type WeeklyCheck } from './weekly'

const days = (start: string, n: number, f: (i: number) => { clicks: number; impressions: number; in_index: number | null }) =>
  Array.from({ length: n }, (_, i) => ({ day: new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), ...f(i) }))

describe('bingWeek', () => {
  it('last 7 days vs the 7 before, pages in index now vs a week earlier', () => {
    const w = bingWeek(days('2026-10-06', 14, (i) => ({ clicks: i < 7 ? 10 : 12, impressions: 100, in_index: 1000 + i * 5 })))
    expect(w).toEqual({ clicks7d: 84, clicksPrev7d: 70, impressions7d: 700, impressionsPrev7d: 700, inIndex: 1065, inIndexWeekAgo: 1030 })
  })
  it('no days, no Bing block', () => {
    expect(bingWeek([])).toBeNull()
  })
})

describe('delta / pct', () => {
  it('signs and rounding', () => {
    expect([delta(101, 98), delta(1180, 1192), delta(5, 5), delta(5, null)]).toEqual(['+3', '−12', '±0', null])
    expect([pct(84, 70), pct(60, 70), pct(1, 0), pct(70, 70)]).toEqual(['+20%', '−14%', null, '±0%'])
  })
})

describe('weeklyMessage', () => {
  const w: WeeklyCheck = {
    google: {
      now: { indexed: 101, crawled: 14, discovered: 840, unknown: 1180, clicks28d: 24, impressions28d: 450 },
      weekAgo: { indexed: 98, crawled: 14, discovered: 829, unknown: 1192, clicks28d: 23, impressions28d: 433 },
    },
    bing: { clicks7d: 84, clicksPrev7d: 70, impressions7d: 7000, impressionsPrev7d: 6500, inIndex: 1065, inIndexWeekAgo: 1030 },
    topBingPages: [{ url: 'https://dropmarket.gg/adopt-me/values', clicks: 31, impressions: 900, clicksPrevWeek: 25 }],
  }
  it('three lines, numbers first, with changes', () => {
    const m = weeklyMessage(w, '23 Oct')
    expect(m).toContain('week to 23 Oct')
    expect(m).toContain('101 (+3) indexed')
    expect(m).toContain('1,180 (−12) unknown')
    expect(m).toContain('84 (+20%) clicks')
    expect(m).toContain('1,065 (+35) pages in index')
    expect(m).toContain('/adopt-me/values (31)')
  })
  it('says how to switch Bing on when there is no Bing data', () => {
    expect(weeklyMessage({ ...w, bing: null, topBingPages: [] }, '23 Oct')).toContain('add BING_WEBMASTER_API_KEY')
  })
})
