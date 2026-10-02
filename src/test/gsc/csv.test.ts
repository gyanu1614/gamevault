import { describe, expect, it } from 'vitest'

import {
  INDEX_COLUMNS,
  inspectionToRow,
  parseCsv,
  parseCsvObjects,
  toCsv,
  toCsvRow,
} from '../../../scripts/lib/gsc/csv'
import { blockNetwork } from './no-network'

blockNetwork()

describe('toCsvRow', () => {
  it('joins plain values with commas', () => {
    expect(toCsvRow(['a', 'b', 3])).toBe('a,b,3')
  })

  it('quotes values containing commas, quotes or newlines and doubles quotes', () => {
    expect(toCsvRow(['a,b', 'say "hi"', 'x\ny'])).toBe('"a,b","say ""hi""","x\ny"')
  })

  it('writes booleans as true/false', () => {
    expect(toCsvRow([true, false])).toBe('true,false')
  })

  it('writes null and undefined as empty cells', () => {
    expect(toCsvRow(['a', null, undefined, 0])).toBe('a,,,0')
  })
})

describe('toCsv / parseCsv', () => {
  it('round-trips awkward values', () => {
    const rows = [
      ['url', 'note'],
      ['https://dropmarket.gg/a?x=1,2', 'has "quotes", commas\nand a newline'],
      ['', 'empty first cell'],
    ]
    const text = rows.map((r) => toCsvRow(r)).join('\n') + '\n'
    expect(parseCsv(text)).toEqual(rows)
  })

  it('parses CRLF line endings and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('returns [] for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('toCsv writes a header then one line per row, newline-terminated', () => {
    const text = toCsv(['a', 'b'], [{ a: '1', b: 'x,y' }, { a: '2' }])
    expect(text).toBe('a,b\n1,"x,y"\n2,\n')
  })

  it('parseCsvObjects keys rows by the header', () => {
    expect(parseCsvObjects('a,b\n1,2\n3,4\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })
})

describe('inspectionToRow', () => {
  it('has the agreed column order', () => {
    expect([...INDEX_COLUMNS]).toEqual([
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
    ])
  })

  it('maps an inspection result onto the columns', () => {
    const row = inspectionToRow('https://dropmarket.gg/adopt-me', 'game_hub', {
      inspectionResult: {
        indexStatusResult: {
          verdict: 'PASS',
          coverageState: 'Submitted and indexed',
          indexingState: 'INDEXING_ALLOWED',
          robotsTxtState: 'ALLOWED',
          pageFetchState: 'SUCCESSFUL',
          lastCrawlTime: '2026-09-30T10:00:00Z',
          googleCanonical: 'https://dropmarket.gg/adopt-me',
          userCanonical: 'https://dropmarket.gg/adopt-me',
          crawledAs: 'MOBILE',
          referringUrls: ['https://dropmarket.gg/', 'https://dropmarket.gg/browse'],
          sitemap: ['https://dropmarket.gg/sitemap.xml'],
        },
      },
    })
    expect(row).toEqual({
      url: 'https://dropmarket.gg/adopt-me',
      page_type: 'game_hub',
      verdict: 'PASS',
      coverageState: 'Submitted and indexed',
      indexingState: 'INDEXING_ALLOWED',
      robotsTxtState: 'ALLOWED',
      pageFetchState: 'SUCCESSFUL',
      lastCrawlTime: '2026-09-30T10:00:00Z',
      googleCanonical: 'https://dropmarket.gg/adopt-me',
      userCanonical: 'https://dropmarket.gg/adopt-me',
      crawledAs: 'MOBILE',
      referringUrlCount: '2',
    })
  })

  it('leaves fields blank when Google returns no index status (never crawled)', () => {
    const row = inspectionToRow('https://dropmarket.gg/x', 'other', {
      inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google' } },
    })
    expect(row.lastCrawlTime).toBe('')
    expect(row.googleCanonical).toBe('')
    expect(row.referringUrlCount).toBe('0')
    expect(row.coverageState).toBe('URL is unknown to Google')
  })

  it('tolerates a response with no inspectionResult at all', () => {
    const row = inspectionToRow('https://dropmarket.gg/x', 'other', {})
    expect(row.verdict).toBe('')
    expect(row.referringUrlCount).toBe('0')
  })
})
