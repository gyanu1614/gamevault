import { describe, it, expect } from 'vitest'
import { filterGrid, filterOptions, sortGrid, splitByForm, toGridItems, EMPTY_FILTERS, type GridItem } from './grid'
import type { FeedItem, ValuesFeed } from '@/lib/value-listings/feed/types'

const item = (slug: string, over: Partial<FeedItem> = {}): FeedItem => ({
  slug,
  name: slug,
  imageUrl: `/${slug}.png`,
  href: `/adopt-me/values/${slug}`,
  rarityKey: 'legendary',
  itemType: null,
  isNew: false,
  trendPct: null,
  trendLabel: null,
  valueUsd: 10,
  popularRank: null,
  ...over,
})

function feed(items: FeedItem[], stock: Record<string, [number, number, string[]?]> = {}): ValuesFeed {
  return {
    items,
    stock: Object.fromEntries(Object.entries(stock).map(([s, [n]]) => [s, n])),
    buyHref: Object.fromEntries(Object.keys(stock).map((s) => [s, `/adopt-me/buy-items/item/${s}`])),
    minPrice: Object.fromEntries(Object.entries(stock).map(([s, [, p]]) => [s, p])),
    forms: Object.fromEntries(Object.entries(stock).map(([s, [, , f]]) => [s, f ?? []])),
    categorySlug: 'buy-items',
    updatedAt: null,
  }
}

const slugs = (xs: GridItem[]) => xs.map((x) => x.slug)

describe('toGridItems', () => {
  it('maps catalogue items with our stock, rarity label + colour, and links every card to its item page', () => {
    const [g] = toGridItems('adopt-me', feed([item('bat-dragon', { rarityKey: 'ultra_rare' })], { 'bat-dragon': [2, 269.99, ['FR', 'NFR']] }))
    expect(g).toEqual({
      key: 'bat-dragon',
      slug: 'bat-dragon',
      name: 'bat-dragon',
      imageUrl: '/bat-dragon.png',
      rarityKey: 'ultra_rare',
      rarityLabel: 'Ultra-Rare',
      rarityColor: '#B07BC9',
      itemType: null,
      isNew: false,
      rankValue: 10,
      popularRank: null,
      offers: 2,
      minPrice: 269.99,
      forms: ['FR', 'NFR'],
      href: '/adopt-me/buy-items/item/bat-dragon',
      formsInStock: [],
    })
  })

  it('links an out-of-stock item to its item page too (never the value page)', () => {
    const [g] = toGridItems('adopt-me', feed([item('boohoo')]))
    expect(g).toMatchObject({ offers: 0, minPrice: null, forms: [], href: '/adopt-me/buy-items/item/boohoo' })
  })
})

describe('sortGrid', () => {
  const items = toGridItems(
    'adopt-me',
    feed(
      [item('a', { valueUsd: 5 }), item('b', { valueUsd: 50 }), item('c', { isNew: true, valueUsd: 1 }), item('d'), item('e')],
      { d: [1, 30], e: [3, 90], a: [3, 20] },
    ),
  )

  it('recommended: in stock first (most offers, then cheapest), then New, then by value', () => {
    expect(slugs(sortGrid(items, 'recommended'))).toEqual(['a', 'e', 'd', 'c', 'b'])
  })

  it('recommended: in-stock pets by popularity first (1 = most sellers), unranked after them', () => {
    const ranked = toGridItems(
      'adopt-me',
      feed(
        [item('owl', { popularRank: 3 }), item('cow', { popularRank: 1 }), item('crow'), item('frost', { popularRank: 2 }), item('ghost', { popularRank: 9 })],
        { owl: [1, 60], cow: [1, 40], crow: [5, 300], frost: [2, 90] },
      ),
    )
    // ghost is ranked but nobody sells it: still after every in-stock pet.
    expect(slugs(sortGrid(ranked, 'recommended'))).toEqual(['cow', 'frost', 'owl', 'crow', 'ghost'])
  })

  it('cheapest / priciest sort the in-stock items and keep out-of-stock after them', () => {
    expect(slugs(sortGrid(items, 'cheapest'))).toEqual(['a', 'd', 'e', 'c', 'b'])
    expect(slugs(sortGrid(items, 'priciest'))).toEqual(['e', 'd', 'a', 'c', 'b'])
  })
})

