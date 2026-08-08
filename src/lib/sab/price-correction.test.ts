import { describe, expect, it } from 'vitest'

import {
  ANCHOR_FENCE_RATIO,
  MIN_TRUSTED_SAMPLES,
  computeCorrections,
  lowestSupportedPrice,
  lowestSupportedPriceBySource,
  measureMutationMultipliers,
  median,
  quantile,
  type BrainrotMeta,
  type SourcedPrice,
  type VariantEstimate,
} from './price-correction'

const DEFAULT_MUTATION = 'mut-default'
const RAINBOW_MUTATION = 'mut-rainbow'

function brainrot(
  id: string,
  overrides: Partial<BrainrotMeta> = {},
): BrainrotMeta {
  return {
    brainrotId: id,
    rarity: 'Secret',
    ingameCost: 1_000_000,
    incomePerSecond: 1_000,
    ...overrides,
  }
}

function variant(
  brainrotId: string,
  overrides: Partial<VariantEstimate> = {},
): VariantEstimate {
  return {
    brainrotId,
    mutationId: DEFAULT_MUTATION,
    mutationSlug: 'default',
    valueUsd: 10,
    lowUsd: 9,
    highUsd: 11,
    sampleCount: 8,
    sourceCount: 2,
    ...overrides,
  }
}

/** A cohort of well-sampled peers all priced near $10. */
function peerGroup(count: number, price = 10) {
  const brainrots: BrainrotMeta[] = []
  const variants: VariantEstimate[] = []

  for (let index = 0; index < count; index += 1) {
    const id = `peer-${index}`
    brainrots.push(brainrot(id))
    variants.push(variant(id, { valueUsd: price }))
  }

  return { brainrots, variants }
}

describe('median / quantile', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('returns nearest-rank quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0)).toBe(1)
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(3)
    expect(quantile([], 0.5)).toBeNull()
  })
})

describe('lowestSupportedPrice', () => {
  it('returns the cheapest price of a dense low cluster', () => {
    // Garama-shaped: tight cluster from $0.99. The floor is the bottom of it.
    const prices = [0.99, 1.0, 1.0, 1.04, 1.05, 1.1, 1.13, 1.29, 1.4, 2.29]
    expect(lowestSupportedPrice(prices)).toBe(0.99)
  })

  it('ignores a lone cheap bait below the real cluster', () => {
    const real = [0.99, 1.0, 1.0, 1.04, 1.05, 1.1]
    expect(lowestSupportedPrice([0.1, ...real])).toBe(0.99)
  })

  it('bails when 2+ listings sit far below the cluster (indistinguishable)', () => {
    // Two listings well below a $0.99 cluster — could be fakes OR a real cheaper
    // tier, and price alone can't tell. Per policy, bail to the cohort anchor
    // rather than guess. (Same rule that saves Headless from a $8999 floor.)
    const real = [0.99, 1.0, 1.0, 1.04, 1.05, 1.1]
    expect(lowestSupportedPrice([0.1, 0.2, ...real])).toBeNull()
  })

  it('does move for a genuine cluster of cheap listings', () => {
    // 3 near-identical cheap listings ARE support — real floor or coordinated
    // fraud indistinguishable by price alone. This is the accepted tradeoff.
    const real = [0.99, 1.0, 1.0, 1.04, 1.05, 1.1]
    expect(lowestSupportedPrice([0.3, 0.31, 0.32, ...real])).toBe(0.3)
  })

  it('returns null when there are too few listings for support', () => {
    expect(lowestSupportedPrice([9.98])).toBeNull()
    expect(lowestSupportedPrice([1, 2])).toBeNull()
  })

  it('returns null when prices are too scattered to trust a floor', () => {
    // No 3 consecutive within 1.6x → no supported floor.
    expect(lowestSupportedPrice([1, 5, 30, 200])).toBeNull()
  })

  it('ignores a single lone cheap bait below the cluster', () => {
    // One $0.10 bait below a real $0.99+ cluster → ignored, cluster wins.
    expect(lowestSupportedPrice([0.1, 0.99, 1, 1, 1.04, 1.05])).toBe(0.99)
  })

  it('bails (null) when the cheapest cluster sits far above 2+ cheaper listings', () => {
    // Scattered high-only market: lone $78 and $1000 below a cluster that only
    // forms at $8999-9999. The floor can't distinguish "2 real cheaper listings
    // the cluster ignores" from "2 fakes" by price alone, so it bails to let the
    // cohort anchor decide rather than publish an absurd $8999. (Headless
    // Horseman's real shape on 2026-08-01.)
    expect(lowestSupportedPrice([78.37, 1000, 4000, 8999.99, 9450, 9999])).toBeNull()
  })

  it('drops non-positive and non-finite prices before clustering', () => {
    const prices = [0, -1, Number.NaN, 1.0, 1.0, 1.05]
    expect(lowestSupportedPrice(prices)).toBe(1.0)
  })

  it('skips a lone low separated by a gap from the real cluster (Skibidi Toilet)', () => {
    // Real 2026-08-02 shape: a lone $162.45 sits 18% below a tight $191-200
    // cluster. The band ratio alone absorbs it (window spans only 1.20x), so the
    // old floor was $162.45 — a phantom underprice. The step rule requires the
    // floor-setter within 10% of its neighbour, so $162.45 is skipped and the
    // real cluster sets the floor at $191.02.
    const prices = [0.67, 162.45, 191.02, 194.72, 198.09, 198.09, 200]
    expect(lowestSupportedPrice(prices)).toBe(191.02)
  })

  it('skips the lone low but still finds the cluster just above it', () => {
    // A 13% first step is a gap; the fix does NOT null the item — it advances
    // past the lone low to the dense cluster one step up.
    expect(lowestSupportedPrice([0.3, 0.34, 0.35, 0.35, 0.36])).toBe(0.34)
  })

  it('keeps a genuinely tight cheap cluster (pennies apart)', () => {
    // Steps of ~1% are a real floor, not an outlier — unchanged by the step rule.
    expect(lowestSupportedPrice([0.99, 1.0, 1.0, 1.04])).toBe(0.99)
  })

  it('treats an exactly-FLOOR_STEP_RATIO step as within bound (boundary)', () => {
    // (1.1 - 1.0) / 1.0 === 0.10000000000000009 in binary float; the epsilon in
    // the guard keeps an exactly-10% step inside the bound, so $1.00 sets the
    // floor rather than being skipped to $1.10.
    expect(lowestSupportedPrice([1.0, 1.1, 1.1, 1.1])).toBe(1.0)
  })

  it('skips a low whose step just exceeds FLOOR_STEP_RATIO', () => {
    // An 11% first step is over the bound → the lone $1.00 is skipped and the
    // $1.11 cluster sets the floor.
    expect(lowestSupportedPrice([1.0, 1.11, 1.11, 1.11])).toBe(1.11)
  })
})

