import { describe, it, expect } from 'vitest'
import { buildGameHome } from './build'
import type { GameHomeData } from '../types'

const card = (over: Partial<GameHomeData['cards'][number]>) => ({
  id: 'c1',
  name: 'Pets',
  slug: 'buy-pets',
  type: 'items',
  href: '/adopt-me/buy-pets',
  icon: '/icons/categories/items.svg',
  count: 0,
  fromLabel: null,
  avgDelivery: null,
  isCurrency: false,
  ...over,
})

const NOW = Date.UTC(2026, 9, 23, 12)

const offer = (id: string, price: number) =>
  ({
    id,
    pricePerUnit: price,
    recommended: 0,
    listingSales: 0,
    stock: 1,
    seller: { sales: 0, ratingPercent: null },
  }) as unknown as GameHomeData['offers']['items'][number]

function data(over: Partial<GameHomeData> = {}): GameHomeData {
  return {
    game: { id: 'g', name: 'Adopt Me', slug: 'adopt-me', description: null, image_url: null },
    categories: [],
    cards: [],
    spotlight: null,
    currency: { iconUrl: null, accent: null },
    stats: {},
    offers: { items: [], accounts: [] },
    faq: [],
    trademark: 'tm',
    values: null,
    guides: [],
    ...over,
  }
}

