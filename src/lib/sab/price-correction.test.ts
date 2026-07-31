import { describe, expect, it } from 'vitest'

import {
  ANCHOR_FENCE_RATIO,
  MIN_TRUSTED_SAMPLES,
  computeCorrections,
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

    expect(measureMutationMultipliers(variants).get('rainbow')).toBe(3)
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
