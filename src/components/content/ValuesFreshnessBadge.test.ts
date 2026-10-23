import { describe, it, expect } from 'vitest'
import { badgeParts, badgeText } from './ValuesFreshnessBadge'

const text = (listingCount: number, sourceCount: number) =>
  badgeText({ lastChangedAt: '2026-10-07T08:43:00Z', listingCount, sourceCount })

describe('FreshnessBadge text', () => {
  // Owner, 2026-10-21: "Prices Updated, Verified Daily, Offers Tracked" instead of
  // "from N listings across 1 marketplace".
  it('keeps every space (a dropped one caused a hydration mismatch on /murder-mystery-2/values)', () => {
    expect(text(10132, 1)).toBe('Prices Updated 08:43 UTC · Verified Daily · 10,132 Offers Tracked')
  })
  it('singular offer, and the marketplace count is no longer shown', () => {
    expect(text(1, 2)).toBe('Prices Updated 08:43 UTC · Verified Daily · 1 Offer Tracked')
  })
  it('splits into parts for the divided layout', () => {
    expect(badgeParts({ lastChangedAt: '2026-10-07T08:43:00Z', listingCount: 10132, sourceCount: 1 })).toEqual([
      'Prices Updated 08:43 UTC',
      'Verified Daily',
      '10,132 Offers Tracked',
    ])
  })
})

describe('badgeText updatedAt (item heroes)', () => {
  it('"Updated Oct 10, 10:18 UTC", built by hand so server and iOS Safari agree (Safari printed "Oct 10 at 10:18")', () => {
    expect(badgeText({ updatedAt: '2026-10-10T10:18:00Z' } as any)).toBe('Updated Oct 10, 10:18 UTC')
    expect(badgeText({ updatedAt: '2026-01-02T03:04:00Z' } as any)).toBe('Updated Jan 2, 03:04 UTC')
  })
})
