import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { ValueBuyPanel } from './ValueBuyPanel'

type Cta = Parameters<typeof ValueBuyPanel>[0]['cta']
const inStock: Cta = {
  state: 'in_stock',
  label: 'Buy From $249',
  subline: null,
  href: '/adopt-me/pets/item/bat-dragon/fr',
  onClick: () => {},
  priceUsd: 249,
  count: 1,
}
const none: Cta = { state: 'none', label: 'Browse Similar Items', subline: null, href: '/adopt-me/pets/item/bat-dragon', onClick: () => {}, priceUsd: null, count: 0 }
const sell = { href: '/adopt-me/sell?src=am-item-page' }
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('value hero buy panel', () => {
  it('leads with our price, then the market reference and the saving, then Buy, trust and a quiet sell line', () => {
    const t = text(renderToStaticMarkup(createElement(ValueBuyPanel, { cta: inStock, itemName: 'Bat Dragon', marketUsd: 290, cheapestUsd: 283, sell })))
    const order = ['On DropMarket', '$249', 'Market Price $290', '$41 Below Market', 'Buy Now', 'SafeDrop Protection', 'Have One? Sell Yours']
    let at = -1
    for (const part of order) {
      const i = t.indexOf(part)
      expect(i, part).toBeGreaterThan(at)
      at = i
    }
  })

  it('heads with the typical market price when we have none, and asks for the first listing', () => {
    const t = text(renderToStaticMarkup(createElement(ValueBuyPanel, { cta: none, itemName: 'Bat Dragon', marketUsd: 290, cheapestUsd: 283, sell })))
    expect(t).toContain('Market Price $290')
    expect(t).toContain('Browse Similar Items')
    expect(t).toContain('Have One? Be the First to List It')
    expect(t).not.toContain('SafeDrop')
    expect(t).not.toContain('$283')
  })

  it('keeps the other-listings button short enough for the column; the price goes in the line under it', () => {
    const other: Cta = { ...inStock, state: 'other_variants', label: 'See 4 Other Listings From $289.99', subline: 'Fly Ride not listed right now', count: 4, priceUsd: 289.99 }
    const t = text(renderToStaticMarkup(createElement(ValueBuyPanel, { cta: other, itemName: 'Bat Dragon', marketUsd: 290, cheapestUsd: 283, sell })))
    expect(t).toContain('See 4 Other Listings')
    expect(t).not.toContain('Listings From')
    expect(t).toContain('Fly Ride not listed right now. Others from $289.99.')
  })

  it('shows the fallback headline when there is no dollar price', () => {
    const t = text(
      renderToStaticMarkup(
        createElement(ValueBuyPanel, { cta: none, itemName: 'Owl', marketUsd: null, cheapestUsd: null, fallback: { label: 'Trade Value', value: '1,450 pts' } }),
      ),
    )
    expect(t).toContain('Trade Value 1,450 pts')
  })
})
