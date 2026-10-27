import { describe, it, expect } from 'vitest'
import { buildItemPage, ITEM_PAGE_MIN_LISTINGS } from './item-page'
import { buildValueCatalog } from './catalogs'

const sab = buildValueCatalog('steal-a-brainrot', {
  items: [
    { slug: 'dragon-cannelloni', name: 'Dragon Cannelloni', rarity: 'Secret', valueUsd: 12 },
    { slug: 'garama', name: 'Garama', rarity: 'Secret', valueUsd: 15 },
    { slug: 'la-vacca', name: 'La Vacca', rarity: 'Secret', valueUsd: 400 },
    { slug: 'tralalero', name: 'Tralalero', rarity: 'Mythic', valueUsd: 12 },
    { slug: 'no-stock', name: 'No Stock', rarity: 'Secret', valueUsd: 12 },
  ],
  mutations: [
    { slug: 'default', name: 'Default' },
    { slug: 'gold', name: 'Gold' },
    { slug: 'diamond', name: 'Diamond' },
  ],
})!

const row = (id: string, item: string, variant: string | null, price: number) => ({ id, value_item_slug: item, value_variant: variant, price })
const rows = [
  row('a', 'dragon-cannelloni', 'gold', 5),
  row('b', 'dragon-cannelloni', 'default', 2),
  row('c', 'dragon-cannelloni', 'gold', 4),
  row('d', 'garama', 'default', 9),
  row('e', 'la-vacca', 'default', 300),
  row('f', 'tralalero', 'default', 11),
]
const base = { gameSlug: 'steal-a-brainrot', categorySlug: 'buy-items', catalog: sab, rows }

describe('buildItemPage', () => {
  it('404s an unknown item or a variant the game does not have', () => {
    expect(buildItemPage({ ...base, itemSlug: 'nope', variant: null })).toBeNull()
    expect(buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: 'neon' })).toBeNull()
  })

  it('filters to the item, cheapest first', () => {
    const m = buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: null })!
    expect(m.results.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(m.itemRows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(m.similar).toEqual([])
    // 3 live listings: the page renders, but stays out of the index (owner, 2026-10-10)
    expect(m.indexable).toBe(false)
    expect(m.canonicalPath).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni')
    expect(m.fullName).toBe('Dragon Cannelloni')
  })

  it('results follow the variant, the pet page still gets every offer; it canonicals to its item page', () => {
    const m = buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: 'gold' })!
    expect(m.results.map((r) => r.id)).toEqual(['c', 'a'])
    expect(m.itemRows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(m.fullName).toBe('Gold Dragon Cannelloni')
    expect(m.canonicalPath).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni')
  })

  it('no stock for the variant but some for the item → the other traits stay on the page, no similar items', () => {
    const m = buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: 'diamond' })!
    expect(m.results).toEqual([])
    expect(m.indexable).toBe(false)
    expect(m.itemRows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(m.similar).toEqual([])
  })

  it('indexable only from ITEM_PAGE_MIN_LISTINGS live listings of the item (all variants)', () => {
    expect(ITEM_PAGE_MIN_LISTINGS).toBe(5)
    const five = [...rows, row('g', 'dragon-cannelloni', 'diamond', 6), row('h', 'dragon-cannelloni', 'default', 3)]
    const item = buildItemPage({ ...base, rows: five, itemSlug: 'dragon-cannelloni', variant: null })!
    expect(item.results).toHaveLength(5)
    expect(item.indexable).toBe(true)
    // a variant page with stock follows its item (it canonicals there anyway)
    expect(buildItemPage({ ...base, rows: five, itemSlug: 'dragon-cannelloni', variant: 'gold' })!.indexable).toBe(true)
    // one short of the bar → noindex
    const four = buildItemPage({ ...base, rows: five.slice(0, -1), itemSlug: 'dragon-cannelloni', variant: null })!
    expect(four.indexable).toBe(false)
  })

  it('no stock for the item at all → similar items with stock (same rarity, then closest value), noindex', () => {
    const m = buildItemPage({ ...base, itemSlug: 'no-stock', variant: null })!
    expect(m.indexable).toBe(false)
    expect(m.itemRows).toEqual([])
    // Same rarity (Secret) first by closest value (12: Dragon Cannelloni, then 15: Garama), then the rest.
    expect(m.similar.map((s) => s.slug)).toEqual(['dragon-cannelloni', 'garama', 'la-vacca', 'tralalero'])
    expect(m.similar[1]).toMatchObject({ count: 1, minPriceUsd: 9, href: '/steal-a-brainrot/buy-items/item/garama' })
  })
})
