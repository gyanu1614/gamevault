/**
 * The URL Inspection index report: inspect every URL, save each result to the
 * day's CSV as it lands, and summarise the CSV.
 *
 * The CSV is the only state. A rerun on the same day reads it, skips what is
 * saved, and carries on — so a quota stop, a crash or Ctrl-C costs nothing.
 * A URL whose inspection failed is NOT saved, so the next run retries it.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { GSC_SITE } from './config'
import {
  INDEX_COLUMNS,
  inspectionToRow,
  parseCsvObjects,
  toCsvRow,
  type IndexRow,
  type InspectionResponse,
} from './csv'
import { classifyPageType } from './page-type'
import { QuotaExhaustedError } from './throttle'

export const indexCsvPath = (outDir: string, date: string) => join(outDir, `index-report-${date}.csv`)
export const indexSummaryPath = (outDir: string, date: string) => join(outDir, `index-summary-${date}.md`)

const MAX_EXAMPLES = 10
const PROGRESS_EVERY = 50

export function readDoneUrls(csvText: string): Set<string> {
  return new Set(parseCsvObjects(csvText).map((r) => r.url).filter(Boolean))
}

export interface IndexReportOptions {
  urls: string[]
  outDir: string
  date: string
  concurrency?: number
  /** Inspect at most this many not-yet-saved URLs in this run. */
  limit?: number
  /** Abort after this many failures in a row (a bad credential must not burn quota). */
  maxConsecutiveFailures?: number
}

export interface IndexReportDeps {
  client: { inspectUrl: (url: string) => Promise<InspectionResponse> }
  log?: (message: string) => void
}

export interface IndexReportResult {
  csvPath: string
  summaryPath: string
  /** URLs inspected and saved by this run. */
  inspected: number
  /** URLs already saved earlier today. */
  skipped: number
  failed: { url: string; message: string }[]
  stoppedOnQuota: boolean
  abortedOnErrors: boolean
  /** Sitemap URLs with no saved row after this run. */
  remaining: number
}

