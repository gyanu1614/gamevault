/**
 * The pricing registry is the contract between the two repricing callers.
 *
 * Repricing moved off the Vercel function onto the GH Actions runner after
 * /api/cron/correct-prices 504'd on every crawl for five days (the full-table
 * read outgrew the 300s budget) while triggerCron swallowed the failure. The
 * runner and the manual route must therefore reprice the SAME games the SAME
 * way — a game registered in one but not the other is how a game silently
 * stops being priced, which is the bug class this whole change exists to end.
 */
import { describe, it, expect } from 'vitest'

import {
  PRICING_GAMES,
  findPricingGame,
  pricingGameKeys,
} from '@/lib/pricing/registry'

describe('pricing registry', () => {
  it('registers every game that has a values pipeline', () => {
    // steal-an-egg landed with Step 3 (PR #73) and must be repriceable by the
    // runner exactly like the older two — `pnpm reprice --game=steal-an-egg`.
    expect(pricingGameKeys().sort()).toEqual([
      'adopt-me',
      'sab',
      'steal-an-egg',
    ])
  })

  it('exposes a callable run() per game', () => {
    for (const game of PRICING_GAMES) {
      expect(typeof game.run, `${game.key}.run`).toBe('function')
    }
  })

  it('looks a game up by key and misses cleanly', () => {
    expect(findPricingGame('sab')?.key).toBe('sab')
    expect(findPricingGame('steal-an-egg')?.key).toBe('steal-an-egg')
    expect(findPricingGame('not-a-game')).toBeUndefined()
  })

  it('has no duplicate keys', () => {
    const keys = pricingGameKeys()
    expect(new Set(keys).size).toBe(keys.length)
  })
})
