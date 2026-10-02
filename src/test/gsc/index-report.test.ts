import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { INDEX_COLUMNS, parseCsvObjects, toCsvRow, type IndexRow } from '../../../scripts/lib/gsc/csv'
import {
  buildIndexSummary,
  indexCsvPath,
  indexSummaryPath,
  readDoneUrls,
  runIndexReport,
} from '../../../scripts/lib/gsc/index-report'
import { GscHttpError, QuotaExhaustedError } from '../../../scripts/lib/gsc/throttle'
import { blockNetwork } from './no-network'

blockNetwork()

const DATE = '2026-10-01'
const U = (p: string) => `https://dropmarket.gg${p}`

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gsc-index-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function inspection(over: Record<string, unknown> = {}) {
  return {
    inspectionResult: {
      indexStatusResult: {
        verdict: 'PASS',
        coverageState: 'Submitted and indexed',
        indexingState: 'INDEXING_ALLOWED',
        robotsTxtState: 'ALLOWED',
        pageFetchState: 'SUCCESSFUL',
        lastCrawlTime: '2026-09-30T10:00:00Z',
        crawledAs: 'MOBILE',
        ...over,
      },
    },
  }
}

const quiet = { log: () => {} }

describe('runIndexReport', () => {
  it('writes a header and one row per URL, with page_type derived from the route', async () => {
    const inspectUrl = vi.fn(async () => inspection())
    const urls = [U('/'), U('/adopt-me'), U('/adopt-me/values')]
    const result = await runIndexReport({ urls, outDir: dir, date: DATE }, { client: { inspectUrl }, ...quiet })

    const rows = parseCsvObjects(readFileSync(indexCsvPath(dir, DATE), 'utf8'))
    expect(Object.keys(rows[0])).toEqual([...INDEX_COLUMNS])
    expect(rows.map((r) => [r.url, r.page_type]).sort()).toEqual([
      [U('/'), 'home'],
      [U('/adopt-me'), 'game_hub'],
      [U('/adopt-me/values'), 'values_hub'],
    ])
    expect(result).toMatchObject({ inspected: 3, skipped: 0, failed: [], stoppedOnQuota: false, remaining: 0 })
    expect(existsSync(indexSummaryPath(dir, DATE))).toBe(true)
  })

  it('resumes: skips URLs already saved for the day and does not repeat the header', async () => {
    const urls = [U('/a'), U('/b'), U('/c')]
    const first = vi.fn(async () => inspection())
    await runIndexReport({ urls: urls.slice(0, 2), outDir: dir, date: DATE }, { client: { inspectUrl: first }, ...quiet })

    const second = vi.fn(async () => inspection())
    const result = await runIndexReport({ urls, outDir: dir, date: DATE }, { client: { inspectUrl: second }, ...quiet })

    expect(second.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual([U('/c')])
    expect(result).toMatchObject({ inspected: 1, skipped: 2 })
    const text = readFileSync(indexCsvPath(dir, DATE), 'utf8')
    expect(text.match(/^url,page_type/gm)).toHaveLength(1)
    expect(parseCsvObjects(text)).toHaveLength(3)
  })

  it('refuses to append to a CSV whose header is not the current one', async () => {
    writeFileSync(indexCsvPath(dir, DATE), 'url,something_else\n')
    const inspectUrl = vi.fn(async () => inspection())
    await expect(
      runIndexReport({ urls: [U('/a')], outDir: dir, date: DATE }, { client: { inspectUrl }, ...quiet }),
    ).rejects.toThrow(/header/i)
    expect(inspectUrl).not.toHaveBeenCalled()
  })

  it('does not save a URL whose inspection failed, reports it, and retries it next run', async () => {
    const inspectUrl = vi.fn(async (url: string) => {
      if (url === U('/bad')) throw new GscHttpError(400, 'not part of this property')
      return inspection()
    })
    const first = await runIndexReport(
      { urls: [U('/ok'), U('/bad')], outDir: dir, date: DATE },
      { client: { inspectUrl }, ...quiet },
    )
    expect(first.failed).toEqual([{ url: U('/bad'), message: expect.stringContaining('not part of this property') }])
    expect(parseCsvObjects(readFileSync(indexCsvPath(dir, DATE), 'utf8')).map((r) => r.url)).toEqual([U('/ok')])

    const retry = vi.fn(async () => inspection())
    await runIndexReport({ urls: [U('/ok'), U('/bad')], outDir: dir, date: DATE }, { client: { inspectUrl: retry }, ...quiet })
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('stops cleanly when the daily quota is spent, keeping what it saved, and finishes on rerun', async () => {
    const urls = ['/1', '/2', '/3', '/4', '/5'].map(U)
    let calls = 0
    const inspectUrl = vi.fn(async () => {
      if (++calls > 2) throw new QuotaExhaustedError('quota per day')
      return inspection()
    })
    const first = await runIndexReport(
      { urls, outDir: dir, date: DATE, concurrency: 1 },
      { client: { inspectUrl }, ...quiet },
    )
    expect(first).toMatchObject({ inspected: 2, stoppedOnQuota: true, remaining: 3 })
    expect(readFileSync(indexSummaryPath(dir, DATE), 'utf8')).toMatch(/partial/i)

    const resume = vi.fn(async () => inspection())
    const second = await runIndexReport({ urls, outDir: dir, date: DATE }, { client: { inspectUrl: resume }, ...quiet })
    expect(resume).toHaveBeenCalledTimes(3)
    expect(second).toMatchObject({ stoppedOnQuota: false, remaining: 0 })
  })

  it('aborts after repeated failures with no success (a bad credential must not burn the quota)', async () => {
    const urls = Array.from({ length: 40 }, (_, i) => U(`/p${i}`))
    const inspectUrl = vi.fn(async () => {
      throw new GscHttpError(403, 'forbidden')
    })
    const result = await runIndexReport(
      { urls, outDir: dir, date: DATE, concurrency: 1 },
      { client: { inspectUrl }, ...quiet },
    )
    expect(result.abortedOnErrors).toBe(true)
    expect(inspectUrl.mock.calls.length).toBeLessThanOrEqual(10)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('honours --limit and de-duplicates the URL list', async () => {
    const inspectUrl = vi.fn(async () => inspection())
    const result = await runIndexReport(
      { urls: [U('/a'), U('/a'), U('/b'), U('/c')], outDir: dir, date: DATE, limit: 2 },
      { client: { inspectUrl }, ...quiet },
    )
    expect(inspectUrl).toHaveBeenCalledTimes(2)
    expect(result.remaining).toBe(1)
  })

  it('never runs more than `concurrency` inspections at once', async () => {
    let inFlight = 0
    let peak = 0
    const inspectUrl = vi.fn(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return inspection()
    })
    const urls = Array.from({ length: 20 }, (_, i) => U(`/p${i}`))
    await runIndexReport({ urls, outDir: dir, date: DATE, concurrency: 4 }, { client: { inspectUrl }, ...quiet })
    expect(peak).toBe(4)
  })
})

describe('readDoneUrls', () => {
  it('collects the url column', () => {
    const text = [toCsvRow(INDEX_COLUMNS), toCsvRow([U('/a'), 'home']), toCsvRow([U('/b'), 'home'])].join('\n') + '\n'
    expect([...readDoneUrls(text)]).toEqual([U('/a'), U('/b')])
  })
})

describe('buildIndexSummary', () => {
  const row = (over: Partial<IndexRow>): IndexRow => ({
    url: U('/x'),
    page_type: 'game_hub',
    verdict: 'PASS',
    coverageState: 'Submitted and indexed',
    indexingState: 'INDEXING_ALLOWED',
    robotsTxtState: 'ALLOWED',
    pageFetchState: 'SUCCESSFUL',
    lastCrawlTime: '2026-09-30T10:00:00Z',
    googleCanonical: '',
    userCanonical: '',
    crawledAs: 'MOBILE',
    referringUrlCount: '0',
    ...over,
  })

  const rows: IndexRow[] = [
    row({ url: U('/i1') }),
    row({ url: U('/i2'), page_type: 'listing' }),
    row({ url: U('/d1'), verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed', lastCrawlTime: '', pageFetchState: '' }),
    row({ url: U('/u1'), verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google', lastCrawlTime: '', page_type: 'listing' }),
    row({
      url: U('/c1'),
      verdict: 'NEUTRAL',
      coverageState: 'Duplicate, Google chose different canonical than user',
      userCanonical: U('/c1'),
      googleCanonical: U('/c1-other'),
    }),
    row({ url: U('/n1'), verdict: 'FAIL', coverageState: 'Not found (404)', pageFetchState: 'NOT_FOUND' }),
    row({ url: U('/r1'), verdict: 'NEUTRAL', coverageState: 'Page with redirect', pageFetchState: 'SUCCESSFUL' }),
  ]
  const summary = buildIndexSummary(rows, { date: DATE, expectedUrls: [...rows.map((r) => r.url), U('/missing')] })

  it('counts by coverageState', () => {
    expect(summary).toMatch(/## Counts by coverageState/)
    expect(summary).toMatch(/\| Submitted and indexed \| 2 \|/)
    expect(summary).toMatch(/\| Not found \(404\) \| 1 \|/)
  })

  it('splits indexed from not indexed by verdict', () => {
    expect(summary).toMatch(/Indexed \(verdict PASS\)\D+2\b/)
    expect(summary).toMatch(/Not indexed\D+5\b/)
  })

  it('builds a page_type × coverageState table', () => {
    expect(summary).toMatch(/## page_type × coverageState/)
    const lines = summary
      .split('## page_type × coverageState')[1]
      .split('\n## ')[0]
      .split('\n')
      .filter((l) => l.startsWith('|'))
      .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    const [header, , ...body] = lines // second line is the |---| separator
    const cell = (pageType: string, state: string) =>
      body.find((r) => r[0] === pageType)?.[header.indexOf(state)]

    expect(cell('listing', 'Submitted and indexed')).toBe('1')
    expect(cell('listing', 'URL is unknown to Google')).toBe('1')
    expect(cell('listing', 'Not found (404)')).toBe('0')
    expect(cell('game_hub', 'Submitted and indexed')).toBe('1')
    expect(cell('game_hub', 'Not found (404)')).toBe('1')
  })

  it('lists canonical mismatches with both canonicals', () => {
    const sec = summary.split('## Canonical mismatches')[1].split('\n## ')[0]
    expect(sec).toContain(U('/c1'))
    expect(sec).toContain(U('/c1-other'))
  })

  it('lists never-crawled URLs', () => {
    const sec = summary.split('## Never crawled')[1].split('\n## ')[0]
    expect(sec).toContain(U('/d1'))
    expect(sec).toContain(U('/u1'))
    expect(sec).not.toContain(U('/i1'))
  })

  it('lists fetch errors and redirects separately', () => {
    const fetchSec = summary.split('## Fetch errors')[1].split('\n## ')[0]
    expect(fetchSec).toContain(U('/n1'))
    const redirSec = summary.split('## Redirects')[1].split('\n## ')[0]
    expect(redirSec).toContain(U('/r1'))
  })

  it('reports sitemap URLs that were not inspected', () => {
    const sec = summary.split('## Not inspected')[1]
    expect(sec).toContain(U('/missing'))
  })

  it('caps every example list at 10', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      row({ url: U(`/n${i}`), verdict: 'FAIL', coverageState: 'Not found (404)', pageFetchState: 'NOT_FOUND' }),
    )
    const s = buildIndexSummary(many, { date: DATE, expectedUrls: many.map((r) => r.url) })
    const sec = s.split('## Fetch errors')[1].split('\n## ')[0]
    expect(sec.match(/https:\/\/dropmarket\.gg\/n\d+/g)).toHaveLength(10)
    expect(sec).toMatch(/25/)
  })

  it('marks a run that did not cover every sitemap URL as partial', () => {
    expect(summary).toMatch(/partial/i)
  })
})
