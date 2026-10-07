import { describe, it, expect } from 'vitest'

import {
  ADMIN_TITLE_TEMPLATE,
  BRAND,
  TITLE_TEMPLATE,
  brandMarkCount,
  pageTitle,
  resolveTitle,
  socialTitle,
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

describe('pageTitle: for titles whose text comes from data (value pages, category page)', () => {
  it('leaves a bare title to the layout template', () => {
    expect(pageTitle('Bat Dragon Value')).toBe('Bat Dragon Value')
  })

  it('does not let the template add the brand twice', () => {
    expect(pageTitle('Adopt Me Pets | DropMarket')).toEqual({ absolute: 'Adopt Me Pets | DropMarket' })
    expect(pageTitle('Adopt Me Pets — DropMarket')).toEqual({ absolute: 'Adopt Me Pets — DropMarket' })
    expect(pageTitle('Adopt Me Pets - dropmarket ')).toEqual({ absolute: 'Adopt Me Pets - dropmarket' })
  })

  it('keeps a mid-title brand mention as a normal title', () => {
    expect(pageTitle('DropMarket Fees Explained')).toBe('DropMarket Fees Explained')
  })

  it('both ways end in exactly one brand once the template has run', () => {
    for (const t of ['Adopt Me Pets | DropMarket', 'Adopt Me Pets', 'Bat Dragon — DropMarket']) {
      expect(brandMarkCount(resolveTitle(pageTitle(t), TITLE_TEMPLATE)!)).toBe(1)
      expect(brandMarkCount(resolveTitle(stripBrand(t), TITLE_TEMPLATE)!)).toBe(1)
    }
    // Same text for the common "|" separator and for a bare title.
    for (const t of ['Adopt Me Pets | DropMarket', 'Adopt Me Pets']) {
      expect(resolveTitle(pageTitle(t), TITLE_TEMPLATE)).toBe(resolveTitle(stripBrand(t), TITLE_TEMPLATE))
    }
  })
})

describe('socialTitle', () => {
  it('brands a bare title once', () => {
    expect(socialTitle('Bat Dragon Value')).toBe('Bat Dragon Value | DropMarket')
    expect(socialTitle('Bat Dragon Value | DropMarket')).toBe('Bat Dragon Value | DropMarket')
  })
})

import { gameHubTitle } from './templates'

describe('gameHubTitle', () => {
  it('leads with "<Game> Marketplace" and the buyer words, ≤ 47 characters', () => {
    expect(gameHubTitle('Roblox', ['Robux', 'Items', 'Accounts', 'Gift Cards'])).toBe('Roblox Marketplace: Buy Robux, Items & Accounts')
    expect(gameHubTitle('Fortnite', ['V-Bucks', 'Accounts'])).toBe('Fortnite Marketplace: Buy V-Bucks & Accounts')
    const long = gameHubTitle('Escape Tsunami for Brainrots', ['Currency', 'Items', 'Accounts'])
    expect(long.length).toBeLessThanOrEqual(47)
    expect(long.startsWith('Escape Tsunami for Brainrots Marketplace')).toBe(true)
  })
})