describe('filterGrid', () => {
  const items = toGridItems(
    'murder-mystery-2',
    feed(
      [item('harvester', { rarityKey: 'Godly', itemType: 'knife', name: 'Harvester' }), item('icebreaker', { rarityKey: 'Godly', itemType: 'gun', name: 'Icebreaker' }), item('seer', { rarityKey: 'Legendary', itemType: 'knife', name: 'Seer' })],
      { harvester: [2, 7, ['Default']], seer: [1, 1.5] },
    ),
  )

  it('filters by rarity, type, form, price range and name', () => {
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, rarities: ['Godly'] }))).toEqual(['harvester', 'icebreaker'])
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, types: ['knife'] }))).toEqual(['harvester', 'seer'])
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, forms: ['Default'] }))).toEqual(['harvester'])
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, minPrice: 2 }))).toEqual(['harvester'])
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, maxPrice: 2 }))).toEqual(['seer'])
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, search: 'ICE' }))).toEqual(['icebreaker'])
  })

  it('a price bound shows only items we stock', () => {
    expect(slugs(filterGrid(items, { ...EMPTY_FILTERS, minPrice: 0 }))).toEqual(['harvester', 'seer'])
  })

  it('offers only the options that exist, rarest first', () => {
    expect(filterOptions('murder-mystery-2', items)).toEqual({
      rarities: [
        { value: 'Godly', label: 'Godly' },
        { value: 'Legendary', label: 'Legendary' },
      ],
      types: [
        { value: 'gun', label: 'Gun' },
        { value: 'knife', label: 'Knife' },
      ],
      forms: [{ value: 'Default', label: 'Default' }],
    })
  })
})

describe('splitByForm (search and the trait filter)', () => {
  const f = feed([item('parrot', { name: 'Parrot' }), item('owl', { name: 'Owl' })], { parrot: [3, 20, ['FR', 'NFR']] })
  f.formStock = {
    parrot: [
      { variant: 'normal', label: 'Normal', count: 1, minPrice: 20 },
      { variant: 'fly-ride', label: 'FR', count: 1, minPrice: 55 },
      { variant: 'neon-fly-ride', label: 'NFR', count: 1, minPrice: 80 },
    ],
  }
  const items = toGridItems('adopt-me', f)
  const run = (over: Partial<typeof EMPTY_FILTERS>) => {
    const filters = { ...EMPTY_FILTERS, ...over }
    return splitByForm(filterGrid(items, filters), filters)
  }

  it('no search, no trait filter: one card per pet', () => {
    expect(run({}).map((c) => c.key)).toEqual(['parrot', 'owl'])
  })

  it('search: one card per trait in stock, each with its own price, count and trait page', () => {
    const cards = run({ search: 'parr' })
    expect(cards.map((c) => c.key)).toEqual(['parrot:normal', 'parrot:fly-ride', 'parrot:neon-fly-ride'])
    expect(cards[2]).toMatchObject({ slug: 'parrot', offers: 1, minPrice: 80, forms: ['NFR'], href: '/adopt-me/buy-items/item/parrot/neon-fly-ride' })
  })

  it('the trait filter keeps only the picked traits', () => {
    expect(run({ forms: ['NFR'] }).map((c) => c.key)).toEqual(['parrot:neon-fly-ride'])
  })

  it('the price filter reads each trait’s price, not the cheapest of the pet', () => {
    expect(run({ search: 'parrot', minPrice: 70, maxPrice: 90 }).map((c) => c.key)).toEqual(['parrot:neon-fly-ride'])
  })

  it('a pet with nothing in stock stays one card (Notify Me)', () => {
    expect(run({ search: 'owl' }).map((c) => c.key)).toEqual(['owl'])
  })
})