describe('lowestSupportedPriceBySource', () => {
  const s = (price: number, source: string): SourcedPrice => ({ price, source })

  it('clamps a deep cross-source undercut to the verified market (Strawberry)', () => {
    // Eldorado (trusted) floors at $700; a G2G cluster at $614-630 undercuts it by
    // 12% with no seller-trust data. The floor must not drop below the verified
    // market by more than the undercut band, so it lands near the $700 cluster,
    // NOT $614.
    const listings = [
      s(300, 'eldorado'), // lone fake, skipped by the trusted floor's own logic
      s(614.09, 'g2g'),
      s(620, 'g2g'),
      s(630, 'g2g'),
      s(700, 'eldorado'),
      s(733, 'eldorado'),
      s(748.85, 'eldorado'),
      s(750, 'eldorado'),
      s(790, 'eldorado'),
    ]
    const floor = lowestSupportedPriceBySource(listings)
    expect(floor).not.toBeNull()
    // Must be at/above the verified market, well above the $614 G2G undercut.
    expect(floor!).toBeGreaterThanOrEqual(700 * 0.92)
    expect(floor!).toBeGreaterThan(630)
  })

  it('keeps a shallow cross-source deal within the undercut band (Dragon Cannelloni)', () => {
    // Trusted floor $17.99; a G2G listing at $16.70 sits only 7% under — a
    // plausible real deal, inside the 8% band — so it IS honoured as the floor.
    const listings = [
      s(16.7, 'g2g'),
      s(17.99, 'eldorado'),
      s(18, 'eldorado'),
      s(18.5, 'eldorado'),
      s(19, 'eldorado'),
    ]
    expect(lowestSupportedPriceBySource(listings)).toBeCloseTo(16.7, 2)
  })

  it('drops an extreme unverifiable fake far below the trusted market (Jelly Moby)', () => {
    // A $1 Itemku listing under a $55 verified Eldorado market is a fake; the
    // floor follows the trusted cluster, not the $1.
    const listings = [
      s(1, 'itemku'),
      s(55, 'eldorado'),
      s(55, 'eldorado'),
      s(58, 'eldorado'),
      s(60, 'eldorado'),
    ]
    const floor = lowestSupportedPriceBySource(listings)
    expect(floor!).toBeGreaterThanOrEqual(55 * 0.92)
  })

  it('leaves an eldorado-cheapest group unchanged (the 91% healthy case)', () => {
    // When the trusted source is already the cheapest, the source-aware floor
    // equals the plain floor — no distortion of the healthy majority.
    const prices = [5, 5, 5.1, 5.1, 5.2, 5.2]
    const listings = prices.map((p) => s(p, 'eldorado'))
    expect(lowestSupportedPriceBySource(listings)).toBe(
      lowestSupportedPrice(prices),
    )
  })

  it('falls back to the plain all-source floor when trusted evidence is thin', () => {
    // Fewer than MIN_TRUSTED_SOURCE_LISTINGS trusted listings → behave exactly
    // like the plain floor over all prices (no verified market to anchor to).
    const listings = [
      s(4, 'g2g'),
      s(4, 'g2g'),
      s(4.1, 'g2g'),
      s(4.1, 'itemku'),
      s(9, 'eldorado'),
    ]
    const prices = listings.map((l) => l.price)
    expect(lowestSupportedPriceBySource(listings)).toBe(
      lowestSupportedPrice(prices),
    )
  })

  it('returns null when trusted listings exist but form no supported cluster', () => {
    // Trusted prices are too scattered to floor; do not invent one from
    // unverifiable sources.
    const listings = [
      s(10, 'eldorado'),
      s(50, 'eldorado'),
      s(300, 'eldorado'),
      s(12, 'g2g'),
      s(13, 'g2g'),
      s(14, 'g2g'),
    ]
    expect(lowestSupportedPriceBySource(listings)).toBeNull()
  })
})

