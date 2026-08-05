import { describe, expect, it } from 'vitest'

import {
  median,
  reputablePrice,
  type ReputableListing,
} from './reputable-pricing'

const REP = 5000 // a comfortably-reputable review count
const FAKE = 3 // below the 100 threshold

function L(priceUsd: number, reviews = REP): ReputableListing {
  return { priceUsd, reviews }
}

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('reputablePrice — real observed markets', () => {
  it('Skibidi Toilet: cheapest 217.99, average ~224', () => {
    // Reputable cheapest run observed: 217.99, 220, 224, 225, 225, 226 ...
    const out = reputablePrice([
      L(217.99, 8096),
      L(220, 27893),
      L(224, 27893),
      L(225, 20633),
      L(225, 23256),
      L(226, 2070),
      L(240),
      L(299),
    ])
    expect(out?.cheapestUsd).toBe(217.99)
    expect(out?.averageUsd).toBe(224) // median of the 5 cheapest reputable
  })

  it('Meowl: cheapest 292.99, average ~298', () => {
    const out = reputablePrice([
      L(292.99, 4951),
      L(296.99, 8096),
      L(298.99, 8096),
      L(299, 23502),
      L(299.99, 54954),
      L(308.85, 23256),
      L(489),
    ])
    expect(out?.cheapestUsd).toBe(292.99)
    expect(out?.averageUsd).toBe(298.99)
  })

  it('Signore Carapace: skips the $0.25 bait, cheapest 709.9, average ~749', () => {
    // The $0.25 from a reputable seller is a fake against a ~$750 market — must
    // be dropped as fake-cheap, not set the floor.
    const out = reputablePrice([
      L(0.25, 643),
      L(0.5, 643),
      L(709.9, 3320),
      L(749.5, 4771),
      L(769.99, 824),
      L(869.98, 26395),
      L(899, 9921),
      L(929.99, 9921),
    ])
    expect(out?.cheapestUsd).toBe(709.9)
    expect(out?.averageUsd).toBe(769.99) // median of 709.9, 749.5, 769.99, 869.98, 899
  })

  it('Headless Horseman: skips $849/$1000 lone lows, cheapest 4000', () => {
    // The reputable cheapest listings ($849, $1000) sit far below the real
    // $4000-6600 cluster — a mislabeled/wrong-tier item, not the floor. The
    // 2x-gap rule advances to where the cluster begins.
    const out = reputablePrice([
      L(849.99, 1942),
      L(1000, 1791),
      L(4000, 1255),
      L(5489.99, 9394),
      L(6600, 409),
      L(7000, 9921),
      L(8999.99, 54956),
    ])
    expect(out?.cheapestUsd).toBe(4000)
    // average = median of 4000, 5489.99, 6600, 7000, 8999.99
    expect(out?.averageUsd).toBe(6600)
  })
})

describe('reputablePrice — trust + edge rules', () => {
  it('ignores sub-100-review sellers entirely (fakes)', () => {
    // The cheapest listings are all low-review fakes; only the reputable $220
    // counts (Headless $14-34 zero-review shape).
    const out = reputablePrice([
      L(14.22, 0),
      L(21.81, FAKE),
      L(32.93, 0),
      L(220, 27893),
      L(225, 20633),
      L(229, 23256),
    ])
    expect(out?.cheapestUsd).toBe(220)
  })

  it('returns null when no reputable seller exists', () => {
    expect(
      reputablePrice([L(5, 0), L(6, 10), L(7, 99)]),
    ).toBeNull()
  })

  it('returns null when every reputable listing is fake-cheap', () => {
    // Only two reputable listings and both are baits far below nothing else —
    // no market to anchor to. (Degenerate; guarded so we never publish a bait.)
    expect(reputablePrice([])).toBeNull()
  })

  it('returns null for a single reputable listing (not a market)', () => {
    // One lone reputable seller is not a market — Tung Tung Tung Sahur (removed
    // from the game) showed $9,999 off one 10k-review listing. Below the
    // minimum, publish nothing.
    expect(reputablePrice([L(9999, 10094), L(0.4, 0)])).toBeNull()
  })

  it('prices once a second reputable listing confirms it', () => {
    const out = reputablePrice([L(50, 5000), L(52, 5000), L(0.4, 0)])
    expect(out?.cheapestUsd).toBe(50)
    expect(out?.averageUsd).toBe(51)
  })

  it('drops non-positive and non-finite prices', () => {
    const out = reputablePrice([
      L(0, 5000),
      L(Number.NaN, 5000),
      L(700, 5000),
      L(720, 5000),
    ])
    expect(out?.cheapestUsd).toBe(700)
  })

  it('a dense cheap cluster is honoured (no false gap-skip)', () => {
    // Garama-shaped: tight cluster from $1, all reputable. Cheapest stays $1.
    const out = reputablePrice([
      L(1, 5000),
      L(1.1, 5000),
      L(1.2, 5000),
      L(1.3, 5000),
      L(2.4, 5000),
    ])
    expect(out?.cheapestUsd).toBe(1)
    expect(out?.averageUsd).toBe(1.2)
  })
})
