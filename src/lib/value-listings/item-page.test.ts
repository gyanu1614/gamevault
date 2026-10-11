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
    expect(m.fallback).toBeNull()
    // 3 live listings: the page renders, but stays out of the index (owner, 2026-10-10)
    expect(m.indexable).toBe(false)
    expect(m.canonicalPath).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni')
    expect(m.fullName).toBe('Dragon Cannelloni')
  })

  it('filters to the variant; the variant page canonicals to its item page', () => {
    const m = buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: 'gold' })!
    expect(m.results.map((r) => r.id)).toEqual(['c', 'a'])
    expect(m.fullName).toBe('Gold Dragon Cannelloni')
    expect(m.canonicalPath).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni')
  })

  it('no stock for the variant → other variants first, then similar items', () => {
    const m = buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: 'diamond' })!
    expect(m.results).toEqual([])
    expect(m.indexable).toBe(false)
    expect(m.fallback!.otherVariants.map((v) => [v.variant, v.count, v.minPriceUsd])).toEqual([
      ['default', 1, 2],
      ['gold', 2, 4],
    ])
    expect(m.fallback!.otherVariants[0].href).toBe('/steal-a-brainrot/buy-items/item/dragon-cannelloni/default')
    expect(m.fallback!.otherVariantRows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    // similar: same rarity first, then closest value; only items with stock
    expect(m.fallback!.similar.map((s) => s.slug)).toEqual(['garama', 'la-vacca', 'tralalero'])
    expect(m.fallback!.similar[0]).toMatchObject({ count: 1, minPriceUsd: 9, href: '/steal-a-brainrot/buy-items/item/garama' })
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

  it('no stock for the item at all → similar items only, noindex', () => {
    const m = buildItemPage({ ...base, itemSlug: 'no-stock', variant: null })!
    expect(m.indexable).toBe(false)
    expect(m.fallback!.otherVariants).toEqual([])
    expect(m.fallback!.similar.map((s) => s.slug)).toContain('garama')
  })
})
