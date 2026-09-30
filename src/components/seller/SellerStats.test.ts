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

  it('compact: 👍 % · sold, tier as an icon (no review count, no tier word; owner 2026-09-30)', () => {
    const p = { ratingPercent: 100, reviews: 12, sales: 34, tier: 'gold' }
    const t = text(p)
    expect(t).toBe('100% · 34 Sold')
    expect(t).not.toContain('(12)')
    const html = renderToStaticMarkup(h(SellerStats as any, p))
    expect(html).toContain('title="Gold Seller"')
    expect(html).toContain('linearGradient')
  })

  it('compact hideTier: no tier icon (the card shows it by the name)', () => {
    const html = renderToStaticMarkup(h(SellerStats as any, { ratingPercent: 100, reviews: 1, sales: 1, tier: 'legendary', hideTier: true }))
    expect(html).not.toContain('Legendary Seller')
    expect(html).not.toContain('linearGradient')
  })

  it('full: % Positive · reviews · sold · tier', () => {
    expect(text({ variant: 'full', ratingPercent: 100, reviews: 12, sales: 34, tier: 'gold' })).toBe(
      '100% Positive · 12 Reviews · 34 Sold · Gold',
    )
  })

  it('sales but no reviews: sold + tier icon only', () => {
    expect(text({ ratingPercent: null, reviews: 0, sales: 3, tier: 'silver' })).toBe('3 Sold')
  })
})
