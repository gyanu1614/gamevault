import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { currencyGuideSchema } from './schema'
import { RAW_CURRENCY_GUIDES } from './data'
import { CURRENCY_GUIDE_SLUGS, PUBLISHER_FORBIDS_RMT, getCurrencyGuide, guideFamily } from './index'

/**
 * Every fact sheet in scripts/content-seeds/currency-guides must pass the
 * schema here: a bad file fails CI, while the page itself just skips it.
 */
const DIR = path.join(process.cwd(), 'scripts/content-seeds/currency-guides')
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()

describe('currency guide fact sheets', () => {
  it('there are files to validate (wave 1: 15 games)', () => {
    expect(files.length).toBeGreaterThanOrEqual(15)
  })

  it.each(files)('%s passes the schema', (file) => {
    const raw = JSON.parse(readFileSync(path.join(DIR, file), 'utf8'))
    const result = currencyGuideSchema.safeParse(raw)
    expect(result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([])
    expect(raw.game).toBe(file.replace(/\.json$/, ''))
  })

  it('every file is registered in data.ts, and nothing else is', () => {
    expect([...CURRENCY_GUIDE_SLUGS].sort()).toEqual(files.map((f) => f.replace(/\.json$/, '')).sort())
  })

  it.each(CURRENCY_GUIDE_SLUGS)('%s loads through getCurrencyGuide', (slug) => {
    expect(getCurrencyGuide(slug)?.game).toBe(slug)
  })

  it('a game without a file has no guide', () => {
    expect(getCurrencyGuide('sea-of-thieves')).toBeNull()
  })

  it('a file that fails the schema renders no guide instead of throwing', () => {
    RAW_CURRENCY_GUIDES['broken-test-game'] = { game: 'broken-test-game', currency: 'Coins' }
    try {
      expect(getCurrencyGuide('broken-test-game')).toBeNull()
    } finally {
      delete RAW_CURRENCY_GUIDES['broken-test-game']
    }
  })

  it('the publisher-rules flag covers GTA$ and Tarkov Roubles (README safety flags)', () => {
    expect(Object.keys(PUBLISHER_FORBIDS_RMT).sort()).toEqual(['escape-from-tarkov', 'gta-v'])
  })

  it('Roblox experiences group with Roblox for related links', () => {
    expect(guideFamily(getCurrencyGuide('roblox')!)).toBe('roblox')
    expect(guideFamily(getCurrencyGuide('blade-ball')!)).toBe('roblox')
    expect(guideFamily(getCurrencyGuide('fortnite')!)).toBe('other')
  })
})