describe('measureMutationMultipliers', () => {
  it('measures the variant/default price ratio from well-sampled pairs', () => {
    const variants: VariantEstimate[] = []

    // 20 Brainrots where Rainbow trades at exactly 3x the default.
    for (let index = 0; index < 20; index += 1) {
      const id = `b-${index}`
      variants.push(variant(id, { valueUsd: 10 }))
      variants.push(
        variant(id, {
          mutationId: RAINBOW_MUTATION,
          mutationSlug: 'rainbow',
          valueUsd: 30,
        }),
      )
    }

    const measured = measureMutationMultipliers(variants).get('rainbow')
    expect(measured?.multiplier).toBe(3)
    expect(measured?.pairCount).toBe(20)
  })

  it('ignores pairs where either side is thinly sampled', () => {
    const variants: VariantEstimate[] = []

    for (let index = 0; index < 20; index += 1) {
      const id = `b-${index}`
      variants.push(variant(id, { valueUsd: 10 }))
      variants.push(
        variant(id, {
          mutationId: RAINBOW_MUTATION,
          mutationSlug: 'rainbow',
          valueUsd: 30,
          sampleCount: 1,
        }),
      )
    }

    expect(measureMutationMultipliers(variants).has('rainbow')).toBe(false)
  })

  it('withholds a multiplier until enough pairs support it', () => {
    const variants: VariantEstimate[] = []

    for (let index = 0; index < 5; index += 1) {
      const id = `b-${index}`
      variants.push(variant(id, { valueUsd: 10 }))
      variants.push(
        variant(id, {
          mutationId: RAINBOW_MUTATION,
          mutationSlug: 'rainbow',
          valueUsd: 30,
        }),
      )
    }

    expect(measureMutationMultipliers(variants).has('rainbow')).toBe(false)
  })
})

