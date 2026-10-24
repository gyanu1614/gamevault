import { describe, it, expect } from 'vitest'
import { pickHotNew } from './hot-new'
import type { FeedItem, ValuesFeed } from '../types'

const item = (slug: string, isNew = true): FeedItem => ({
  slug,
  name: slug,
  imageUrl: null,
  href: `/x/values/${slug}`,
  isNew,
  trendPct: null,
  trendLabel: null,
  valueUsd: 10,
})
const feed = (items: FeedItem[], stock: Record<string, number> = {}, minPrice: Record<string, number> = {}): ValuesFeed => ({
  items,
  stock,
  buyHref: Object.fromEntries(Object.keys(stock).map((s) => [s, `/x/buy-items/item/${s}`])),
  minPrice,
  updatedAt: null,
})
const DAY = 86_400_000
const now = Date.UTC(2026, 9, 23, 12)
const slugs = (cards: { slug: string }[]) => cards.map((c) => c.slug)

describe('pickHotNew', () => {
  it('keeps only new items, ranked by our own offers', () => {
    const r = pickHotNew(feed([item('a'), item('b'), item('old', false)], { a: 1, b: 5, old: 9 }), now)
    expect(slugs(r)).toEqual(['b', 'a'])
  })

  it('links an item in stock to our listings with its price, and one without to nothing', () => {
    const [inStock, none] = pickHotNew(feed([item('a'), item('b')], { a: 2 }, { a: 24.99 }), now)
    expect(inStock).toMatchObject({ slug: 'a', offers: 2, buyHref: '/x/buy-items/item/a', fromPrice: 24.99, valueHref: '/x/values/a' })
    expect(none).toMatchObject({ slug: 'b', offers: 0, buyHref: null, fromPrice: null })
  })

  it('breaks ties in the same order all day', () => {
    const items = ['p', 'q', 'r', 's', 't'].map((s) => item(s))
    expect(slugs(pickHotNew(feed(items), now))).toEqual(slugs(pickHotNew(feed(items), now + 6 * 3_600_000)))
  })

  it('reshuffles ties on another day', () => {
    const items = 'abcdefghij'.split('').map((s) => item(s))
    const days = [0, 1, 2, 3].map((d) => slugs(pickHotNew(feed(items), now + d * DAY)).join(''))
    expect(new Set(days).size).toBeGreaterThan(1)
  })

  it('caps at the limit', () => {
    expect(pickHotNew(feed('abcdefghij'.split('').map((s) => item(s))), now, 8)).toHaveLength(8)
  })
})
