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
    // live listings: indexable (owner, 2026-10-27: from the first offer)
    expect(m.indexable).toBe(true)
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

  it('indexable from the first live listing of the item (all variants)', () => {
    expect(ITEM_PAGE_MIN_LISTINGS).toBe(1)
    const one = [row('g', 'dragon-cannelloni', 'gold', 6)]
    const item = buildItemPage({ ...base, rows: one, itemSlug: 'dragon-cannelloni', variant: null })!
    expect(item.results).toHaveLength(1)
    expect(item.indexable).toBe(true)
    // a variant page with stock follows its item (it canonicals there anyway)
    expect(buildItemPage({ ...base, rows: one, itemSlug: 'dragon-cannelloni', variant: 'gold' })!.indexable).toBe(true)
    // no listing of the item → noindex
    expect(buildItemPage({ ...base, rows: [], itemSlug: 'dragon-cannelloni', variant: null })!.indexable).toBe(false)
  })

  it('with stock → the most popular other items in stock: rank, then offers, then name', () => {
    const m = buildItemPage({ ...base, itemSlug: 'dragon-cannelloni', variant: null })!
    expect(m.similar).toEqual([])
    // Unranked: one offer each, so by name.
    expect(m.related.map((s) => s.slug)).toEqual(['garama', 'la-vacca', 'tralalero'])
    expect(m.related[0]).toMatchObject({ count: 1, minPriceUsd: 9, href: '/steal-a-brainrot/buy-items/item/garama' })

    const ranked = buildValueCatalog('steal-a-brainrot', {
      items: sab.items.map((i) => ({ ...i, popularRank: i.slug === 'tralalero' ? 1 : i.slug === 'la-vacca' ? 2 : null })),
      mutations: sab.mutations,
    })!
    const r = buildItemPage({ ...base, catalog: ranked, itemSlug: 'dragon-cannelloni', variant: null })!
    expect(r.related.map((s) => s.slug)).toEqual(['tralalero', 'la-vacca', 'garama'])
  })

  it('no stock for the item at all → similar items with stock (same rarity, then closest value), noindex', () => {
    const m = buildItemPage({ ...base, itemSlug: 'no-stock', variant: null })!
    expect(m.indexable).toBe(false)
    expect(m.itemRows).toEqual([])
    // Same rarity (Secret) first by closest value (12: Dragon Cannelloni, then 15: Garama), then the rest.
    expect(m.similar.map((s) => s.slug)).toEqual(['dragon-cannelloni', 'garama', 'la-vacca', 'tralalero'])
    expect(m.similar[1]).toMatchObject({ count: 1, minPriceUsd: 9, href: '/steal-a-brainrot/buy-items/item/garama' })
    expect(m.related).toEqual([])
  })
})

describe('buildItemPage — Adopt Me eggs and potions', () => {
  const am = buildValueCatalog('adopt-me', {
    items: [
      { slug: 'parrot', name: 'Parrot', rarity: 'legendary', popularRank: 1 },
      { slug: 'owl', name: 'Owl', rarity: 'legendary', popularRank: 2 },
      { slug: 'safari-egg', name: 'Safari Egg', popularRank: 3, kind: 'egg' },
      { slug: 'crystal-egg', name: 'Crystal Egg', popularRank: 4, kind: 'egg' },
      { slug: 'fly-potion', name: 'Fly Potion', popularRank: 5, kind: 'potion' },
    ],
  })!
  const amRows = [row('a', 'parrot', 'fly-ride', 5), row('b', 'owl', 'fly-ride', 6), row('c', 'safari-egg', null, 2), row('d', 'fly-potion', null, 3)]
  const amBase = { gameSlug: 'adopt-me', categorySlug: 'buy-items', catalog: am, rows: amRows, variant: null }

  it('the row under a pet page stays pets', () => {
    expect(buildItemPage({ ...amBase, itemSlug: 'parrot' })!.related.map((r) => r.slug)).toEqual(['owl'])
  })

  it('the row under an egg with offers is pets too: its heading says Pets', () => {
    expect(buildItemPage({ ...amBase, itemSlug: 'safari-egg' })!.related.map((r) => r.slug)).toEqual(['parrot', 'owl'])
  })

  it('an egg nobody sells offers eggs first, then pets, never another kind', () => {
    expect(buildItemPage({ ...amBase, itemSlug: 'crystal-egg' })!.similar.map((r) => r.slug)).toEqual(['safari-egg', 'parrot', 'owl'])
  })
})

describe('buildItemPage: Common and Chroma on Murder Mystery 2', () => {
  const mm2 = buildValueCatalog('murder-mystery-2', {
    items: [
      { slug: 'travelers-gun', name: "Traveler's Gun", rarity: 'Godly' },
      { slug: 'chroma-travelers-gun', name: "Chroma Traveler's Gun", rarity: 'Chroma' },
      { slug: 'luger', name: 'Luger', rarity: 'Godly' },
      { slug: 'chroma-laser', name: 'Chroma Laser', rarity: 'Chroma' },
    ],
  })!
  const offers = [row('a', 'travelers-gun', null, 6), row('b', 'chroma-travelers-gun', null, 40), row('c', 'chroma-travelers-gun', null, 30)]
  const page = (itemSlug: string, gameSlug = 'murder-mystery-2') => buildItemPage({ gameSlug, categorySlug: 'buy-items', catalog: mm2, itemSlug, variant: null, rows: offers })!

  it('an item with a Chroma version offers both, each with its stock and link', () => {
    expect(page('travelers-gun').forms).toEqual([
      { slug: 'travelers-gun', label: 'Common', href: '/murder-mystery-2/buy-items/item/travelers-gun', count: 1, minPriceUsd: 6 },
      { slug: 'chroma-travelers-gun', label: 'Chroma', href: '/murder-mystery-2/buy-items/item/chroma-travelers-gun', count: 2, minPriceUsd: 30 },
    ])
  })

  it('the Chroma page offers the same two', () => {
    expect(page('chroma-travelers-gun').forms.map((f) => f.slug)).toEqual(['travelers-gun', 'chroma-travelers-gun'])
  })

  it('each page lists only its own offers', () => {
    expect(page('chroma-travelers-gun').itemRows.map((r) => r.id)).toEqual(['c', 'b'])
    expect(page('travelers-gun').itemRows.map((r) => r.id)).toEqual(['a'])
  })

  it('a version nobody sells has no price, so the picker says Notify Me', () => {
    const none = buildItemPage({ gameSlug: 'murder-mystery-2', categorySlug: 'buy-items', catalog: mm2, itemSlug: 'travelers-gun', variant: null, rows: [] })!
    expect(none.forms.map((f) => [f.count, f.minPriceUsd])).toEqual([[0, null], [0, null]])
  })

  it('no pair, no picker: no Chroma version, or a Chroma with no plain one', () => {
    expect(page('luger').forms).toEqual([])
    expect(page('chroma-laser').forms).toEqual([])
  })

  it('other games never get it', () => {
    expect(page('travelers-gun', 'adopt-me').forms).toEqual([])
  })
})