describe('computeCorrections — rarity-aware minimum evidence', () => {
  it('suppresses a thin OG even with a cohort anchor (Spyder Elephant)', () => {
    // n=1 OG must NOT publish a cohort-anchored price — one untradeable listing
    // is not a market.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [
        ...peers.brainrots,
        brainrot('spyder', { rarity: 'OG' }),
      ],
      variants: [
        ...peers.variants,
        variant('spyder', {
          valueUsd: 323,
          sampleCount: 1,
          listingPrices: [323],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'spyder')!
    expect(c.isPublishable).toBe(false)
    expect(c.valueUsd).toBeNull()
  })

  it('publishes an OG once it has 5+ listings', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('og5', { rarity: 'OG' })],
      variants: [
        ...peers.variants,
        variant('og5', {
          valueUsd: 500,
          sampleCount: 6,
          listingPrices: [500, 500, 500, 500, 500, 500],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'og5')!
    expect(c.isPublishable).toBe(true)
  })

  it('never inverts the range when the floor lands above a collapsed high', () => {
    // The floor raises the headline above valueUsd. If the upstream high has
    // collapsed to the point value (the catalog view coalesces high -> estimate),
    // an unclamped high would sit BELOW the floor and invert the displayed range.
    // The Math.max clamp must keep lowUsd <= highUsd. Listings cluster tightly at
    // ~$5 while the blended value/high degenerated to $4.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('collapsed', { rarity: 'Rare' })],
      variants: [
        ...peers.variants,
        variant('collapsed', {
          valueUsd: 4,
          lowUsd: 4,
          highUsd: 4, // collapsed to the point value
          sampleCount: 6,
          sourceCount: 2,
          listingPrices: [5, 5, 5.1, 5.1, 5.2, 5.2],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'collapsed')!
    expect(c.reason).toBe('floor')
    expect(c.valueUsd).toBe(5)
    expect(c.lowUsd).toBe(5)
    expect(c.highUsd).not.toBeNull()
    expect(c.lowUsd!).toBeLessThanOrEqual(c.highUsd!)
    expect(c.highUsd).toBe(5) // clamped up to the floor
  })

  it('suppresses an expensive single-source OG (Headless Horseman)', () => {
    // n=5 OG passes the sample gate, but every listing is one marketplace
    // (source_count=1). A five-figure price with no cross-source confirmation is
    // the same unconfirmed market as a 1-listing item — suppress, don't publish.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('headless', { rarity: 'OG' })],
      variants: [
        ...peers.variants,
        variant('headless', {
          valueUsd: 8999.99,
          sampleCount: 5,
          sourceCount: 1,
          listingPrices: [8999.99, 8999.99, 9000, 9200, 9450],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'headless')!
    expect(c.isPublishable).toBe(false)
    expect(c.valueUsd).toBeNull()
    expect(c.reason).toBe('insufficient_evidence')
  })

  it('publishes the same expensive OG once a second source confirms it', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('headless2', { rarity: 'OG' })],
      variants: [
        ...peers.variants,
        variant('headless2', {
          valueUsd: 8999.99,
          sampleCount: 5,
          sourceCount: 2,
          listingPrices: [8999.99, 8999.99, 9000, 9200, 9450],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'headless2')!
    expect(c.isPublishable).toBe(true)
  })

  it('still publishes a cheap single-source OG (money threshold not met)', () => {
    // The cross-source rule only bites above the money threshold; a low-value
    // OG on one source keeps the ordinary sample-gate behaviour.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('cheapog', { rarity: 'OG' })],
      variants: [
        ...peers.variants,
        variant('cheapog', {
          valueUsd: 40,
          sampleCount: 6,
          sourceCount: 1,
          listingPrices: [40, 40, 40, 40, 40, 40],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'cheapog')!
    expect(c.isPublishable).toBe(true)
  })

  it('still publishes a non-high-value rarity at 3 listings', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('rare3', { rarity: 'Rare' })],
      variants: [
        ...peers.variants,
        variant('rare3', {
          valueUsd: 4,
          sampleCount: 3,
          listingPrices: [4, 4, 4],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'rare3')!
    expect(c.isPublishable).toBe(true)
  })
})

describe('computeCorrections — mutation ladder (point 6)', () => {
  // Low tier vs higher tier, with per-side sample counts — the sample count
  // decides which side of an inversion is treated as noise. Uses Epic rarity so
  // the OG/Secret publish gate doesn't interfere.
  function ladderCase(
    lowPrice: number,
    highPrice: number,
    lowSamples: number,
    highSamples: number,
  ) {
    const peers = peerGroup(6)
    const dense = (p: number, n: number) => Array.from({ length: n }, () => p)
    return computeCorrections({
      brainrots: [...peers.brainrots, brainrot('lad', { rarity: 'Epic' })],
      variants: [
        ...peers.variants,
        variant('lad', {
          mutationSlug: 'default',
          mutationId: 'm-default',
          valueUsd: lowPrice,
          sampleCount: lowSamples,
          incomeMultiplier: 1,
          listingPrices: dense(lowPrice, Math.max(lowSamples, 1)),
        }),
        variant('lad', {
          mutationSlug: 'gold',
          mutationId: 'm-gold',
          valueUsd: highPrice,
          sampleCount: highSamples,
          incomeMultiplier: 1.25,
          listingPrices: dense(highPrice, Math.max(highSamples, 1)),
        }),
      ],
    }).filter((c) => c.brainrotId === 'lad')
  }

  it('NEVER suppresses a well-sampled price, even out of ladder order', () => {
    // The Strawberry/Skibidi bug: an 11-sample high default must NOT be nuked by
    // a cheap higher-tier price.
    const out = ladderCase(224, 70, 11, 8)
    const def = out.find((c) => c.mutationId === 'm-default')!
    expect(def.isPublishable).toBe(true)
    expect(def.valueUsd).toBe(224)
  })

  it('leaves a correctly-ordered ladder alone', () => {
    const out = ladderCase(10, 12, 20, 20)
    expect(out.every((c) => c.isPublishable)).toBe(true)
  })

  it('tolerates mild inversion within the ratio', () => {
    const out = ladderCase(12, 10, 20, 20)
    expect(out.every((c) => c.isPublishable)).toBe(true)
  })
})

describe('computeCorrections — floor pricing', () => {
  it('replaces the median headline with the lowest supported price', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('item')],
      variants: [
        ...peers.variants,
        variant('item', {
          valueUsd: 2.29, // median blend
          highUsd: 2.79,
          sampleCount: 20,
          listingPrices: [0.99, 1.0, 1.0, 1.04, 1.05, 1.1, 1.4, 2.29],
        }),
      ],
    })

    const c = result.find((r) => r.brainrotId === 'item')!
    expect(c.reason).toBe('floor')
    expect(c.valueUsd).toBe(0.99) // cheapest supported, not the $2.29 median
    expect(c.lowUsd).toBe(0.99)
    expect(c.highUsd).toBe(2.79) // range headroom preserved
    expect(c.originalValueUsd).toBe(2.29)
  })

  it('ignores bait below the cluster when setting the floor', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('item')],
      variants: [
        ...peers.variants,
        variant('item', {
          valueUsd: 2.29,
          sampleCount: 20,
          // $0.10 bait must not become the floor.
          listingPrices: [0.1, 0.99, 1.0, 1.0, 1.04, 1.05],
        }),
      ],
    })

    const c = result.find((r) => r.brainrotId === 'item')!
    expect(c.valueUsd).toBe(0.99)
  })

  it('falls back to the median when no floor is supportable', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('item')],
      variants: [
        ...peers.variants,
        variant('item', {
          valueUsd: 15,
          sampleCount: 20,
          // scattered prices → no cluster → keep the median blend
          listingPrices: [1, 8, 40, 120],
        }),
      ],
    })

    const c = result.find((r) => r.brainrotId === 'item')!
    expect(c.reason).toBe('trusted')
    expect(c.valueUsd).toBe(15)
  })

  it('does not floor a thin item — it anchors or suppresses as before', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('thin', { rarity: 'Epic' })],
      variants: [
        ...peers.variants,
        // n=1 with a cheap listing: must NOT publish $9.98 as a floor.
        variant('thin', {
          valueUsd: 9.98,
          sampleCount: 1,
          listingPrices: [9.98],
        }),
      ],
    })

    const c = result.find((r) => r.brainrotId === 'thin')!
    expect(c.reason).not.toBe('floor')
    // cohort anchor ($10) wins over the lone $9.98 within fence → within-anchor
    expect(['thin_sample_within_anchor', 'thin_sample_anchored']).toContain(c.reason)
  })

  it('never floors a human-reviewed price', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('reviewed')],
      variants: [
        ...peers.variants,
        variant('reviewed', {
          valueUsd: 50,
          sampleCount: 20,
          isReviewed: true,
          listingPrices: [1.0, 1.0, 1.0, 1.05], // would floor to $1 if allowed
        }),
      ],
    })

    const c = result.find((r) => r.brainrotId === 'reviewed')!
    expect(c.reason).toBe('trusted')
    expect(c.valueUsd).toBe(50)
  })
})

