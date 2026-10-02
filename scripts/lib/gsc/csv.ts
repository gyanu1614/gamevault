/** Minimal RFC 4180 CSV writer/parser and the index-report row shape. */

import type { PageType } from './page-type'

export type CsvCell = string | number | boolean | null | undefined

export function toCsvRow(values: readonly CsvCell[]): string {
  return values
    .map((v) => {
      const s = v == null ? '' : String(v)
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    })
    .join(',')
}

export function toCsv(
  columns: readonly string[],
  rows: readonly Record<string, CsvCell>[],
): string {
  const lines = [toCsvRow(columns), ...rows.map((r) => toCsvRow(columns.map((c) => r[c])))]
  return lines.join('\n') + '\n'
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let touched = false

  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
    touched = false
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      touched = true
    } else if (ch === ',') {
      endCell()
      touched = true
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else {
      cell += ch
      touched = true
    }
  }
  if (touched || cell !== '') endRow()
  return rows
}

export function parseCsvObjects(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

// ── URL Inspection → index-report row ───────────────────────────────────────

export const INDEX_COLUMNS = [
  'url',
  'page_type',
  'verdict',
  'coverageState',
  'indexingState',
  'robotsTxtState',
  'pageFetchState',
  'lastCrawlTime',
  'googleCanonical',
  'userCanonical',
  'crawledAs',
  'referringUrlCount',
] as const

export type IndexRow = Record<(typeof INDEX_COLUMNS)[number], string>

/** The slice of the URL Inspection response the report reads. */
export interface InspectionResponse {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string
      coverageState?: string
      indexingState?: string
      robotsTxtState?: string
      pageFetchState?: string
      lastCrawlTime?: string
      googleCanonical?: string
      userCanonical?: string
      crawledAs?: string
      referringUrls?: string[]
      sitemap?: string[]
    }
  }
}

export function inspectionToRow(
  url: string,
  pageType: PageType,
  response: InspectionResponse,
): IndexRow {
  const s = response.inspectionResult?.indexStatusResult ?? {}
  return {
    url,
    page_type: pageType,
    verdict: s.verdict ?? '',
    coverageState: s.coverageState ?? '',
    indexingState: s.indexingState ?? '',
    robotsTxtState: s.robotsTxtState ?? '',
    pageFetchState: s.pageFetchState ?? '',
    lastCrawlTime: s.lastCrawlTime ?? '',
    googleCanonical: s.googleCanonical ?? '',
    userCanonical: s.userCanonical ?? '',
    crawledAs: s.crawledAs ?? '',
    referringUrlCount: String(s.referringUrls?.length ?? 0),
  }
}
