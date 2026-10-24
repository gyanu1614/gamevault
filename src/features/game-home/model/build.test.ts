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
    expect(m.hero.facts).toBe('93 Adopt Me offers from $4.99, delivered in about 1 hour.')
    expect(m.currency?.name).toBe('Robux')
  })

  it('Start Selling shows our three highest-priced item offers that have a picture', () => {
    const withImg = (id: string, price: number, imageUrl: string | null, name = id) => ({ ...offer(id, price), imageUrl, name })
    const m = buildGameHome(
      data({
        cards: [card({ id: 'i', count: 4 })],
        offers: {
          items: [withImg('a', 10, '/a.png'), withImg('b', 300, '/b.png'), withImg('c', 500, null), withImg('d', 120, '/d.png'), withImg('e', 90, '/e.png')],
          accounts: [],
        },
      }),
      NOW,
    )
    expect(m.startSelling.examples.map((e) => e.name)).toEqual(['b', 'd', 'e'])
    expect(m.startSelling.examples[0]).toEqual({ name: 'b', imageUrl: '/b.png', priceUsd: 300 })
    expect(m.startSelling.firstSeller).toBe(false)
  })

  it('Start Selling asks for the first seller when the game has no offers', () => {
    const m = buildGameHome(data({ cards: [card({ id: 'i', count: 0 })] }), NOW)
    expect(m.startSelling).toMatchObject({ firstSeller: true, examples: [], itemNoun: 'Pets' })
  })

  it('Price Moves: hidden without trends; a real update date, else "Updated daily"', () => {
    expect(buildGameHome(data(), NOW).priceMoves).toBeNull()
    const row = (slug: string, trendPct: number) => ({ slug, name: slug, imageUrl: null, href: null, isNew: false, trendPct, trendLabel: null, valueUsd: 50 })
    const values = { items: [row('up', 4), row('down', -2)], stock: {}, buyHref: {}, minPrice: {}, updatedAt: '2026-10-22T09:00:00Z' }
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

  it('shows Hot New only for a values game with new items, linking the value list and the sell page', () => {
    expect(buildGameHome(data(), NOW).hotNew).toBeNull()
    const values = {
      items: [{ slug: 'boohoo', name: 'Boohoo', imageUrl: null, href: '/adopt-me/values/boohoo', isNew: true, trendPct: null, trendLabel: null, valueUsd: null }],
      stock: {},
      buyHref: {},
      minPrice: {},
      updatedAt: null,
    }
    const m = buildGameHome(data({ values }), NOW)
    expect(m.hotNew).toMatchObject({ title: 'Hot New Adopt Me Pets', allHref: '/adopt-me/values?view=new', sellHref: '/adopt-me/sell' })
    expect(m.hotNew?.cards.map((c) => c.slug)).toEqual(['boohoo'])
    expect(buildGameHome(data({ values: { ...values, items: [{ ...values.items[0], isNew: false }] } }), NOW).hotNew).toBeNull()
  })
})