describe('computeCorrections — reputable-seller pricing', () => {
  it('publishes the reputable Average as value and Cheapest alongside (Skibidi)', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('skibidi', { rarity: 'OG' })],
      variants: [
        ...peers.variants,
        variant('skibidi', {
          valueUsd: 190, // the OLD wrong floor — must be overridden
          sampleCount: 40,
          reputableListings: [
            { priceUsd: 217.99, reviews: 8096 },
            { priceUsd: 220, reviews: 27893 },
            { priceUsd: 224, reviews: 27893 },
            { priceUsd: 225, reviews: 20633 },
            { priceUsd: 225, reviews: 23256 },
            { priceUsd: 299, reviews: 5000 },
          ],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'skibidi')!
    expect(c.reason).toBe('reputable')
    expect(c.cheapestUsd).toBe(217.99)
    expect(c.averageUsd).toBe(224) // median of the 5 cheapest reputable
    expect(c.valueUsd).toBe(224) // headline = average
    expect(c.lowUsd).toBe(217.99) // low = cheapest
  })

  it('ignores sub-100-review fakes below the reputable market (Headless)', () => {
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('headless', { rarity: 'OG' })],
      variants: [
        ...peers.variants,
        variant('headless', {
          valueUsd: 369,
          sampleCount: 30,
          sourceCount: 2,
          reputableListings: [
            { priceUsd: 14.22, reviews: 0 }, // fake
            { priceUsd: 32.93, reviews: 3 }, // fake
            { priceUsd: 4000, reviews: 1255 },
            { priceUsd: 5489.99, reviews: 9394 },
            { priceUsd: 6600, reviews: 409 },
          ],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'headless')!
    expect(c.reason).toBe('reputable')
    expect(c.cheapestUsd).toBe(4000) // skipped the 0-review fakes
  })

  it('prices an unobtainable item that reputable sellers ACTIVELY trade', () => {
    // Bacuru and Egguru is unobtainable IN-GAME but has a thriving resale market
    // (many reputable sellers at $0.50). Active reputable trading = a real price,
    // so reputable pricing outranks unobtainable suppression.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [
        ...peers.brainrots,
        brainrot('traded', { rarity: 'Secret', obtainability: 'unobtainable' }),
      ],
      variants: [
        ...peers.variants,
        variant('traded', {
          valueUsd: 0.98,
          sampleCount: 47,
          reputableListings: [
            { priceUsd: 0.5, reviews: 5000 },
            { priceUsd: 0.5, reviews: 3000 },
            { priceUsd: 0.6, reviews: 1000 },
            { priceUsd: 0.99, reviews: 800 },
          ],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'traded')!
    expect(c.reason).toBe('reputable')
    expect(c.isPublishable).toBe(true)
    expect(c.cheapestUsd).toBe(0.5)
  })

  it('still suppresses an unobtainable item with NO reputable market', () => {
    // Tung Tung Tung Sahur was removed and truly dead: a single reputable listing
    // is one seller dumping a phantom price, not a market. REPUTABLE_MIN_LISTINGS
    // (=2) returns null, so it falls through to unobtainable suppression.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [
        ...peers.brainrots,
        brainrot('removed', { rarity: 'Secret', obtainability: 'unobtainable' }),
      ],
      variants: [
        ...peers.variants,
        variant('removed', {
          valueUsd: 9999,
          sampleCount: 1,
          // One lone reputable listing — not a market.
          reputableListings: [{ priceUsd: 9999, reviews: 10000 }],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'removed')!
    expect(c.isPublishable).toBe(false)
    expect(c.valueUsd).toBeNull()
    expect(c.reason).toBe('insufficient_evidence')
  })

  it('falls through to the floor when no reputable listings exist', () => {
    // A variant with only listingPrices (no reviews) uses the old floor path.
    const peers = peerGroup(6)
    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('norep', { rarity: 'Rare' })],
      variants: [
        ...peers.variants,
        variant('norep', {
          valueUsd: 5,
          sampleCount: 6,
          listingPrices: [5, 5, 5.1, 5.1, 5.2, 5.2],
        }),
      ],
    })
    const c = result.find((r) => r.brainrotId === 'norep')!
    expect(c.reason).not.toBe('reputable')
    expect(c.cheapestUsd).toBeNull()
  })
})

