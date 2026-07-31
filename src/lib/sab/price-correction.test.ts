import { describe, expect, it } from 'vitest'

import {
  ANCHOR_FENCE_RATIO,
  MIN_TRUSTED_SAMPLES,
  computeCorrections,
  lowestSupportedPrice,
  measureMutationMultipliers,
  median,
  quantile,
  type BrainrotMeta,
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

  it('ignores two scattered baits below the cluster', () => {
    const real = [0.99, 1.0, 1.0, 1.04, 1.05, 1.1]
    expect(lowestSupportedPrice([0.1, 0.2, ...real])).toBe(0.99)
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

  it('drops non-positive and non-finite prices before clustering', () => {
    const prices = [0, -1, Number.NaN, 1.0, 1.0, 1.05]
    expect(lowestSupportedPrice(prices)).toBe(1.0)
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
      brainrots: [...peers.brainrots, brainrot('thin')],
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
    const peers = peerGroup(6)

    const result = computeCorrections({
      brainrots: [...peers.brainrots, brainrot('thin')],
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
      brainrots: [...peers.brainrots, brainrot('thin')],
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
      brainrots: [...peers.brainrots, brainrot('thin')],
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

  it('leaves a well-sampled variant alone', () => {
    const correction = withRainbow(1, MIN_TRUSTED_SAMPLES)
    expect(correction.reason).toBe('trusted')
    expect(correction.valueUsd).toBe(1)
  })

  it('keeps a thin variant that sits inside the fence', () => {
    const correction = withRainbow(30 * (ANCHOR_FENCE_RATIO - 1), 1)
    expect(correction.reason).toBe('thin_sample_within_anchor')
  })
})
