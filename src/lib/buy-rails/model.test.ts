import { describe, expect, it } from 'vitest'
import {
  barCard,
  barVisible,
  busiestItemsGame,
  currencySourceSlug,
  valueItemRail,
  calcBuySummary,
  currencyCard,
  itemCard,
  itemsCard,
  listBuyLabel,
  offersLabel,
  parseRailSettings,
  RAILS_ON,
  sellHref,
  typicalDelivery,
} from './model'

describe('offersLabel', () => {
  it('says "1 offer" for one and "3 offers" for more', () => {
    expect(offersLabel(1)).toBe('1 offer')
    expect(offersLabel(3)).toBe('3 offers')
    expect(offersLabel(1200)).toBe('1,200 offers')
  })
})

describe('currencyCard', () => {
  const base = { gameSlug: 'roblox', unitLabel: 'Robux', granularity: 'unit' as const, perUnit: true, iconUrl: '/robux.png', href: '/roblox/buy-robux' }

  it('per-unit currency: "From $0.0052 each", count, Shop button', () => {
    const c = currencyCard({ ...base, count: 214, lowPrice: 0.0052 })
    expect(c.variant).toBe('buy')
    expect(c.title).toBe('Buy Robux')
    expect(c.lines).toEqual(['214 offers', 'Priced per Robux'])
    expect(c.summary).toBe('214 offers from $0.0052 each')
    expect(c.cta).toBe('Shop Robux')
    // The rail button carries the price: short, so it never wraps.
    expect(c.buyLabel).toBe('Buy From $0.0052')
    expect(c.href).toBe('/roblox/buy-robux')
    expect(c.image).toEqual({ src: '/robux.png', alt: 'Robux' })
    expect(c.art).toBeNull()
  })

  it('carries the background art when given', () => {
    expect(currencyCard({ ...base, count: 1, lowPrice: 0.005, artUrl: '/cta/roblox.avif' }).art).toBe('/cta/roblox.avif')
  })

  it('bulk games price per K / M', () => {
    const c = currencyCard({ ...base, unitLabel: 'Gold', granularity: 'thousand', count: 5, lowPrice: 1.5 })
    expect(c.lines[1]).toBe('Priced per K')
    expect(c.buyLabel).toBe('Buy From $1.50')
  })

  it('bundle games show the bundle price only', () => {
    const c = currencyCard({ ...base, unitLabel: 'V-Bucks', perUnit: false, count: 2, lowPrice: 4.99 })
    expect(c.lines).toEqual(['2 offers'])
    expect(c.buyLabel).toBe('Buy From $4.99')
  })

  it('no offers flips to sell', () => {
    const c = currencyCard({ ...base, count: 0, lowPrice: null })
    expect(c.variant).toBe('sell')
    expect(c.title).toBe('Have Robux to Sell?')
    expect(c.lines).toEqual(['No sellers yet · list it first'])
    expect(c.cta).toBe('Sell')
  })
})

describe('itemsCard', () => {
  it('"42 offers from $1.20" + Shop Items', () => {
    const c = itemsCard({ gameSlug: 'steal-an-egg', gameName: 'Steal an Egg', href: '/steal-an-egg/buy-items', count: 42, lowPrice: 1.2, artUrl: '/cta.avif' })
    expect(c.title).toBe('Steal an Egg Items')
    expect(c.lines).toEqual(['42 offers'])
    expect(c.summary).toBe('42 offers from $1.20')
    expect(c.cta).toBe('Shop Items')
    expect(c.buyLabel).toBe('Buy From $1.20')
    expect(c.image).toEqual({ src: '/cta.avif', alt: 'Steal an Egg Items' })
    expect(c.art).toBe('/cta.avif')
  })

  it('no offers flips to sell', () => {
    const c = itemsCard({ gameSlug: 'x', gameName: 'Rust', href: '/rust/buy-items', count: 0, lowPrice: null, artUrl: null })
    expect(c.variant).toBe('sell')
    expect(c.title).toBe('Have Rust Items?')
  })
})