describe('computeCorrections — default mutation', () => {
  it('leaves a well-sampled price untouched even when it defies its cohort', () => {
    const peers = peerGroup(6)
    const odd = brainrot('odd')

    const result = computeCorrections({
      brainrots: [...peers.brainrots, odd],
      variants: [
        ...peers.variants,
        variant('odd', { valueUsd: 900, sampleCount: 7 }),
      ],
    })

    const correction = result.find((c) => c.brainrotId === 'odd')!
    expect(correction.reason).toBe('trusted')
    expect(correction.valueUsd).toBe(900)
  })

  it('anchors a thin price that is absurd for its class', () => {
    // Epic rarity: below the OG/Secret 5+ gate, so the thin-anchoring path
    // (not the rarity suppression) is exercised.
    const peers = peerGroup(6)

    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('thin', { rarity: 'Epic' })],
      variants: [
        ...peers.variants,
        variant('thin', { valueUsd: 0.5, sampleCount: 1 }),
      ],
    })

    const correction = result.find((c) => c.brainrotId === 'thin')!
    expect(correction.reason).toBe('thin_sample_anchored')
    expect(correction.valueUsd).toBe(10)
    expect(correction.isAnchored).toBe(true)
    expect(correction.originalValueUsd).toBe(0.5)
  })

  it('stretches the range to cover the original listing when anchoring', () => {
    const peers = peerGroup(6)

    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('thin', { rarity: 'Epic' })],
      variants: [
        ...peers.variants,
        variant('thin', { valueUsd: 500, sampleCount: 2 }),
      ],
    })

    const correction = result.find((c) => c.brainrotId === 'thin')!
    // We cannot rule out that the listing was right, so the range must say so.
    expect(correction.highUsd).toBe(500)
    expect(correction.valueUsd).toBe(10)
  })

  it('keeps a thin price that agrees with its cohort, at low confidence', () => {
    const peers = peerGroup(6)

    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('thin', { rarity: 'Epic' })],
      variants: [
        ...peers.variants,
        variant('thin', { valueUsd: 12, sampleCount: 1 }),
      ],
    })

    const correction = result.find((c) => c.brainrotId === 'thin')!
    expect(correction.reason).toBe('thin_sample_within_anchor')
    expect(correction.valueUsd).toBe(12)
    expect(correction.confidence).toBe('low')
  })

  it('suppresses a thin price with nothing to compare against', () => {
    const result = computeCorrections({
      brainrots: [brainrot('lonely', { rarity: 'Unique', ingameCost: null })],
      variants: [variant('lonely', { valueUsd: 2, sampleCount: 1 })],
    })

    const correction = result[0]
    expect(correction.reason).toBe('insufficient_evidence')
    expect(correction.isPublishable).toBe(false)
    expect(correction.valueUsd).toBeNull()
  })

  it('never overrides a human-reviewed price', () => {
    const peers = peerGroup(6)

    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('reviewed')],
      variants: [
        ...peers.variants,
        variant('reviewed', {
          valueUsd: 999,
          sampleCount: 1,
          isReviewed: true,
        }),
      ],
    })

    const correction = result.find((c) => c.brainrotId === 'reviewed')!
    expect(correction.reason).toBe('trusted')
    expect(correction.valueUsd).toBe(999)
    expect(correction.confidence).toBe('high')
  })

  it('falls back to cost peers of any rarity when the rarity is unpopulated', () => {
    // Mirrors Epic/Rare/Common in production: zero well-sampled members of
    // their own rarity, but plenty of items at a comparable in-game cost.
    const peers = peerGroup(6)
    const orphan = brainrot('orphan', { rarity: 'Rare' })

    const result = computeCorrections({
      brainrots: [...peers.brainrots, orphan],
      variants: [
        ...peers.variants,
        variant('orphan', { valueUsd: 0.3, sampleCount: 1 }),
      ],
    })

    const correction = result.find((c) => c.brainrotId === 'orphan')!
    expect(correction.isPublishable).toBe(true)
    expect(correction.valueUsd).toBe(10)
    expect(correction.cohortSize).toBe(6)
  })
})

