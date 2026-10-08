import { describe, it, expect } from 'vitest'
import { badgeText } from './ValuesFreshnessBadge'

const text = (listingCount: number, sourceCount: number) =>
  badgeText({ lastChangedAt: '2026-10-07T08:43:00Z', listingCount, sourceCount })

describe('FreshnessBadge text', () => {
  it('keeps every space (a dropped one caused a hydration mismatch on /murder-mystery-2/values)', () => {
    expect(text(10132, 1)).toBe('Market price · updated 08:43 UTC · from 10,132 listings across 1 marketplace')
  })
  it('singular listing and plural marketplaces', () => {
    expect(text(1, 2)).toBe('Market price · updated 08:43 UTC · from 1 listing across 2 marketplaces')
  })
})
