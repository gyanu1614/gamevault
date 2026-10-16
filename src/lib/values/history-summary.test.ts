import { describe, expect, it } from 'vitest'

import { priceHistorySummary } from './history-summary'

const day = (d: number, price: number) => ({ date: `2026-10-${String(d).padStart(2, '0')}`, price })

describe('priceHistorySummary', () => {
  it('30-day move, low and high, from the daily prices (what the browser-only chart shows, as text)', () => {
    const pts = [day(1, 8), day(5, 7.5), day(10, 6), day(15, 6.5), day(20, 7), day(25, 6.4), day(30, 6.4)]
    expect(priceHistorySummary('Fly Ride Vampire Dragon', pts)).toBe(
      'Over the last 30 days the Fly Ride Vampire Dragon moved from $8 to $6.40 (down 20%), with a low of $6 and a high of $8 across 7 daily prices.',
    )
  })
  it('rising and flat; too little history says nothing', () => {
    expect(priceHistorySummary('Harvester', [day(1, 5), day(2, 5), day(3, 5), day(4, 5), day(5, 6)])).toBe(
      'Over the last 5 days the Harvester moved from $5 to $6 (up 20%), with a low of $5 and a high of $6 across 5 daily prices.',
    )
    expect(priceHistorySummary('Harvester', [day(1, 5), day(2, 5), day(3, 5), day(4, 5), day(5, 5)])).toContain('(no change)')
    expect(priceHistorySummary('Harvester', [day(1, 5), day(2, 5)])).toBeNull()
    expect(priceHistorySummary('Harvester', undefined)).toBeNull()
  })
})