describe('computeCorrections — mutation below default (premium floor)', () => {
  // Default with real evidence + a premium mutation whose scraped listings are
  // noise priced below the default. The Skibidi Radioactive shape.
  function premiumCase(defaultPrice: number, mutationScraped: number) {
    const peers = peerGroup(6)
    // Establish rainbow ≈ 3x default from 20 well-sampled pairs so the measured
    // multiplier exists.
    const pairs: VariantEstimate[] = []
    for (let i = 0; i < 20; i += 1) {
      const id = `pair-${i}`
      pairs.push(variant(id, { valueUsd: 10 }))
      pairs.push(
        variant(id, {
          mutationId: 'm-rainbow',
          mutationSlug: 'rainbow',
          valueUsd: 30,
        }),
      )
    }
    const pairBrainrots = Array.from({ length: 20 }, (_, i) =>
      brainrot(`pair-${i}`, { rarity: 'Epic' }),
    )

    return computeCorrections({
      brainrots: [...peers.brainrots, ...pairBrainrots, brainrot('tgt', { rarity: 'Epic' })],
      variants: [
        ...peers.variants,
        ...pairs,
        variant('tgt', {
          mutationSlug: 'default',
          mutationId: 'm-default',
          valueUsd: defaultPrice,
          sampleCount: 10,
          listingPrices: Array.from({ length: 10 }, () => defaultPrice),
        }),
        variant('tgt', {
          mutationSlug: 'rainbow',
          mutationId: 'm-rainbow-tgt',
          valueUsd: mutationScraped,
          sampleCount: 6,
          listingPrices: Array.from({ length: 6 }, () => mutationScraped),
        }),
      ],
    }).filter((c) => c.mutationId === 'm-rainbow-tgt')[0]
  }

  it('replaces a premium mutation priced below its default with the multiplier estimate', () => {
    // default $200, rainbow (3x measured) scraped at $70 — impossible.
    const c = premiumCase(200, 70)
    expect(c.reason).toBe('variant_anchored')
    // ~default($200) * measured 3x = ~$600, flagged low.
    expect(c.valueUsd).toBeGreaterThan(500)
    expect(c.confidence).toBe('low')
  })

  it('leaves a premium mutation priced sensibly above its default alone', () => {
    const c = premiumCase(200, 620)
    expect(c.reason).not.toBe('variant_anchored')
    expect(c.valueUsd).toBe(620)
  })

  // Gold Strawberry shipped $38.99 (a cluster of 4 mispriced Eldorado listings)
  // against a $676 default — a 1.25x mutation at 6% of its base. The below-default
  // rule must fire for ANY premium multiplier (>1), not only >=1.5x.
  function goldCase(
    defaultPrice: number,
    goldScraped: number,
    goldSamples = 6,
  ) {
    const peers = peerGroup(6)
    // Establish gold ≈ 1.25x default from 20 well-sampled pairs.
    const pairs: VariantEstimate[] = []
    for (let i = 0; i < 20; i += 1) {
      const id = `gp-${i}`
      pairs.push(variant(id, { valueUsd: 100 }))
      pairs.push(
        variant(id, {
          mutationId: 'm-gold',
          mutationSlug: 'gold',
          valueUsd: 125,
        }),
      )
    }
    const pairBrainrots = Array.from({ length: 20 }, (_, i) =>
      brainrot(`gp-${i}`, { rarity: 'Epic' }),
    )
    return computeCorrections({
      brainrots: [
        ...peers.brainrots,
        ...pairBrainrots,
        brainrot('gtgt', { rarity: 'OG' }),
      ],
      variants: [
        ...peers.variants,
        ...pairs,
        variant('gtgt', {
          mutationSlug: 'default',
          mutationId: 'm-default',
          valueUsd: defaultPrice,
          sampleCount: 10,
          listingPrices: Array.from({ length: 10 }, () => defaultPrice),
        }),
        variant('gtgt', {
          mutationSlug: 'gold',
          mutationId: 'm-gold-tgt',
          valueUsd: goldScraped,
          sampleCount: goldSamples,
          listingPrices: Array.from({ length: goldSamples }, () => goldScraped),
        }),
      ],
    }).filter((c) => c.mutationId === 'm-gold-tgt')[0]
  }

  it('replaces a well-sampled 1.25x Gold priced below its default (Gold Strawberry)', () => {
    // default $676, gold cluster scraped at $38.99 — impossible for a 1.25x item.
    const c = goldCase(676, 38.99)
    expect(c.reason).toBe('variant_anchored')
    // ~default($676) * 1.25 = ~$845, must be above the default, flagged low.
    expect(c.valueUsd!).toBeGreaterThan(676)
    expect(c.confidence).toBe('low')
  })

  it('replaces a THIN 1.25x Gold priced just below its default', () => {
    // The within-fence thin-sample path: $3 gold vs $4 default (Tukanno shape).
    const c = goldCase(4, 3, 2)
    expect(c.reason).toBe('variant_anchored')
    expect(c.valueUsd!).toBeGreaterThanOrEqual(4)
    expect(c.confidence).toBe('low')
  })

  it('leaves a 1.25x Gold priced correctly above its default alone', () => {
    const c = goldCase(676, 850)
    expect(c.reason).not.toBe('variant_anchored')
    expect(c.valueUsd).toBe(850)
  })
})

