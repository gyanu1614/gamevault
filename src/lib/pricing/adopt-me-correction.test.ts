import { describe, expect, it } from 'vitest'

import {
  confidenceFor,
  correctAdoptMePrices,
} from './adopt-me-correction'
import type { RawListing } from './reputable-adapter'

/** Two reputable listings for a pet+variant (the engine needs >=2). */
function rep(
  petId: string,
  variant: string,
  prices: number[],
): RawListing[] {
  return prices.map((priceUsd) => ({
    itemId: petId,
    variant,
    priceUsd,
    reviews: 500,
  }))
}

describe('confidenceFor', () => {
  it('maps count to the SAB-parity thresholds', () => {
    expect(confidenceFor(30)).toBe('highly_accurate')
    expect(confidenceFor(12)).toBe('high')
    expect(confidenceFor(4)).toBe('medium')
    expect(confidenceFor(2)).toBe('low')
  })
})

describe('correctAdoptMePrices', () => {
  it('produces reputable cheapest/average per pet+variant', () => {
    const out = correctAdoptMePrices([
      ...rep('shadow', 'FR', [300, 320, 340]),
      ...rep('shadow', 'NEON', [500, 520]),
    ])
    const fr = out.find((c) => c.variant === 'FR')
    expect(fr?.cheapestUsd).toBe(300)
    expect(fr?.petId).toBe('shadow')
    const neon = out.find((c) => c.variant === 'NEON')
    expect(neon?.cheapestUsd).toBe(500)
  })

  it('drops a lower form priced above a higher form (ladder sanity)', () => {
    // N (rank 0) coming out at $900 while FR (rank 2) is $300 is mislabeled
    // noise — N must be dropped.
    const out = correctAdoptMePrices([
      ...rep('bad', 'FR', [300, 300]),
      ...rep('bad', 'N', [900, 900]),
    ])
    expect(out.find((c) => c.variant === 'N')).toBeUndefined()
    expect(out.find((c) => c.variant === 'FR')?.cheapestUsd).toBe(300)
  })

  it('ignores non-reputable (sub-100-review) sellers', () => {
    const out = correctAdoptMePrices([
      { itemId: 'p', variant: 'FR', priceUsd: 10, reviews: 2 }, // bait
      { itemId: 'p', variant: 'FR', priceUsd: 300, reviews: 400 },
      { itemId: 'p', variant: 'FR', priceUsd: 320, reviews: 300 },
    ])
    expect(out.find((c) => c.variant === 'FR')?.cheapestUsd).toBe(300)
  })

  it('leaves a single-reputable-listing variant unpriced (not a market)', () => {
    const out = correctAdoptMePrices([
      { itemId: 'p', variant: 'MEGA', priceUsd: 5000, reviews: 9999 },
    ])
    expect(out).toHaveLength(0)
  })
})