describe('itemCard', () => {
  const base = { gameSlug: 'adopt-me', itemSlug: 'bat-dragon', itemName: 'Bat Dragon', imageUrl: '/bat.webp', href: '/adopt-me/buy-items/item/bat-dragon' }

  it('"Buy Bat Dragon", "3 offers from $42", delivery, Buy Now', () => {
    const c = itemCard({ ...base, count: 3, lowPrice: 42, deliveryLabel: '15 Mins' })
    expect(c.title).toBe('Buy Bat Dragon')
    expect(c.name).toBe('Bat Dragon')
    expect(c.lines).toEqual(['3 offers'])
    expect(c.summary).toBe('3 offers from $42')
    expect(c.buyLabel).toBe('Buy From $42')
    expect(c.meta).toBe('15 Mins')
    expect(c.cta).toBe('Buy Now')
    expect(c.item).toBe('bat-dragon')
    expect(itemCard({ ...base, count: 3, lowPrice: 42, deliveryLabel: null, artUrl: '/cta/am.avif' }).art).toBe('/cta/am.avif')
  })

  it('no offers: "Have a Frost Fury?" with a/an by sound', () => {
    expect(itemCard({ ...base, itemName: 'Frost Fury', count: 0, lowPrice: null, deliveryLabel: null }).title).toBe('Have a Frost Fury?')
    const owl = itemCard({ ...base, itemName: 'Owl', count: 0, lowPrice: null, deliveryLabel: null })
    expect(owl.title).toBe('Have an Owl?')
    expect(owl.lines).toEqual(['No sellers yet · list it first'])
    expect(owl.summary).toBe('No sellers yet · list it first')
    expect(owl.buyLabel).toBe('Sell')
    expect(owl.meta).toBeNull()
  })
})

describe('sellHref', () => {
  it('sellers go to the prefilled wizard', () => {
    expect(sellHref(true, { gameSlug: 'adopt-me', categoryType: 'items' }, 'rail')).toBe('/sell/new?game=adopt-me&category=items')
  })
  it('everyone else goes to /founding with the source in the hash', () => {
    expect(sellHref(false, { gameSlug: 'adopt-me', categoryType: 'items' }, 'rail-value_item')).toBe('/founding#src=rail-value_item')
  })
})

describe('typicalDelivery', () => {
  it('median of the offers', () => {
    expect(typicalDelivery(['15min', '1hr', '20min'])).toBe('20 Mins')
    expect(typicalDelivery(['2hr', '3hr', '24hr'])).toBe('3 Hours')
    expect(typicalDelivery(['1hr'])).toBe('1 Hour')
    expect(typicalDelivery(['2d', '3d'])).toBe('3 Days')
  })
  it('instant everywhere reads Instant; nothing reads null', () => {
    expect(typicalDelivery(['instant', 'instant'])).toBe('Instant')
    expect(typicalDelivery([])).toBeNull()
    expect(typicalDelivery([null, ''])).toBeNull()
  })
})

describe('parseRailSettings', () => {
  it('fails open: missing row or bad data means every surface on', () => {
    expect(parseRailSettings(null)).toEqual(RAILS_ON)
    expect(parseRailSettings('x')).toEqual(RAILS_ON)
  })
  it('only an explicit false switches a surface off', () => {
    expect(parseRailSettings({ blog: false, value_item: true, value_list: null })).toEqual({ ...RAILS_ON, blog: false })
  })
})

describe('barVisible', () => {
  const base = { mode: 'immediate' as const, scrolled: 0, footerInView: false, inputFocused: false, dismissed: false }
  it('immediate mode shows at once', () => {
    expect(barVisible(base)).toBe(true)
  })
  it('scroll mode waits for a third of the page', () => {
    expect(barVisible({ ...base, mode: 'scroll', scrolled: 0.2 })).toBe(false)
    expect(barVisible({ ...base, mode: 'scroll', scrolled: 0.34 })).toBe(true)
  })
  it('hides at the footer, while typing, and once closed', () => {
    expect(barVisible({ ...base, footerInView: true })).toBe(false)
    expect(barVisible({ ...base, inputFocused: true })).toBe(false)
    expect(barVisible({ ...base, dismissed: true })).toBe(false)
  })
})

