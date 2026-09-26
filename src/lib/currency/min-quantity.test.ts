import { describe, it, expect } from 'vitest'
import { resolveMinQuantity } from '@/lib/currency/min-quantity'

describe('resolveMinQuantity', () => {
  it("keeps the seller's minimum when it is at or above the admin floor", () => {
    // Blade Ball: floor 1 K, seller lowers 100 K → 1 K. Must NOT snap back to 100.
    expect(resolveMinQuantity({ requested: 1, adminFloor: 1, stock: 500 })).toBe(1)
    expect(resolveMinQuantity({ requested: 25, adminFloor: 10, stock: 500 })).toBe(25)
  })
  it('raises a minimum below the admin floor to the floor', () => {
    expect(resolveMinQuantity({ requested: 5, adminFloor: 100, stock: 1000 })).toBe(100)
  })
  it('treats a missing or zero floor as 1', () => {
    expect(resolveMinQuantity({ requested: 0, adminFloor: null, stock: 10 })).toBe(1)
    expect(resolveMinQuantity({ requested: 3, adminFloor: 0, stock: 10 })).toBe(3)
  })
  it('caps the minimum at stock, never below the floor', () => {
    expect(resolveMinQuantity({ requested: 800, adminFloor: 1, stock: 500 })).toBe(500)
    expect(resolveMinQuantity({ requested: 800, adminFloor: 600, stock: 500 })).toBe(600)
  })
  it('does not cap when stock is unknown or unlimited', () => {
    expect(resolveMinQuantity({ requested: 800, adminFloor: 1, stock: 0 })).toBe(800)
    expect(resolveMinQuantity({ requested: 800, adminFloor: 1, stock: 5, unlimited: true })).toBe(800)
  })
  it('is always 1 for a bundle listing (sold one bundle at a time)', () => {
    expect(resolveMinQuantity({ requested: 50, adminFloor: 100, stock: 10, isBundle: true })).toBe(1)
  })
  it('floors fractions and ignores non-finite input', () => {
    expect(resolveMinQuantity({ requested: 2.7, adminFloor: 1, stock: 10 })).toBe(2)
    expect(resolveMinQuantity({ requested: Number.NaN, adminFloor: 4, stock: 10 })).toBe(4)
  })
})
