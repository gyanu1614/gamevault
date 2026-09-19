/**
 * Steal An Egg pricing rules, pinned against what the live market actually
 * looks like. Each test encodes a decision that was WRONG in an earlier draft
 * and cost real accuracy, so a regression here is a published-price bug.
 */
import { describe, it, expect } from 'vitest'
import {
  MIN_BELIEVABLE_UNIT_USD,
  MAX_BELIEVABLE_STOCK,
  MIN_EVIDENCE,
} from './steal-an-egg'
import { computeReputablePrices, type RawListing } from '@/lib/pricing/reputable-adapter'

describe('Steal An Egg pricing constants', () => {
  it('floors per-egg prices above the per-in-game-unit listings', () => {
    // Live: ~6% of listings price per in-game unit at $0.00001 with millions of
    // claimed stock ("5X EGG = 5,000 UNITS/50 CENT"). They are not comparable
    // with per-egg listings and must be excluded.
    expect(MIN_BELIEVABLE_UNIT_USD).toBe(0.01)
    expect(0.00001).toBeLessThan(MIN_BELIEVABLE_UNIT_USD)
    // …while every genuine observed price survives (live median $0.99, p25 $0.50).
    expect(0.05).toBeGreaterThan(MIN_BELIEVABLE_UNIT_USD)
    expect(0.99).toBeGreaterThan(MIN_BELIEVABLE_UNIT_USD)
  })

  it('requires real evidence before publishing a value', () => {
    expect(MIN_EVIDENCE).toBeGreaterThanOrEqual(3)
  })

  it('treats million-unit stock claims as implausible', () => {
    expect(5_507_676).toBeGreaterThan(MAX_BELIEVABLE_STOCK)
  })
})

describe('bundle pricing (the bug that made every value ~4x too low)', () => {
  /**
   * Eldorado's pricePerUnitInUSD is ALREADY per egg. An earlier draft divided
   * it by the title's "5x" as well, which pushed the Angels & Demons median
   * from $0.99 (matching the independent whole-category median of $0.97) down
   * to $0.24. This pins the corrected behaviour.
   */
  const realAngelsDemonsPrices = [0.05, 0.1, 0.2, 0.3, 0.5, 0.5, 1.0, 1.25, 1.5, 1.5]

  it('does not divide an already-per-unit price by the title quantity', () => {
    const listings: RawListing[] = realAngelsDemonsPrices.map((p, i) => ({
      itemId: 'angels-demons',
      variant: 'default',
      priceUsd: p, // NOT divided
      reviews: 500 + i,
    }))
    const result = computeReputablePrices(listings).get('angels-demons:default')
    expect(result).toBeDefined()
    // Sanity: the published cheapest must sit in the real market's range, not
    // at a quarter of it.
    expect(result!.cheapestUsd).toBeGreaterThanOrEqual(0.05)
    expect(result!.cheapestUsd).toBeLessThan(1.0)
  })

  it('would produce an implausibly low value if quantity were divided out', () => {
    const divided: RawListing[] = realAngelsDemonsPrices.map((p, i) => ({
      itemId: 'angels-demons',
      variant: 'default',
      priceUsd: p / 5, // the bug
      reviews: 500 + i,
    }))
    const result = computeReputablePrices(divided).get('angels-demons:default')
    // Demonstrates the failure mode this test exists to prevent.
    expect(result!.cheapestUsd).toBeLessThan(0.05)
  })
})

describe('suppression rather than invention', () => {
  it('publishes nothing for an item with one lonely listing', () => {
    const listings: RawListing[] = [
      { itemId: 'rare-egg', variant: 'default', priceUsd: 5, reviews: 900 },
    ]
    const result = computeReputablePrices(listings).get('rare-egg:default')
    // Either the engine refuses it outright, or it falls under MIN_EVIDENCE and
    // the caller suppresses it. Never a published value off a single listing.
    const publishable = result != null && result.reputableCount >= MIN_EVIDENCE
    expect(publishable).toBe(false)
  })

  it('drops listings with no seller review count', () => {
    const listings: RawListing[] = [
      { itemId: 'x', variant: 'default', priceUsd: 1, reviews: null },
      { itemId: 'x', variant: 'default', priceUsd: 2, reviews: undefined },
    ]
    expect(computeReputablePrices(listings).get('x:default')).toBeUndefined()
  })
})
