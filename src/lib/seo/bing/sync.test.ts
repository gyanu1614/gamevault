import { describe, expect, it } from 'vitest'
import { parseBingDate, bingApiFromEnv } from './api'
import { runBingSync, sectionOfUrl, toDailyRows, toWeeklyRows, type BingStore } from './sync'

const now = new Date('2026-10-20T12:00:00Z')
// Bing stamps rows at local midnight Pacific: 2026-10-19 00:00 -0700 = 07:00 UTC.
const pst = (day: string) => `/Date(${Date.parse(`${day}T07:00:00Z`)}-0700)/`

describe('Bing dates', () => {
  it('reads /Date(ms±hhmm)/ as the local day', () => {
    expect(parseBingDate(pst('2026-10-19'))).toBe('2026-10-19')
    expect(parseBingDate('/Date(1760918400000)/')).toBe('2025-10-20')
    expect(parseBingDate('nope')).toBeNull()
    expect(parseBingDate(null)).toBeNull()
  })
})

describe('toDailyRows', () => {
  it('merges traffic and crawl per day, last 35 days only, nulls where Bing gave nothing', () => {
    const rows = toDailyRows(
      [{ Date: pst('2026-10-19'), Clicks: 41, Impressions: 1200 }, { Date: pst('2026-08-01'), Clicks: 1, Impressions: 2 }],
      [{ Date: pst('2026-10-19'), CrawledPages: 300, CrawlErrors: 2, InIndex: 1240, InLinks: 18 }, { Date: pst('2026-10-18'), InIndex: 1230 }],
      now,
    )
    expect(rows).toEqual([
      { day: '2026-10-18', clicks: null, impressions: null, crawled_pages: null, crawl_errors: null, in_index: 1230, in_links: null },
      { day: '2026-10-19', clicks: 41, impressions: 1200, crawled_pages: 300, crawl_errors: 2, in_index: 1240, in_links: 18 },
    ])
  })
})

describe('toWeeklyRows', () => {
  it('groups by week, sums duplicates, keeps the last 8 weeks, sorted by impressions', () => {
    const rows = toWeeklyRows(
      [
        { Date: pst('2026-10-13'), Query: 'adopt me values', Clicks: 10, Impressions: 500, AvgImpressionPosition: 6.4 },
        { Date: pst('2026-10-13'), Query: 'mm2 values', Clicks: 1, Impressions: 900, AvgImpressionPosition: 7.1 },
        { Date: pst('2026-10-13'), Query: 'adopt me values', Clicks: 2, Impressions: 100 },
        { Date: pst('2026-06-01'), Query: 'old', Clicks: 9, Impressions: 9 },
      ],
      now,
    )
    expect(rows.map((r) => [r.week, r.key, r.clicks, r.impressions])).toEqual([
      ['2026-10-13', 'mm2 values', 1, 900],
      ['2026-10-13', 'adopt me values', 12, 600],
    ])
    expect(rows[1].avg_position).toBe(6.4)
  })
  it('a page URL gets the same section as the Google check', () => {
    expect(sectionOfUrl('https://dropmarket.gg/adopt-me/values/frost-dragon')).toBe('values-adopt-me')
    expect(sectionOfUrl('https://dropmarket.gg/adopt-me/sell')).toBe('sell')
    expect(sectionOfUrl('not a url')).toBe('static')
  })
})

describe('runBingSync', () => {
  it('calls the four methods once and stores the rows', async () => {
    const calls: string[] = []
    const api = {
      async get(method: string) {
        calls.push(method)
        if (method === 'GetRankAndTrafficStats') return [{ Date: pst('2026-10-19'), Clicks: 5, Impressions: 50 }]
        if (method === 'GetPageStats') return [{ Date: pst('2026-10-13'), Query: 'https://dropmarket.gg/blog', Clicks: 3, Impressions: 30 }]
        return []
      },
    } as any
    const saved: Record<string, unknown[]> = {}
    const store: BingStore = {
      upsertDaily: async (r) => void (saved.daily = r),
      upsertPages: async (r) => void (saved.pages = r),
      upsertQueries: async (r) => void (saved.queries = r),
    }
    expect(await runBingSync(api, store, now)).toEqual({ days: 1, pages: 1, queries: 0 })
    expect(calls).toEqual(['GetRankAndTrafficStats', 'GetCrawlStats', 'GetPageStats', 'GetQueryStats'])
    expect(saved.pages).toEqual([{ week: '2026-10-13', key: 'https://dropmarket.gg/blog', clicks: 3, impressions: 30, avg_position: null, section: 'blog' }])
  })
  it('no key, no client', () => {
    expect(bingApiFromEnv({})).toBeNull()
  })
})
