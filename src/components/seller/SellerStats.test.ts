/** SellerStats renders the shared seller rule (src/lib/seller/stat-line.ts). */
import { describe, expect, it } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as any).React = React
import { SellerStats } from './SellerStats'

const text = (p: Record<string, unknown>) =>
  renderToStaticMarkup(h(SellerStats as any, p)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('SellerStats', () => {
  it('no sales → "Verified Seller" (never "New")', () => {
    const t = text({ ratingPercent: null, reviews: 0, sales: 0, tier: 'bronze' })
    expect(t).toBe('Verified Seller')
    expect(t).not.toMatch(/new/i)
  })

  it('compact: 👍 % (reviews) · sold · tier', () => {
    expect(text({ ratingPercent: 100, reviews: 12, sales: 34, tier: 'gold' })).toBe('100% (12) · 34 Sold · Gold')
  })

  it('full: % Positive · reviews · sold · tier', () => {
    expect(text({ variant: 'full', ratingPercent: 100, reviews: 12, sales: 34, tier: 'gold' })).toBe(
      '100% Positive · 12 Reviews · 34 Sold · Gold',
    )
  })

  it('sales but no reviews: sold + tier only', () => {
    expect(text({ ratingPercent: null, reviews: 0, sales: 3, tier: 'silver' })).toBe('3 Sold · Silver')
  })
})