describe('buildGameHome', () => {
  it('names rows with the game and its item word', () => {
    const items = card({ id: 'i', count: 2 })
    const accounts = card({ id: 'a', name: 'Accounts', type: 'account', href: '/adopt-me/buy-accounts', count: 1 })
    const m = buildGameHome(
      data({ cards: [items, accounts], offers: { items: [offer('o1', 5)], accounts: [offer('o2', 9)] } }),
      NOW,
    )
    expect(m.topSelling.map((r) => r.title)).toEqual(['Top Selling Adopt Me Pets', 'Top Selling Adopt Me Accounts'])
    expect(m.topSelling[0].seeAllHref).toBe('/adopt-me/buy-pets')
  })

  describe('Popular row', () => {
    const feedItem = (slug: string, popularRank: number | null) =>
      ({ slug, name: slug, imageUrl: null, rarityKey: null, itemType: null, isNew: false, valueUsd: 1, popularRank }) as unknown as NonNullable<GameHomeData['values']>['items'][number]
    const values = (stock: Record<string, number>) =>
      ({
        items: [feedItem('cow', 4), feedItem('unicorn', 1), feedItem('skelicorn', 2), feedItem('crow', null)],
        stock,
        minPrice: Object.fromEntries(Object.keys(stock).map((s) => [s, 5])),
        forms: {},
        buyHref: {},
        categorySlug: 'buy-items',
        updatedAt: null,
      }) as unknown as NonNullable<GameHomeData['values']>
    const items = card({ id: 'i', count: 2, href: '/adopt-me/buy-items' })

    it('Adopt Me: pets we have, most wanted first, replacing Top Selling; a wanted pet with no stock stays out', () => {
      const m = buildGameHome(data({ cards: [items], values: values({ cow: 2, unicorn: 1, crow: 9 }), offers: { items: [offer('o1', 5)], accounts: [] } }), NOW)
      expect(m.popular?.title).toBe('Popular Adopt Me Pets')
      expect(m.popular?.seeAllHref).toBe('/adopt-me/buy-items')
      expect(m.popular?.items.map((i) => i.slug)).toEqual(['unicorn', 'cow', 'crow'])
      expect(m.topSelling).toEqual([])
    })

    it('every card goes to the market, never to a value page', () => {
      const m = buildGameHome(data({ cards: [items], values: values({ cow: 1 }) }), NOW)
      expect(m.popular?.items[0].href).toBe('/adopt-me/buy-items/item/cow')
    })

    it('the Accounts row stays Top Selling', () => {
      const accounts = card({ id: 'a', name: 'Accounts', type: 'account', href: '/adopt-me/buy-accounts', count: 1 })
      const m = buildGameHome(data({ cards: [items, accounts], values: values({ cow: 1 }), offers: { items: [offer('o1', 5)], accounts: [offer('o2', 9)] } }), NOW)
      expect(m.topSelling.map((r) => r.title)).toEqual(['Top Selling Adopt Me Accounts'])
    })

    it('nothing in stock, or no values feed: back to Top Selling', () => {
      const noStock = buildGameHome(data({ cards: [items], values: values({}), offers: { items: [offer('o1', 5)], accounts: [] } }), NOW)
      expect(noStock.popular).toBeNull()
      expect(noStock.topSelling.map((r) => r.title)).toEqual(['Top Selling Adopt Me Pets'])
      expect(buildGameHome(data({ cards: [items] }), NOW).popular).toBeNull()
    })

    it('other games keep Top Selling for now', () => {
      const game = { id: 'g', name: 'Murder Mystery 2', slug: 'murder-mystery-2', description: null, image_url: null }
      const m = buildGameHome(data({ game, cards: [items], values: values({ cow: 1 }), offers: { items: [offer('o1', 5)], accounts: [] } }), NOW)
      expect(m.popular).toBeNull()
      expect(m.topSelling).toHaveLength(1)
    })
  })

  it('leaves out a row with no offers', () => {
    const m = buildGameHome(data({ cards: [card({ id: 'i', count: 0 })] }), NOW)
    expect(m.topSelling).toEqual([])
  })

  it('builds the hero facts from the cheapest non-currency price and the items delivery', () => {
    const items = card({ id: 'i', count: 83 })
    const robux = card({ id: 'r', type: 'currency', isCurrency: true, count: 10, name: 'Robux' })
    const m = buildGameHome(
      data({
        cards: [robux, items],
        spotlight: robux,
        stats: {
          i: { count: 83, lowPrice: 4.99, avgDeliveryLabel: '1 hour' },
          r: { count: 10, lowPrice: 0.0052, avgDeliveryLabel: '15 minutes' },
        },
      }),
      NOW,
    )
    expect(m.header.facts).toBe('93 Adopt Me offers from $4.99, delivered in about 1 hour.')
    expect(m.currency?.name).toBe('Robux')
  })

  it('feeds the house How It Works bento and Why Buy card with the live numbers', () => {
    const items = card({ id: 'i', count: 13 })
    const m = buildGameHome(data({ cards: [items], stats: { i: { count: 13, lowPrice: 14.99, avgDeliveryLabel: '1 hour' } } }), NOW)
    expect(m.howItWorks.title).toBe('How to Buy Adopt Me Pets Safely')
    expect(m.howItWorks.highlight).toMatchObject({ value: '13 Offers Live' })
    expect(m.whyBuy).toEqual({ count: 13, fromPrice: '$14.99' })
  })

  it('Price Moves: hidden without trends; a real update date, else "Updated daily"', () => {
    expect(buildGameHome(data(), NOW).priceMoves).toBeNull()
    const row = (slug: string, trendPct: number) => ({ slug, name: slug, imageUrl: null, href: null, rarityKey: null, itemType: null, isNew: false, trendPct, trendLabel: null, valueUsd: 50, popularRank: null })
    const values = { items: [row('up', 4), row('down', -2)], stock: {}, buyHref: {}, minPrice: {}, forms: {}, categorySlug: null, updatedAt: '2026-10-22T09:00:00Z' }
    const m = buildGameHome(data({ values }), NOW)
    expect(m.priceMoves).toMatchObject({ title: 'Biggest Adopt Me Price Moves This Week', listHref: '/adopt-me/values', updatedLabel: 'Prices updated Oct 22' })
    expect(buildGameHome(data({ values: { ...values, updatedAt: null } }), NOW).priceMoves?.updatedLabel).toBe('Updated daily')
  })

  it('Guides: hidden without posts; each post keeps its link and gets its type label', () => {
    expect(buildGameHome(data(), NOW).guides).toBeNull()
    const post = {
      href: '/adopt-me/blog/how-to-sell',
      title: 'How to Sell',
      excerpt: 'Price, list, get paid.',
      cover: '/c.png',
      readMinutes: 7,
      postType: 'seller',
    }
    const m = buildGameHome(data({ guides: [post] as never }), NOW)
    expect(m.guides).toMatchObject({ title: 'Adopt Me Guides', moreHref: '/adopt-me/blog' })
    expect(m.guides?.posts[0]).toMatchObject({ href: '/adopt-me/blog/how-to-sell', title: 'How to Sell', cover: '/c.png', readMinutes: 7, typeLabel: 'Selling Guide' })
  })

  it('describes the item offers on the page as one product, with no schema when there are none', () => {
    expect(buildGameHome(data(), NOW).productSchema).toBeNull()
    const m = buildGameHome(data({ cards: [card({ id: 'i', count: 13 })], offers: { items: [offer('a', 4.99), offer('b', 649.99)], accounts: [] } }), NOW)
    expect(m.productSchema).toMatchObject({ name: 'Adopt Me Pets', brand: 'Adopt Me', lowPrice: 4.99, highPrice: 649.99, offerCount: 13 })
  })

  it('shows Hot New only for a values game with new items, linking the value list and the sell page', () => {
    expect(buildGameHome(data(), NOW).hotNew).toBeNull()
    const values = {
      items: [{ slug: 'boohoo', name: 'Boohoo', imageUrl: null, href: '/adopt-me/values/boohoo', rarityKey: null, itemType: null, isNew: true, trendPct: null, trendLabel: null, valueUsd: null, popularRank: null }],
      stock: {},
      buyHref: {},
      minPrice: {},
      forms: {},
      categorySlug: null,
      updatedAt: null,
    }
    const m = buildGameHome(data({ values }), NOW)
    expect(m.hotNew).toMatchObject({ title: 'Hot New Adopt Me Pets', allHref: '/adopt-me/values?view=new', sellHref: '/adopt-me/sell' })
    expect(m.hotNew?.cards.map((c) => c.slug)).toEqual(['boohoo'])
    expect(buildGameHome(data({ values: { ...values, items: [{ ...values.items[0], isNew: false }] } }), NOW).hotNew).toBeNull()
  })
})
