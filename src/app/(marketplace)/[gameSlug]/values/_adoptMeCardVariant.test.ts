import { describe, it, expect } from 'vitest'
import { cardVariant, type AdoptMeVariantValue } from './_adoptMeListModel'

const v = (variant: string, cheapestUsd: number | null): AdoptMeVariantValue =>
  ({ variant, tradeValue: 1, cashUsd: cheapestUsd, cheapestUsd, averageUsd: null, isEstimated: false, confidence: 'low' }) as AdoptMeVariantValue

// Owner, 2026-10-14 ("i dont see the prices"): cheap pets like Poodle or Cat
// have no Fly Ride listing at all, so their cards opened on Fly Ride with "-"
// although Ride, Neon and Mega Fly Ride are priced.
describe('Adopt Me card variant', () => {
  it('opens on Fly Ride when it has a price', () => {
    expect(cardVariant({ FR: v('FR', 282.99), R: v('R', 200) } as never, 'FR')).toBe('FR')
  })

  it('opens on the nearest priced variant when nobody sells a Fly Ride', () => {
    expect(cardVariant({ FR: v('FR', null), R: v('R', 0.21), MFR: v('MFR', 1.18) } as never, 'FR')).toBe('R')
    expect(cardVariant({ FR: undefined, NEON: v('NEON', 0.34), MEGA: v('MEGA', 1.15) } as never, 'FR')).toBe('NEON')
  })

  it('keeps a variant the visitor chose for the whole list, priced or not', () => {
    expect(cardVariant({ MEGA: v('MEGA', null), R: v('R', 0.21) } as never, 'MEGA')).toBe('MEGA')
  })

  it('stays on Fly Ride when nothing is priced', () => {
    expect(cardVariant({} as never, 'FR')).toBe('FR')
  })
})
