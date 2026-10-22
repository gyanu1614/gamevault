import { describe, expect, it } from 'vitest'
import { evaluateGameHealth, healthMessage, VALUES_HEALTH_GAMES, type GameHealthInput } from './health'

const NOW = Date.parse('2026-10-22T09:15:00Z')
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const sab = VALUES_HEALTH_GAMES.find((g) => g.gameSlug === 'steal-a-brainrot')!
const am = VALUES_HEALTH_GAMES.find((g) => g.gameSlug === 'adopt-me')!
const healthy = (over: Partial<GameHealthInput> = {}): GameHealthInput => ({
  lastCatalogueRun: { startedAt: hoursAgo(20), status: 'nothing_new' },
  lastPriceAt: hoursAgo(10),
  listCount: 570,
  ...over,
})

describe('VALUES_HEALTH_GAMES', () => {
  it('covers every hub game with a price signal and a list count', () => {
    expect(VALUES_HEALTH_GAMES.map((g) => g.gameSlug).sort()).toEqual(['adopt-me', 'murder-mystery-2', 'steal-a-brainrot', 'steal-an-egg'])
  })
})

describe('evaluateGameHealth', () => {
  it('a game that ran, priced and lists items is healthy', () => {
    expect(evaluateGameHealth(sab, healthy(), NOW)).toEqual([])
  })

  it('flags a catalogue that never ran, ran too long ago, failed or stopped itself', () => {
    expect(evaluateGameHealth(sab, healthy({ lastCatalogueRun: null }), NOW).map((p) => p.kind)).toEqual(['catalogue'])
    expect(evaluateGameHealth(sab, healthy({ lastCatalogueRun: { startedAt: hoursAgo(60), status: 'ok' } }), NOW)[0].message).toMatch(/60 h ago/)
    expect(evaluateGameHealth(sab, healthy({ lastCatalogueRun: { startedAt: hoursAgo(5), status: 'failed' } }), NOW)[0].message).toMatch(/failed/)
    expect(evaluateGameHealth(sab, healthy({ lastCatalogueRun: { startedAt: hoursAgo(5), status: 'blocked' } }), NOW)[0].message).toMatch(/stopped itself/)
  })

  it('flags stale prices past the game\'s window (Adopt Me allows longer: it only moves when a price changes)', () => {
    expect(evaluateGameHealth(sab, healthy({ lastPriceAt: hoursAgo(50) }), NOW).map((p) => p.kind)).toEqual(['prices'])
    expect(evaluateGameHealth(am, healthy({ lastPriceAt: hoursAgo(50) }), NOW)).toEqual([])
    expect(evaluateGameHealth(am, healthy({ lastPriceAt: hoursAgo(80) }), NOW).map((p) => p.kind)).toEqual(['prices'])
    expect(evaluateGameHealth(sab, healthy({ lastPriceAt: null }), NOW).map((p) => p.kind)).toEqual(['prices'])
  })

  it('flags an empty list (the cached "0 Brainrots" outage)', () => {
    expect(evaluateGameHealth(sab, healthy({ listCount: 0 }), NOW).map((p) => p.kind)).toEqual(['list'])
  })

  it('a read error is a problem, never a pass', () => {
    expect(evaluateGameHealth(sab, healthy({ readError: 'timeout' }), NOW).map((p) => p.kind)).toEqual(['read'])
  })
})

describe('healthMessage', () => {
  it('one Discord post listing every problem; nothing when healthy', () => {
    expect(healthMessage([])).toBeNull()
    const text = healthMessage([
      ...evaluateGameHealth(sab, healthy({ listCount: 0 }), NOW),
      ...evaluateGameHealth(am, healthy({ lastPriceAt: hoursAgo(80) }), NOW),
    ])!
    expect(text).toMatch(/^🩺 \*\*Values health: 2 problems\*\*/)
    expect(text).toMatch(/Steal a Brainrot: the value list is empty/)
    expect(text).toMatch(/Adopt Me: no price moved for 80 h/)
  })
})
