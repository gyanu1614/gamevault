/**
 * The Search Analytics + sitemaps report. Read-only: it queries performance
 * data and lists sitemap status; nothing is submitted.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SearchAnalyticsBody, SearchAnalyticsResponse, SearchAnalyticsRow, SitemapEntry } from './client'
import { GSC_SITE } from './config'
import { toCsv } from './csv'

/** Search Console data is final ~2 days behind; the windows end there. */
const DATA_LAG_DAYS = 2
const TOP_N = 100
const QUERY_PAGE_SIZE = 25_000
const QUERY_MAX_PAGES = 10
const POSITION_MIN = 4
const POSITION_MAX = 20

export interface SearchWindow {
  label: '28d' | '90d'
  days: number
  startDate: string
  endDate: string
}

function addDays(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function computeWindows(today: string): SearchWindow[] {
  const endDate = addDays(today, -DATA_LAG_DAYS)
  return ([
    { label: '28d', days: 28 },
    { label: '90d', days: 90 },
  ] as const).map(({ label, days }) => ({ label, days, startDate: addDays(endDate, -(days - 1)), endDate }))
}

export interface SearchReportOptions {
  outDir: string
  /** File-name date (YYYY-MM-DD). */
  date: string
  /** The date the windows are measured back from; defaults to `date`. */
  today?: string
  queryPageSize?: number
}

export interface SearchReportDeps {
  client: {
    searchAnalytics: (body: SearchAnalyticsBody) => Promise<SearchAnalyticsResponse>
    listSitemaps: () => Promise<SitemapEntry[]>
  }
  log?: (message: string) => void
}

export interface SearchReportResult {
  summaryPath: string
  files: string[]
}

const round = (n: number, places: number) => String(Number(n.toFixed(places)))
const byClicks = (a: SearchAnalyticsRow, b: SearchAnalyticsRow) => b.clicks - a.clicks || b.impressions - a.impressions

interface WindowData {
  window: SearchWindow
  totals: SearchAnalyticsRow | null
  queries: SearchAnalyticsRow[]
  pages: SearchAnalyticsRow[]
  countries: SearchAnalyticsRow[]
  devices: SearchAnalyticsRow[]
  striking: SearchAnalyticsRow[]
}

export async function runSearchReport(
  opts: SearchReportOptions,
  deps: SearchReportDeps,
): Promise<SearchReportResult> {
  const { outDir, date, queryPageSize = QUERY_PAGE_SIZE } = opts
  const { client, log = console.log } = deps
  const windows = computeWindows(opts.today ?? date)

  mkdirSync(outDir, { recursive: true })
  const files: string[] = []
  const write = (name: string, text: string) => {
    const path = join(outDir, name)
    writeFileSync(path, text)
    files.push(path)
    return path
  }

  const dimensionRows = async (w: SearchWindow, dimension: string) =>
    (
      await client.searchAnalytics({
        startDate: w.startDate,
        endDate: w.endDate,
        dimensions: [dimension],
        dataState: 'final',
        rowLimit: TOP_N,
        startRow: 0,
      })
    ).rows

  async function allQueryRows(w: SearchWindow): Promise<SearchAnalyticsRow[]> {
    const all: SearchAnalyticsRow[] = []
    for (let page = 0; page < QUERY_MAX_PAGES; page++) {
      const { rows } = await client.searchAnalytics({
        startDate: w.startDate,
        endDate: w.endDate,
        dimensions: ['query'],
        dataState: 'final',
        rowLimit: queryPageSize,
        startRow: all.length,
      })
      all.push(...rows)
      if (rows.length < queryPageSize) break
    }
    return all
  }

  const data: WindowData[] = []
  for (const w of windows) {
    log(`Search Analytics ${w.label}: ${w.startDate} → ${w.endDate}`)
    const totalsRes = await client.searchAnalytics({
      startDate: w.startDate,
      endDate: w.endDate,
      dataState: 'final',
    })
    const queryRows = await allQueryRows(w)
    const d: WindowData = {
      window: w,
      totals: totalsRes.rows[0] ?? null,
      queries: [...queryRows].sort(byClicks).slice(0, TOP_N),
      pages: await dimensionRows(w, 'page'),
      countries: await dimensionRows(w, 'country'),
      devices: await dimensionRows(w, 'device'),
      striking: queryRows
        .filter((r) => r.position >= POSITION_MIN && r.position <= POSITION_MAX)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, TOP_N),
    }
    data.push(d)

    const dimCsv = (name: string, dimension: string, rows: SearchAnalyticsRow[]) =>
      write(
        `search-${w.label}-${name}-${date}.csv`,
        toCsv(
          [dimension, 'clicks', 'impressions', 'ctr', 'position'],
          rows.map((r) => ({
            [dimension]: r.keys?.[0] ?? '',
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: round(r.ctr, 4),
            position: round(r.position, 2),
          })),
        ),
      )

    write(
      `search-${w.label}-totals-${date}.csv`,
      toCsv(
        ['startDate', 'endDate', 'clicks', 'impressions', 'ctr', 'position'],
        d.totals
          ? [
              {
                startDate: w.startDate,
                endDate: w.endDate,
                clicks: d.totals.clicks,
                impressions: d.totals.impressions,
                ctr: round(d.totals.ctr, 4),
                position: round(d.totals.position, 2),
              },
            ]
          : [],
      ),
    )
    dimCsv('queries', 'query', d.queries)
    dimCsv('pages', 'page', d.pages)
    dimCsv('countries', 'country', d.countries)
    dimCsv('devices', 'device', d.devices)
    dimCsv('queries-pos-4-20', 'query', d.striking)
  }

  const sitemaps = await client.listSitemaps()
  write(
    `sitemaps-${date}.csv`,
    toCsv(
      [
        'path', 'type', 'isPending', 'isSitemapsIndex', 'lastSubmitted', 'lastDownloaded',
        'errors', 'warnings', 'submitted', 'indexed', 'contents',
      ],
      sitemaps.map((s) => ({
        path: s.path,
        type: s.type,
        isPending: s.isPending,
        isSitemapsIndex: s.isSitemapsIndex,
        lastSubmitted: s.lastSubmitted,
        lastDownloaded: s.lastDownloaded,
        errors: s.errors,
        warnings: s.warnings,
        submitted: s.contents.reduce((n, c) => n + c.submitted, 0),
        indexed: s.contents.reduce((n, c) => n + c.indexed, 0),
        contents: s.contents.map((c) => `${c.type}:${c.submitted}/${c.indexed}`).join(' '),
      })),
    ),
  )

  const summaryPath = write(`search-summary-${date}.md`, buildSearchSummary(data, sitemaps, date))
  return { summaryPath, files }
}