describe('calcBuySummary', () => {
  const stock = {
    'bat-dragon': { total: 3, minPriceUsd: 42, byVariant: { neon: { count: 1, minPriceUsd: 60 } } },
    owl: { total: 2, minPriceUsd: 20, byVariant: {} },
    frog: { total: 1, minPriceUsd: 3, byVariant: {} },
  }
  it('"3 of 4 items in stock · Get them from $65"', () => {
    const s = calcBuySummary(
      [
        { slug: 'bat-dragon', name: 'Bat Dragon' },
        { slug: 'owl', name: 'Owl' },
        { slug: 'frog', name: 'Frog' },
        { slug: 'shadow-dragon', name: 'Shadow Dragon' },
      ],
      stock,
    )
    expect(s).toMatchObject({ total: 4, inStock: 3, fromUsd: 65 })
    expect(s?.line).toBe('3 of 4 items in stock · Get them from $65')
    expect(s?.stocked.map((i) => i.slug)).toEqual(['bat-dragon', 'owl', 'frog'])
  })
  it('uses the variant price when that variant is listed', () => {
    expect(calcBuySummary([{ slug: 'bat-dragon', name: 'Bat Dragon', variant: 'neon' }], stock)?.line).toBe('1 of 1 item in stock · Get it from $60')
  })
  it('null when nothing in the trade is in stock (or the trade is empty)', () => {
    expect(calcBuySummary([{ slug: 'shadow-dragon', name: 'Shadow Dragon' }], stock)).toBeNull()
    expect(calcBuySummary([], stock)).toBeNull()
  })
})

describe('listBuyLabel', () => {
  it('"From $42" with stock, null without', () => {
    expect(listBuyLabel({ total: 3, minPriceUsd: 42, byVariant: {} })).toBe('From $42')
    expect(listBuyLabel(undefined)).toBeNull()
    expect(listBuyLabel({ total: 0, minPriceUsd: null, byVariant: {} })).toBeNull()
  })
})

describe('currencySourceSlug', () => {
  it('the game\'s own currency first, Robux for Roblox games, none otherwise', () => {
    expect(currencySourceSlug({ slug: 'fortnite', ecosystem: null, hasCurrency: true })).toBe('fortnite')
    expect(currencySourceSlug({ slug: 'adopt-me', ecosystem: 'roblox', hasCurrency: false })).toBe('roblox')
    expect(currencySourceSlug({ slug: 'valorant', ecosystem: null, hasCurrency: false })).toBeNull()
  })
})

describe('busiestItemsGame', () => {
  it('the items category with the most offers', () => {
    expect(
      busiestItemsGame([
        { gameSlug: 'roblox', type: 'currency', offers: 900 },
        { gameSlug: 'adopt-me', type: 'items', offers: 300 },
        { gameSlug: 'mm2', type: 'items', offers: 100 },
      ]),
    ).toBe('adopt-me')
    expect(busiestItemsGame([])).toBeNull()
  })
})

describe('valueItemRail', () => {
  it('links the item\'s offers page and reads the typical delivery off its offers', () => {
    const c = valueItemRail({
      gameSlug: 'adopt-me',
      itemSlug: 'bat-dragon',
      itemName: 'Bat Dragon',
      imageUrl: '/bat.webp',
      buy: {
        categorySlug: 'buy-items',
        stock: { total: 3, minPriceUsd: 42, byVariant: {} },
        offers: [{ deliveryTime: '15min' }, { deliveryTime: '1hr' }, { deliveryTime: '20min' }],
      },
    })
    expect(c.href).toBe('/adopt-me/buy-items/item/bat-dragon')
    expect(c.lines).toEqual(['3 offers'])
    expect(c.meta).toBe('20 Mins')
  })
  it('no buy data → sell card', () => {
    expect(valueItemRail({ gameSlug: 'adopt-me', itemSlug: 'frost-fury', itemName: 'Frost Fury', imageUrl: null, buy: null }).variant).toBe('sell')
  })
})

describe('barCard', () => {
  const items = itemsCard({ gameSlug: 'g', gameName: 'Adopt Me', href: '/g/i', count: 4, lowPrice: 2, artUrl: null })
  const noItems = itemsCard({ gameSlug: 'g', gameName: 'Adopt Me', href: '/g/i', count: 0, lowPrice: null, artUrl: null })
  const robux = currencyCard({ gameSlug: 'roblox', unitLabel: 'Robux', granularity: 'unit', perUnit: true, iconUrl: null, href: '/r', count: 9, lowPrice: 0.005 })
  it('items with offers first, then currency with offers, then the sell ask', () => {
    expect(barCard({ items, currency: robux })).toBe(items)
    expect(barCard({ items: noItems, currency: robux })).toBe(robux)
    expect(barCard({ items: noItems, currency: null })).toBe(noItems)
    expect(barCard({ items: null, currency: null })).toBeNull()
  })
})
