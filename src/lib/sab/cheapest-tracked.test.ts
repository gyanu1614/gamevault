import { describe, expect, it } from 'vitest'

import { cheapestTracked, type TrackedListing } from './cheapest-tracked'

const NOW = Date.UTC(2026, 7, 5, 12, 0, 0) // fixed clock for determinism

function hoursAgo(h: number): string {
  return new Date(NOW - h * 60 * 60 * 1000).toISOString()
}

function listing(
  priceUsd: number,
  source: string,
  ageHours: number,
): TrackedListing {
  return { priceUsd, source, observedAt: hoursAgo(ageHours) }
}

describe('cheapestTracked', () => {
  it('returns the cheapest fresh trusted listing (Skibidi at value)', () => {
    const out = cheapestTracked(
      [
        listing(190.92, 'eldorado', 3),
        listing(200, 'eldorado', 5),
        listing(233, 'g2g', 6),
      ],
      190.92,
      NOW,
    )
    expect(out?.priceUsd).toBe(190.92)
    expect(out?.isDeal).toBe(false) // equal to value, not a discount
  })

  it('flags a genuine discount as a deal (Strawberry $613 vs $676)', () => {
    const out = cheapestTracked(
      [listing(613.78, 'eldorado', 4), listing(700, 'eldorado', 4)],
      676.57,
      NOW,
    )
    expect(out?.priceUsd).toBe(613.78)
    expect(out?.isDeal).toBe(true)
  })

  it('drops an unverifiable deep undercut (the $97 G2G fake)', () => {
    const out = cheapestTracked(
      [
        listing(97.35, 'g2g', 2), // 86% under a $676 market — dropped
        listing(700, 'eldorado', 3),
        listing(733, 'eldorado', 3),
      ],
      676.57,
      NOW,
    )
    expect(out?.priceUsd).toBe(700)
    expect(out?.source).toBe('eldorado')
  })

  it('ignores stale "active" listings beyond the freshness window', () => {
    const out = cheapestTracked(
      [
        listing(300, 'eldorado', 240), // 10 days old — stale, dropped
        listing(700, 'eldorado', 6),
      ],
      676.57,
      NOW,
    )
    expect(out?.priceUsd).toBe(700)
  })

  it('keeps a shallow cross-source deal within the undercut band', () => {
    // A G2G listing 5% under value is a plausible real deal (inside the 8% band).
    const out = cheapestTracked(
      [listing(16.0, 'g2g', 3), listing(16.69, 'eldorado', 3)],
      16.69,
      NOW,
    )
    expect(out?.priceUsd).toBe(16.0)
    expect(out?.isDeal).toBe(true)
  })

  it('returns null when there is no published value to judge trust against', () => {
    expect(
      cheapestTracked([listing(1, 'eldorado', 1)], null, NOW),
    ).toBeNull()
  })

  it('returns null when nothing is fresh (the long-tail em-dash case)', () => {
    expect(
      cheapestTracked(
        [listing(0.5, 'eldorado', 200), listing(0.6, 'g2g', 300)],
        0.5,
        NOW,
      ),
    ).toBeNull()
  })

  it('returns null when every fresh listing is a deep undercut', () => {
    // Only unverifiable listings far under value → nothing trustworthy to show.
    expect(
      cheapestTracked(
        [listing(50, 'g2g', 2), listing(60, 'itemku', 2)],
        676.57,
        NOW,
      ),
    ).toBeNull()
  })

  it('drops non-positive and non-finite prices', () => {
    const out = cheapestTracked(
      [
        listing(0, 'eldorado', 1),
        listing(Number.NaN, 'eldorado', 1),
        listing(700, 'eldorado', 1),
      ],
      676.57,
      NOW,
    )
    expect(out?.priceUsd).toBe(700)
  })
})
