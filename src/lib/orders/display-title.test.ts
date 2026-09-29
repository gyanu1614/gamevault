import { describe, expect, it } from 'vitest'
import { orderDisplayTitle, orderItemTitle, orderItemImage } from './display-title'

describe('orderDisplayTitle', () => {
  it('prefixes the amount for flexible per-unit currency', () => {
    expect(
      orderDisplayTitle({ title: 'Roblox Robux', quantity: 2000, isCurrency: true, granularity: 'unit' }),
    ).toBe('2,000 - Roblox Robux')
  })

  it('shows the K / M magnitude for bulk currency games', () => {
    expect(
      orderDisplayTitle({ title: 'Blade Ball Tokens', quantity: 100, isCurrency: true, granularity: 'million' }),
    ).toBe('100 M - Blade Ball Tokens')
    expect(
      orderDisplayTitle({ title: 'Gems', quantity: 5, isCurrency: true, granularity: 'thousand' }),
    ).toBe('5 K - Gems')
  })

  it('treats a missing currency config as per-unit', () => {
    expect(orderDisplayTitle({ title: 'Robux', quantity: 400, isCurrency: true })).toBe('400 - Robux')
  })

  it('counts bundles and items with ×, only when more than one', () => {
    expect(orderDisplayTitle({ title: 'Robux Pack', quantity: 2, isCurrency: true, hasBundles: true })).toBe(
      '2 × Robux Pack',
    )
    expect(orderDisplayTitle({ title: 'Dragon Pet', quantity: 3, isCurrency: false })).toBe('3 × Dragon Pet')
    expect(orderDisplayTitle({ title: 'Dragon Pet', quantity: 1, isCurrency: false })).toBe('Dragon Pet')
  })

  it('never runs two numbers together', () => {
    expect(orderDisplayTitle({ title: '10,000 Robux', quantity: 1, isCurrency: true })).toBe('10,000 Robux')
    expect(orderDisplayTitle({ title: '10,000 Robux', quantity: 2, isCurrency: true })).toBe('2 × 10,000 Robux')
  })

  it('falls back to the plain title on a bad quantity', () => {
    expect(orderDisplayTitle({ title: 'Robux', quantity: null, isCurrency: false })).toBe('Robux')
    expect(orderDisplayTitle({ title: 'Robux', quantity: 0, isCurrency: true })).toBe('Robux')
  })
})

describe('orderDisplayTitle — item only (no game name)', () => {
  it('flexible currency with a unit label reads "<amount> <unit>"', () => {
    expect(orderDisplayTitle({ title: 'Roblox Robux', quantity: 2000, isCurrency: true, unitLabel: 'Robux' })).toBe('2,000 Robux')
    expect(orderDisplayTitle({ title: 'Blade Ball Tokens', quantity: 100, isCurrency: true, granularity: 'million', unitLabel: 'Tokens' })).toBe('100 M Tokens')
  })
  it('a bundle listing reads as the bundle, never the listing title', () => {
    expect(orderDisplayTitle({ title: '99 Nights in the Forest 50 Diamonds', quantity: 1, isCurrency: true, hasBundles: true, bundleName: '50 Diamonds' })).toBe('50 Diamonds')
    expect(orderDisplayTitle({ title: '99 Nights in the Forest 50 Diamonds', quantity: 2, isCurrency: true, hasBundles: true, bundleName: '50 Diamonds' })).toBe('2 × 50 Diamonds')
  })
})

describe('orderItemTitle / orderItemImage', () => {
  const cfg = {
    unit_label: 'Diamonds',
    quantity_granularity: 'unit',
    currency_icon_url: 'https://x/currency.webp',
    bundles: [{ id: 'b50', name: '50 Diamonds', icon_url: 'https://x/b50.webp' }],
  }
  it('bundle listing → bundle name + bundle icon', () => {
    expect(orderItemTitle({ listingTitle: '99 Nights in the Forest 50 Diamonds', quantity: 1, categoryType: 'currency', currencyConfig: cfg, bundleId: 'b50' })).toBe('50 Diamonds')
    expect(orderItemImage({ categoryType: 'currency', currencyConfig: cfg, bundleId: 'b50', listingImage: 'https://x/listing.webp' })).toBe('https://x/b50.webp')
  })
  it('unknown bundle id falls back to the currency icon and the listing title', () => {
    expect(orderItemTitle({ listingTitle: 'Old Title', quantity: 1, categoryType: 'currency', currencyConfig: cfg, bundleId: 'gone' })).toBe('Old Title')
    expect(orderItemImage({ categoryType: 'currency', currencyConfig: cfg, bundleId: 'gone', listingImage: null })).toBe('https://x/currency.webp')
  })
  it('flexible currency → "<amount> <unit>" + currency icon', () => {
    const robux = { unit_label: 'Robux', quantity_granularity: 'unit', currency_icon_url: 'https://x/robux.webp', bundles: [] }
    expect(orderItemTitle({ listingTitle: 'Roblox Robux', quantity: 2000, categoryType: 'currency', currencyConfig: robux })).toBe('2,000 Robux')
    expect(orderItemImage({ categoryType: 'currency', currencyConfig: robux, listingImage: 'https://x/listing.webp' })).toBe('https://x/robux.webp')
  })
  it('items keep the listing title and image; never the game image', () => {
    expect(orderItemTitle({ listingTitle: 'FR Kangaroo', quantity: 1, categoryType: 'items', currencyConfig: cfg })).toBe('FR Kangaroo')
    expect(orderItemTitle({ listingTitle: 'FR Kangaroo', quantity: 3, categoryType: 'items' })).toBe('3 × FR Kangaroo')
    expect(orderItemImage({ categoryType: 'items', currencyConfig: cfg, listingImage: 'https://x/pet.webp' })).toBe('https://x/pet.webp')
    expect(orderItemImage({ categoryType: 'items', listingImage: null })).toBeNull()
  })
  it('missing config keeps the old currency fallback', () => {
    expect(orderItemTitle({ listingTitle: 'Roblox Robux', quantity: 400, categoryType: 'currency', currencyConfig: null })).toBe('400 - Roblox Robux')
  })
})
