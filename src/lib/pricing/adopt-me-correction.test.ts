import { describe, expect, it } from 'vitest'

import {
  confidenceFor,
  correctAdoptMePrices,
  ladderBelow,
  planAdoptMeCorrection,
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

/** Real listings: {price, seller reviews} pairs from the 2026-10-05 crawl. */
function real(petId: string, variant: string, rows: Array<[number, number]>): RawListing[] {
  return rows.map(([priceUsd, reviews]) => ({ itemId: petId, variant, priceUsd, reviews }))
}

describe('ladder order (partial, not a straight line)', () => {
  it('N sits under every form; FR and NEON are not comparable', () => {
    for (const v of ['F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR']) expect(ladderBelow('N', v)).toBe(true)
    expect(ladderBelow('FR', 'NFR')).toBe(true)
    expect(ladderBelow('NEON', 'MEGA')).toBe(true)
    expect(ladderBelow('NFR', 'MFR')).toBe(true)
    expect(ladderBelow('FR', 'NEON')).toBe(false)
    expect(ladderBelow('NEON', 'FR')).toBe(false)
    expect(ladderBelow('FR', 'MEGA')).toBe(false)
    expect(ladderBelow('MFR', 'N')).toBe(false)
  })
})

describe('planAdoptMeCorrection — ladder inversions', () => {
  it('flags and withholds a fresh Normal priced above the Neon Fly Ride (shrew, N-trait Neons)', () => {
    const plan = planAdoptMeCorrection([
      // "N Shrew | Flare" $18.74, "N Shrew" $81.19 — Eldorado N = Neon, filed as Normal.
      ...real('shrew', 'N', [[18.74, 27028], [81.19, 12230]]),
      ...real('shrew', 'NFR', [[10.49, 8666], [12.99, 83058], [16.39, 510], [17.97, 1343806], [17.99, 160919]]),
      ...real('shrew', 'FR', [[4.99, 701], [5.3, 510], [5.87, 107097], [6.12, 1343799], [6.65, 191787]]),
    ])
    expect(plan.corrections.find((c) => c.variant === 'N')).toBeUndefined()
    expect(plan.corrections.map((c) => c.variant).sort()).toEqual(['FR', 'NFR'])
    expect(plan.flagged).toEqual([
      expect.objectContaining({ petId: 'shrew', variant: 'N', fresh: true, above: ['FR', 'NFR'] }),
    ])
  })

  it('a stale observed value that inverts against this run is unpublished (caterpillar N $59.54)', () => {
    const plan = planAdoptMeCorrection(
      [
        ...real('caterpillar', 'NEON', [[35.26, 27027], [41, 25663], [59.54, 1343802], [59.55, 12230], [62.82, 1343802]]),
        ...real('caterpillar', 'R', [[7.99, 15699], [8.94, 20984], [9.7, 1343799], [10.04, 12230]]),
        ...real('caterpillar', 'FR', [[8.4, 107097], [9, 15699], [9.5, 27027]]),
      ],
      // Stored from the 2026-10-05 04:56 run; nothing re-priced N this time.
      [{ petId: 'caterpillar', variant: 'N', averageUsd: 59.54, cheapestUsd: 35.26, reputableCount: 7 }],
    )
    expect(plan.flagged).toEqual([
      expect.objectContaining({ petId: 'caterpillar', variant: 'N', fresh: false }),
    ])
    expect(plan.corrections.map((c) => c.variant).sort()).toEqual(['FR', 'NEON', 'R'])
  })

  it('a Fly Ride above the Neon is a real market (incomparable forms), not an inversion', () => {
    const plan = planAdoptMeCorrection([
      ...rep('cheap', 'FR', [9, 9.5, 10]),
      ...rep('cheap', 'NEON', [5, 5.5, 6]),
    ])
    expect(plan.flagged).toEqual([])
    expect(plan.corrections.map((c) => c.variant).sort()).toEqual(['FR', 'NEON'])
  })

  it('checks a pet nothing re-priced this run (stored ladder only)', () => {
    const plan = planAdoptMeCorrection(
      [],
      [
        { petId: 'p', variant: 'N', averageUsd: 40, cheapestUsd: 38, reputableCount: 2 },
        { petId: 'p', variant: 'R', averageUsd: 6, cheapestUsd: 5, reputableCount: 9 },
        { petId: 'p', variant: 'FR', averageUsd: 8, cheapestUsd: 7, reputableCount: 12 },
      ],
    )
    expect(plan.flagged).toEqual([expect.objectContaining({ petId: 'p', variant: 'N', fresh: false, above: ['FR', 'R'] })])
  })

  it('a stale value that agrees with the ladder is left alone', () => {
    const plan = planAdoptMeCorrection(
      [...rep('p', 'FR', [30, 31])],
      [{ petId: 'p', variant: 'N', averageUsd: 12, cheapestUsd: 11, reputableCount: 3 }],
    )
    expect(plan.flagged).toEqual([])
  })
})

describe('planAdoptMeCorrection — placeholder listings', () => {
  it("drops a lone listing 10x above the rest (2d-kitty MFR $3,618.88 'Adopt Me > 2D Kitty > MFR')", () => {
    const plan = planAdoptMeCorrection(
      real('2d-kitty', 'MFR', [[22.19, 127477], [68.25, 15699], [3618.88, 1343801]]),
    )
    const mfr = plan.corrections.find((c) => c.variant === 'MFR')
    expect(mfr?.cheapestUsd).toBe(22.19)
    expect(mfr?.averageUsd).toBeLessThan(100)
    expect(plan.placeholdersDropped).toBe(1)
  })

  it('keeps ordinary dispersion', () => {
    const plan = planAdoptMeCorrection(real('p', 'MFR', [[47.98, 448694], [55.27, 1343802], [119.98, 43091]]))
    expect(plan.placeholdersDropped).toBe(0)
  })
})
