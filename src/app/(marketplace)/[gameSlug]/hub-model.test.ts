/** Game hub (/[gameSlug]) model: category cards, currency spotlight, offer rails. */
import { describe, expect, it } from 'vitest'
import { buildHubCards, categoryIcon, fromLabel, hubPitch, pickRail, splitCards, type HubCategory } from './_hubModel'
import type { ItemOffer } from './[categorySlug]/_itemsTypes'

const cat = (id: string, name: string, slug: string, type: string | null, icon_url: string | null = null): HubCategory => ({
  id,
  name,
  slug,
  type,
  icon_url,
})

describe('categoryIcon', () => {
  it('admin icon wins, else the house set by type', () => {
    expect(categoryIcon('currency', 'https://cdn/x.png')).toBe('https://cdn/x.png')
    expect(categoryIcon('currency', null)).toBe('/icons/categories/currency.svg')
    expect(categoryIcon('account', null)).toBe('/icons/categories/accounts.svg')
    expect(categoryIcon('service', null)).toBe('/icons/categories/boosting.svg')
    expect(categoryIcon('items', null)).toBe('/icons/categories/items.svg')
    expect(categoryIcon(null, null)).toBe('/icons/categories/items.svg')
  })
})

describe('fromLabel', () => {
  it('per-unit currency keeps its unit, like the category page title', () => {
    expect(fromLabel(0.0052, 'Robux')).toBe('$0.0052/Robux')
  })
  it('whole and sub-dollar prices', () => {
    expect(fromLabel(4.99, null)).toBe('$4.99')
    expect(fromLabel(12, null)).toBe('$12')
  })
  it('null with no price', () => {
    expect(fromLabel(null, null)).toBeNull()
  })
})

describe('buildHubCards + splitCards', () => {
  const cats = [
    cat('a', 'Accounts', 'buy-accounts', 'account'),
    cat('v', 'V-Bucks', 'buy-vbucks', 'currency'),
    cat('s', 'Skins', 'buy-skins', 'items'),
    cat('b', 'Boosting', 'boosting', 'service'),
  ]
  const stats = {
    a: { count: 4, lowPrice: 9.5, avgDeliveryLabel: '1 hour' },
    v: { count: 12, lowPrice: 3.99, avgDeliveryLabel: '15 minutes' },
    s: { count: 0, lowPrice: null, avgDeliveryLabel: null },
  }
  const cards = buildHubCards('fortnite', cats, stats, null)

  it('currency leads, the rest keep their order', () => {
    expect(cards.map((c) => c.id)).toEqual(['v', 'a', 's', 'b'])
  })

  it('links, counts and from-prices', () => {
    expect(cards[0]).toMatchObject({ href: '/fortnite/buy-vbucks', count: 12, fromLabel: '$3.99', isCurrency: true, avgDelivery: '15 minutes' })
    expect(cards[2]).toMatchObject({ count: 0, fromLabel: null })
    expect(cards[3]).toMatchObject({ count: 0, fromLabel: null }) // no stats row → empty
  })

  it('the currency card becomes the spotlight and leaves the grid', () => {
    const { spotlight, grid } = splitCards(cards)
    expect(spotlight?.id).toBe('v')
    expect(grid.map((c) => c.id)).toEqual(['a', 's', 'b'])
  })

  it('no currency → no spotlight, everything in the grid', () => {
    const { spotlight, grid } = splitCards(buildHubCards('adopt-me', [cats[0], cats[2]], stats, null))
    expect(spotlight).toBeNull()
    expect(grid).toHaveLength(2)
  })

  it('the unit suffix only applies to the currency card', () => {
    const c = buildHubCards('roblox', [cat('r', 'Robux', 'buy-robux', 'currency'), cats[0]], { r: { count: 3, lowPrice: 0.0052, avgDeliveryLabel: null }, a: stats.a }, 'Robux')
    expect(c[0].fromLabel).toBe('$0.0052/Robux')
    expect(c[1].fromLabel).toBe('$9.50')
  })
})

describe('pickRail', () => {
  const o = (id: string, price: number, recommended: number) =>
    ({ id, pricePerUnit: price, stock: 3, isUnlimited: false, recommended, seller: { ratingPercent: null, sales: 0 } }) as unknown as ItemOffer

  it('best offer (cheapest in stock) first, then recommended, capped', () => {
    const rail = pickRail([o('x', 9, 90), o('cheap', 1, 10), o('y', 5, 80), o('z', 7, 70)], 3)
    expect(rail.map((r) => r.id)).toEqual(['cheap', 'x', 'y'])
  })
})

describe('hubPitch', () => {
  it('names what the game sells; currency names keep their case', () => {
    const cards = buildHubCards(
      'fortnite',
      [cat('v', 'V-Bucks', 'buy-vbucks', 'currency'), cat('a', 'Accounts', 'buy-accounts', 'account'), cat('s', 'Skins', 'buy-skins', 'items')],
      {},
      null,
    )
    expect(hubPitch('Fortnite', cards)).toBe('Buy and sell Fortnite V-Bucks, accounts and skins from verified sellers.')
  })
  it('one category, and none', () => {
    expect(hubPitch('Roblox', buildHubCards('roblox', [cat('r', 'Robux', 'buy-robux', 'currency')], {}, null))).toBe(
      'Buy and sell Roblox Robux from verified sellers.',
    )
    expect(hubPitch('Evomon', [])).toBe('Buy and sell Evomon from verified sellers.')
  })
})
