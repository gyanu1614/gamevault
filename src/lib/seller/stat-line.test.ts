import { describe, expect, it } from 'vitest'
import { sellerPills, sellerStatLine, sellerStatText } from './stat-line'

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

describe('seller pills (checkout item card, owner 2026-10-27)', () => {
  const labels = (s: Parameters<typeof sellerPills>[0]) => sellerPills(s).map((p) => p.label)

  it('reviews → positive %, review count, then Verified Seller', () => {
    expect(labels({ ratingPercent: 99.6, reviews: 84237, sales: 5, verified: true })).toEqual([
      '99.6% Positive',
      '84,237 Reviews',
      'Verified Seller',
    ])
    expect(labels({ ratingPercent: 100, reviews: 1, sales: 1, verified: true })).toEqual(['100% Positive', '1 Review', 'Verified Seller'])
  })

  it('sales but no reviews yet → sold count instead of a rating', () => {
    expect(labels({ ratingPercent: null, reviews: 0, sales: 34, verified: true })).toEqual(['34 Sold', 'Verified Seller'])
  })

  it('unverified → member since the account year, never "Verified"', () => {
    expect(labels({ ratingPercent: null, reviews: 0, sales: 34, verified: false, memberSince: '2025-03-01T00:00:00Z' })).toEqual([
      '34 Sold',
      'Member Since 2025',
    ])
    expect(labels({ ratingPercent: null, reviews: 0, sales: 0, verified: false, memberSince: '2026-10-01T00:00:00Z' })).toEqual([
      'New Seller',
      'Member Since 2026',
    ])
    expect(labels({ ratingPercent: null, reviews: 0, sales: 0, verified: false, memberSince: 'not a date' })).toEqual(['New Seller'])
  })

  it('verified with no sales → just Verified Seller', () => {
    expect(labels({ ratingPercent: null, reviews: 0, sales: 0, verified: true })).toEqual(['Verified Seller'])
  })
})
