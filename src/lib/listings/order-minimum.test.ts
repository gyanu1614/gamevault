import { describe, expect, it } from 'vitest'
import { orderMinimum } from './order-minimum'

describe('orderMinimum', () => {
  it('is 1 for a bundle, even when an old row stores 100', () => {
    expect(orderMinimum({ bundle_id: 'b800', min_quantity: 100 })).toBe(1)
  })

  it("uses the listing's minimum otherwise", () => {
    expect(orderMinimum({ bundle_id: null, min_quantity: 100 })).toBe(100)
    expect(orderMinimum({ min_quantity: 3.7 })).toBe(3)
  })

  it('never goes below 1', () => {
    expect(orderMinimum({ min_quantity: 0 })).toBe(1)
    expect(orderMinimum({ min_quantity: null })).toBe(1)
    expect(orderMinimum({})).toBe(1)
  })
})