export async function runIndexReport(
  opts: IndexReportOptions,
  deps: IndexReportDeps,
): Promise<IndexReportResult> {
  const { outDir, date, concurrency = 4, limit, maxConsecutiveFailures = 10 } = opts
  const { client, log = console.log } = deps
  const urls = [...new Set(opts.urls)]

  mkdirSync(outDir, { recursive: true })
  const csvPath = indexCsvPath(outDir, date)
  const summaryPath = indexSummaryPath(outDir, date)

  let done = new Set<string>()
  if (existsSync(csvPath)) {
    const text = readFileSync(csvPath, 'utf8')
    const header = text.split(/\r?\n/, 1)[0]
    if (header !== toCsvRow(INDEX_COLUMNS)) {
      throw new Error(
        `${csvPath} has an unexpected header — move it aside before running (the report only appends to its own format)`,
      )
    }
    done = readDoneUrls(text)
  } else {
    writeFileSync(csvPath, toCsvRow(INDEX_COLUMNS) + '\n')
  }

  const skipped = urls.filter((u) => done.has(u)).length
  const todo = urls.filter((u) => !done.has(u)).slice(0, limit ?? Infinity)
  log(`${urls.length} URLs: ${skipped} already saved today, ${todo.length} to inspect`)

  const failed: IndexReportResult['failed'] = []
  let inspected = 0
  let consecutiveFailures = 0
  let stoppedOnQuota = false
  let abortedOnErrors = false
  let next = 0

  async function worker(): Promise<void> {
    while (!stoppedOnQuota && !abortedOnErrors) {
      const url = todo[next++]
      if (url === undefined) return
      try {
        const response = await client.inspectUrl(url)
        const row = inspectionToRow(url, classifyPageType(url), response)
        appendFileSync(csvPath, toCsvRow(INDEX_COLUMNS.map((c) => row[c])) + '\n')
        inspected++
        consecutiveFailures = 0
        if (inspected % PROGRESS_EVERY === 0) log(`inspected ${inspected}/${todo.length}`)
      } catch (err) {
        if (err instanceof QuotaExhaustedError) {
          stoppedOnQuota = true
          log('Daily URL Inspection quota is spent — stopping. Rerun tomorrow to finish.')
          return
        }
        const message = err instanceof Error ? err.message : String(err)
        failed.push({ url, message })
        log(`FAILED ${url}: ${message}`)
        if (++consecutiveFailures >= maxConsecutiveFailures) {
          abortedOnErrors = true
          log(`${consecutiveFailures} failures in a row — aborting so a bad credential or setup does not burn the quota.`)
          return
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()))

  const rows = parseCsvObjects(readFileSync(csvPath, 'utf8')) as IndexRow[]
  const saved = new Set(rows.map((r) => r.url))
  const remaining = urls.filter((u) => !saved.has(u)).length
  writeFileSync(summaryPath, buildIndexSummary(rows, { date, expectedUrls: urls }))

  return { csvPath, summaryPath, inspected, skipped, failed, stoppedOnQuota, abortedOnErrors, remaining }
}

// ── Summary ─────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/\|/g, '\\|')
const label = (s: string) => esc(s || '(blank)')
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '–')

function mdTable(headers: string[], rows: (string | number)[][]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')
}

function countBy<T>(items: T[], key: (item: T) => string): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function exampleList(lines: string[]): string {
  if (!lines.length) return '_None._'
  const shown = lines.slice(0, MAX_EXAMPLES).map((l) => `- ${l}`)
  if (lines.length > MAX_EXAMPLES) shown.push(`- … and ${lines.length - MAX_EXAMPLES} more (see the CSV)`)
  return shown.join('\n')
}

export interface IndexSummaryContext {
  date: string
  /** Every URL the run was asked to cover (sitemap + extras). */
  expectedUrls: string[]
  site?: string
}

export function buildIndexSummary(rows: IndexRow[], ctx: IndexSummaryContext): string {
  const { date, expectedUrls, site = GSC_SITE } = ctx
  const total = rows.length
  const saved = new Set(rows.map((r) => r.url))
  const missing = expectedUrls.filter((u) => !saved.has(u))
  const indexed = rows.filter((r) => r.verdict === 'PASS').length

  const out: string[] = [`# URL Inspection summary — ${date}`, '']
  out.push(`Property \`${site}\` · ${total} URLs inspected of ${expectedUrls.length} requested.`)
  if (missing.length) {
    out.push('', `> **Partial run:** ${missing.length} URL(s) have no saved result yet — rerun to finish.`)
  }

  out.push('', '## Indexed vs not indexed', '')
  out.push(`- Indexed (verdict PASS): ${indexed} (${pct(indexed, total)})`)
  out.push(`- Not indexed: ${total - indexed} (${pct(total - indexed, total)})`)

  const byState = countBy(rows, (r) => r.coverageState)
  out.push('', '## Counts by coverageState', '')
  out.push(mdTable(['coverageState', 'URLs', 'Share'], byState.map(([s, n]) => [label(s), n, pct(n, total)])))

  const states = byState.map(([s]) => s)
  const pageTypes = countBy(rows, (r) => r.page_type).map(([t]) => t)
  const matrix = pageTypes.map((type) => {
    const ofType = rows.filter((r) => r.page_type === type)
    return [type, ...states.map((s) => ofType.filter((r) => r.coverageState === s).length), ofType.length]
  })
  out.push('', '## page_type × coverageState', '')
  out.push(mdTable(['page_type', ...states.map(label), 'Total'], matrix))

  const mismatches = rows.filter((r) => {
    const declared = r.userCanonical || r.url
    return r.googleCanonical && r.googleCanonical !== declared
  })
  out.push('', `## Canonical mismatches — ${mismatches.length}`, '')
  out.push('Google picked a different canonical than the page declares (or than its own URL when none is declared).', '')
  out.push(
    exampleList(
      mismatches.map((r) => `${r.url} → Google: ${r.googleCanonical} · declared: ${r.userCanonical || '(none)'}`),
    ),
  )

  const neverCrawled = rows.filter((r) => !r.lastCrawlTime)
  out.push('', `## Never crawled — ${neverCrawled.length}`, '')
  out.push(exampleList(neverCrawled.map((r) => `${r.url} (${r.coverageState || 'no coverage state'})`)))

  const fetchErrors = rows.filter(
    (r) => r.pageFetchState && r.pageFetchState !== 'SUCCESSFUL' && r.pageFetchState !== 'PAGE_FETCH_STATE_UNSPECIFIED',
  )
  out.push('', `## Fetch errors — ${fetchErrors.length}`, '')
  if (fetchErrors.length) {
    out.push(countBy(fetchErrors, (r) => r.pageFetchState).map(([s, n]) => `- ${s}: ${n}`).join('\n'), '')
  }
  out.push(exampleList(fetchErrors.map((r) => `${r.url} (${r.pageFetchState})`)))

  const redirects = rows.filter((r) => /redirect/i.test(r.coverageState))
  out.push('', `## Redirects — ${redirects.length}`, '')
  out.push(exampleList(redirects.map((r) => `${r.url} (${r.coverageState})`)))

  out.push('', `## Not inspected — ${missing.length}`, '')
  out.push(exampleList(missing))

  return out.join('\n') + '\n'
}
