import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseSellerFeePage,
  stripUnitSuffix,
  chartGameNames,
  diffChart,
  matchChartName,
  ELDORADO_FEES_URL,
} from './eldorado'

const html = readFileSync(join(__dirname, '__fixtures__', 'eldorado-seller-fees.html'), 'utf8')

describe('parseSellerFeePage', () => {
  it('reads every game row under its section, skipping the header rows', () => {
    const rows = parseSellerFeePage(html)
    expect(rows.length).toBeGreaterThan(190)
    const sections = new Set(rows.map((r) => r.section))
    expect([...sections].sort()).toEqual(['accounts', 'boosting', 'currency', 'items', 'top_up'])
    expect(rows.find((r) => r.rawName === 'Steal an Egg')).toMatchObject({ section: 'items', fee: '15%' })
  })

  it('does not emit the section header or the summary table as games', () => {
    const names = parseSellerFeePage(html).map((r) => r.rawName)
    expect(names).not.toContain('Currency')
    expect(names).not.toContain('Items')
    expect(names).not.toContain('Sales fee')
    expect(names).not.toContain('')
  })

  it('normalises fee text (arrows, emoji, dated notes) to the percentage', () => {
    const rows = parseSellerFeePage(html)
    expect(rows.find((r) => r.rawName === 'RuneScape 3 Gold')?.fee).toBe('1.5%')
  })

  it('handles an empty or non-table document', () => {
    expect(parseSellerFeePage('<html></html>')).toEqual([])
  })

  it('pins the URL we fetch (support.eldorado.gg article; /sell links to it)', () => {
    expect(ELDORADO_FEES_URL).toBe('https://support.eldorado.gg/en/articles/8409025-seller-fees')
  })
})

describe('stripUnitSuffix', () => {
  it('drops currency units so a currency row names the game', () => {
    expect(stripUnitSuffix('Grow a Garden Sheckles')).toBe('Grow a Garden')
    expect(stripUnitSuffix('Old School RuneScape Gold')).toBe('Old School RuneScape')
    expect(stripUnitSuffix('Fortnite V-Bucks')).toBe('Fortnite')
    expect(stripUnitSuffix('Pets Go Diamonds')).toBe('Pets Go')
  })

  it('drops the Accounts qualifier', () => {
    expect(stripUnitSuffix('League of Legends Accounts')).toBe('League of Legends')
  })

  it('leaves a plain game name alone', () => {
    expect(stripUnitSuffix('Steal an Egg')).toBe('Steal an Egg')
    expect(stripUnitSuffix('Gold Rush Tycoon')).toBe('Gold Rush Tycoon') // unit only stripped from the END
  })
})

describe('chartGameNames', () => {
  it('returns distinct game names across sections', () => {
    const names = chartGameNames(html)
    expect(names).toContain('Steal an Egg')
    expect(names).toContain('Grow a Garden')
    expect(names.filter((n) => n === 'Grow a Garden')).toHaveLength(1)
    expect(names.length).toBeGreaterThan(120)
  })
})

describe('diffChart', () => {
  it('returns names new since the previous snapshot, compared case/punctuation-insensitively', () => {
    const d = diffChart(['Steal a Brainrot', 'Adopt Me'], ['steal a brainrot!', 'Adopt Me', 'Steal an Egg'])
    expect(d.added).toEqual(['Steal an Egg'])
    expect(d.removed).toEqual([])
  })

  it('treats a missing previous snapshot as "nothing is new" — the first run only seeds', () => {
    expect(diffChart(null, ['A', 'B'])).toEqual({ added: [], removed: [], seeded: true })
  })
})

describe('matchChartName', () => {
  const catalogue = [
    { slug: 'steal-a-brainrot', name: 'Steal a Brainrot' },
    { slug: 'adopt-me', name: 'Adopt Me' },
    { slug: 'grow-a-garden', name: 'Grow a Garden' },
    { slug: 'grow-a-garden-2', name: 'Grow a Garden 2' },
  ]

  it('matches an exact catalogue title', () => {
    expect(matchChartName('Adopt Me!', catalogue)).toMatchObject({ status: 'matched', slug: 'adopt-me' })
  })

  it('reports a chart name with no catalogue game as unmatched (that is the signal)', () => {
    expect(matchChartName('Steal an Egg', catalogue)).toMatchObject({ status: 'unmatched' })
  })

  it('flags an ambiguous name rather than guessing', () => {
    const r = matchChartName('Grow a Garden', [
      { slug: 'grow-a-garden', name: 'Grow a Garden' },
      { slug: 'grow-a-garden-dupe', name: 'Grow A Garden!' },
    ])
    expect(r.status).toBe('ambiguous')
  })
})
