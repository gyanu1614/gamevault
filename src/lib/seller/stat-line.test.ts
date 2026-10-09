import { describe, expect, it } from 'vitest'
import { sellerStatLine, sellerStatText } from './stat-line'

describe('seller stat line', () => {
  it('no sales, no reviews, unverified (open signup) → "No Sales Yet" (the grey badge carries "New Seller")', () => {
    expect(sellerStatLine({ ratingPercent: null, reviews: 0, sales: 0, verified: false })).toEqual({ kind: 'new' })
    expect(sellerStatText({ ratingPercent: null, reviews: 0, sales: 0, verified: false })).toBe('No Sales Yet')
  })
  it('no sales and no reviews → "Verified Seller" (verified or unknown)', () => {
    expect(sellerStatText({ ratingPercent: null, reviews: 0, sales: 0, tier: 'gold' })).toBe('Verified Seller')
    expect(sellerStatText({ ratingPercent: null, reviews: null, sales: undefined })).toBe('Verified Seller')
  })

  it('sales, no reviews yet → sold + tier, no rating', () => {
    expect(sellerStatText({ ratingPercent: null, reviews: 0, sales: 34, tier: 'gold' })).toBe('34 Sold · Gold')
  })

  it('full line: positive %, reviews, sold, tier', () => {
    expect(sellerStatText({ ratingPercent: 100, reviews: 12, sales: 34, tier: 'gold' })).toBe(
      '100% Positive · 12 Reviews · 34 Sold · Gold',
    )
    expect(sellerStatText({ ratingPercent: 99.5, reviews: 1, sales: 1, tier: null })).toBe(
      '99.5% Positive · 1 Review · 1 Sold · Bronze',
    )
  })

  it('a rating without reviews is ignored (no made-up score)', () => {
    const line = sellerStatLine({ ratingPercent: 100, reviews: 0, sales: 3, tier: 'silver' })
    expect(line.kind === 'stats' && line.rating).toBeNull()
  })
})