describe('computeCorrections — mutation variants', () => {
  function withRainbow(rainbowValue: number, sampleCount: number) {
    const variants: VariantEstimate[] = []
    const brainrots: BrainrotMeta[] = []

    // Establish rainbow ≈ 3x default from 20 well-sampled pairs.
    for (let index = 0; index < 20; index += 1) {
      const id = `b-${index}`
      brainrots.push(brainrot(id))
      variants.push(variant(id, { valueUsd: 10 }))
      variants.push(
        variant(id, {
          mutationId: RAINBOW_MUTATION,
          mutationSlug: 'rainbow',
          valueUsd: 30,
        }),
      )
    }

    brainrots.push(brainrot('target'))
    variants.push(variant('target', { valueUsd: 10 }))
    variants.push(
      variant('target', {
        mutationId: RAINBOW_MUTATION,
        mutationSlug: 'rainbow',
        valueUsd: rainbowValue,
        sampleCount,
      }),
    )

    return computeCorrections({ brainrots, variants }).find(
      (c) => c.brainrotId === 'target' && c.mutationId === RAINBOW_MUTATION,
    )!
  }

  it('anchors a thin variant to its corrected default times the measured multiplier', () => {
    const correction = withRainbow(1, 1)
    expect(correction.reason).toBe('variant_anchored')
    expect(correction.valueUsd).toBe(30)
  })

  it('leaves a well-sampled variant alone when priced sensibly', () => {
    // Rainbow at $40 vs a $10 default is a normal premium — untouched.
    const correction = withRainbow(40, MIN_TRUSTED_SAMPLES)
    expect(correction.reason).toBe('trusted')
    expect(correction.valueUsd).toBe(40)
  })

  it('overrides a well-sampled variant priced below its default', () => {
    // Rainbow (10x tier) at $1 vs a $10 default is impossible — the premium
    // floor rule replaces it with the multiplier estimate, low confidence.
    const correction = withRainbow(1, MIN_TRUSTED_SAMPLES)
    expect(correction.reason).toBe('variant_anchored')
    expect(correction.valueUsd).toBeGreaterThan(10)
    expect(correction.confidence).toBe('low')
  })

  it('keeps a thin variant that sits inside the fence', () => {
    const correction = withRainbow(30 * (ANCHOR_FENCE_RATIO - 1), 1)
    expect(correction.reason).toBe('thin_sample_within_anchor')
  })
})
