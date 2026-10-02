import { describe, it, expect } from 'vitest'

import {
  ADMIN_TITLE_TEMPLATE,
  BRAND,
  TITLE_TEMPLATE,
  brandMarkCount,
  resolveTitle,
  stripBrand,
} from '@/lib/seo/title'

describe('stripBrand: for a branded string reused on purpose (e.g. an OG title)', () => {
  it.each([
    ['Adopt Me Value List | DropMarket', 'Adopt Me Value List'],
    ['Adopt Me Value List — DropMarket', 'Adopt Me Value List'],
    ['Adopt Me Value List - DropMarket', 'Adopt Me Value List'],
    ['Adopt Me Value List | DropMarket | DropMarket', 'Adopt Me Value List'],
    ['  Support |  dropmarket  ', 'Support'],
  ])('%s -> %s', (input, expected) => {
    expect(stripBrand(input)).toBe(expected)
  })

  it('leaves a brand that is part of the copy alone', () => {
    expect(stripBrand('How DropMarket Values Steal a Brainrot Prices')).toBe(
      'How DropMarket Values Steal a Brainrot Prices',
    )
    expect(stripBrand('DropMarket | Buy & Sell Game Items')).toBe('DropMarket | Buy & Sell Game Items')
  })

  it('does not return an empty title', () => {
    expect(stripBrand('| DropMarket')).toBe('DropMarket')
    expect(stripBrand('DropMarket')).toBe('DropMarket')
  })
})

describe('resolveTitle: what the browser tab shows', () => {
  it('applies the layout template to a plain string', () => {
    expect(resolveTitle('Support', TITLE_TEMPLATE)).toBe(`Support | ${BRAND}`)
  })

  it('skips the template for { absolute }', () => {
    expect(resolveTitle({ absolute: 'DropMarket | Buy & Sell' }, TITLE_TEMPLATE)).toBe('DropMarket | Buy & Sell')
  })

  it('uses the admin template under the admin layout', () => {
    expect(resolveTitle('Orders', ADMIN_TITLE_TEMPLATE)).toBe('Orders | DropMarket Admin')
  })

  it('returns null when a route sets no title (the layout default applies)', () => {
    expect(resolveTitle(undefined, TITLE_TEMPLATE)).toBeNull()
  })
})

describe('brandMarkCount: brand used as a mark (leading "DropMarket |" or trailing "| DropMarket")', () => {
  it('counts the doubled suffix as two', () => {
    expect(brandMarkCount('Adopt Me Values | DropMarket | DropMarket')).toBe(2)
  })
  it('counts a leading brand plus the template suffix as two', () => {
    expect(brandMarkCount('DropMarket | Buy & Sell Game Items | DropMarket')).toBe(2)
  })
  it('counts one suffix as one', () => {
    expect(brandMarkCount('Support | DropMarket')).toBe(1)
  })
  it('ignores the brand inside the copy', () => {
    expect(brandMarkCount('How DropMarket Values Adopt Me Pets — Methodology | DropMarket')).toBe(1)
  })
})