// ── Summary ─────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/\|/g, '\\|')

function topTable(label: string, rows: SearchAnalyticsRow[], n: number): string[] {
  if (!rows.length) return [`_${label}: no data._`]
  return [
    `| ${label} | Clicks | Impressions | CTR | Position |`,
    '|---|---|---|---|---|',
    ...rows
      .slice(0, n)
      .map(
        (r) =>
          `| ${esc(r.keys?.[0] ?? '')} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(2)}% | ${r.position.toFixed(1)} |`,
      ),
  ]
}

export function buildSearchSummary(data: WindowData[], sitemaps: SitemapEntry[], date: string): string {
  const out = [`# Search Console report — ${date}`, '', `Property \`${GSC_SITE}\` · web search · final data only.`]

  for (const d of data) {
    const { window: w, totals } = d
    out.push('', `## Last ${w.days} days (${w.startDate} → ${w.endDate})`, '')
    if (!totals && !d.queries.length) {
      out.push('No data in this window yet.')
      continue
    }
    if (totals) {
      out.push(
        `**${totals.clicks} clicks · ${totals.impressions} impressions · ${(totals.ctr * 100).toFixed(2)}% CTR · avg position ${totals.position.toFixed(1)}**`,
        '',
      )
    }
    out.push('### Top queries', '', ...topTable('Query', d.queries, 10))
    out.push('', '### Top pages', '', ...topTable('Page', d.pages, 10))
    out.push('', '### Countries', '', ...topTable('Country', d.countries, 5))
    out.push('', '### Devices', '', ...topTable('Device', d.devices, 5))
    out.push('', `### Queries at position ${POSITION_MIN}–${POSITION_MAX} (most impressions)`, '', ...topTable('Query', d.striking, 10))
  }

  out.push('', '## Sitemaps', '')
  if (!sitemaps.length) {
    out.push('No sitemaps are submitted for this property.')
  } else {
    out.push('| Sitemap | Last downloaded | Last submitted | Pending | Errors | Warnings | Submitted | Indexed |')
    out.push('|---|---|---|---|---|---|---|---|')
    for (const s of sitemaps) {
      const submitted = s.contents.reduce((n, c) => n + c.submitted, 0)
      const indexed = s.contents.reduce((n, c) => n + c.indexed, 0)
      out.push(
        `| ${esc(s.path)} | ${s.lastDownloaded || '–'} | ${s.lastSubmitted || '–'} | ${s.isPending ? 'yes' : 'no'} | ${s.errors} | ${s.warnings} | ${submitted} | ${indexed} |`,
      )
    }
  }
  return out.join('\n') + '\n'
}
