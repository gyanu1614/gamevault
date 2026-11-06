import { describe, it, expect, vi, afterEach } from 'vitest'
import { filterGrid, filterOptions, formsForLetters, fromGridRows, gridItemBase, sortGrid, splitByForm, toGridItems, toGridRows, toggleGridLetter, EMPTY_FILTERS, type GridItem } from './grid'
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
  it('leaves out an item with no picture and no offers (owner, 2026-11-04), but never one somebody sells', () => {
    const list = toGridItems('murder-mystery-2', feed([item('glow', { imageUrl: null }), item('brew', { imageUrl: null }), item('owl')], { brew: [1, 5] }))
    expect(list.map((g) => g.slug)).toEqual(['brew', 'owl'])
  })

  it('maps catalogue items with our stock and links every card to its item page', () => {
    const [g] = toGridItems('adopt-me', feed([item('bat-dragon', { rarityKey: 'ultra_rare' })], { 'bat-dragon': [2, 269.99, ['FR', 'NFR']] }))
    expect(g).toEqual({
      key: 'bat-dragon',
      slug: 'bat-dragon',
      name: 'bat-dragon',
      imageUrl: '/bat-dragon.png',
      rarityKey: 'ultra_rare',
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

  it('out of stock: most wanted first, then New, then by value', () => {
    const list = toGridItems(
      'adopt-me',
      feed(
        [
          item('rich', { valueUsd: 90 }),
          item('fresh', { isNew: true, valueUsd: 1 }),
          item('wanted-2', { popularRank: 8 }),
          item('wanted-1', { popularRank: 3 }),
          item('in-stock', { popularRank: 50 }),
        ],
        { 'in-stock': [1, 10] },
      ),
    )
    expect(slugs(sortGrid(list, 'recommended'))).toEqual(['in-stock', 'wanted-1', 'wanted-2', 'fresh', 'rich'])
  })

  it('recommended: in-stock pets by popularity first (1 = most wanted), unranked after them', () => {
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
    expect(cards[2]).toMatchObject({ slug: 'parrot', offers: 1, minPrice: 80, forms: ['NFR'], pickedForm: 'NFR', href: '/adopt-me/buy-items/item/parrot/neon-fly-ride' })
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

describe('the Items page trait letters', () => {
  const inStock = ['N', 'F', 'R', 'FR', 'NFR', 'MFR']

  it('nothing ticked filters nothing', () => {
    expect(formsForLetters([], inStock)).toEqual([])
  })

  it('a letter means every form that has it: Neon is N and NFR, Fly is F, FR, NFR and MFR', () => {
    expect(formsForLetters(['N'], inStock)).toEqual(['N', 'NFR'])
    expect(formsForLetters(['F'], inStock)).toEqual(['F', 'FR', 'NFR', 'MFR'])
  })

  it('several letters narrow it: Fly + Ride is FR, NFR and MFR; Neon + Fly + Ride is NFR', () => {
    expect(formsForLetters(['F', 'R'], inStock)).toEqual(['FR', 'NFR', 'MFR'])
    expect(formsForLetters(['N', 'F', 'R'], inStock)).toEqual(['NFR'])
  })

  it('ticked letters no form has show nothing, not everything', () => {
    const forms = formsForLetters(['M'], ['FR'])
    expect(forms.length).toBeGreaterThan(0)
    const items = toGridItems('adopt-me', feed([item('owl')], { owl: [1, 50, ['FR']] }))
    expect(filterGrid(items, { ...EMPTY_FILTERS, forms })).toEqual([])
  })

  it('Neon and Mega Neon exclude each other; a second tick takes the letter off', () => {
    expect(toggleGridLetter(['N', 'F'], 'M')).toEqual(['F', 'M'])
    expect(toggleGridLetter(['M'], 'N')).toEqual(['N'])
    expect(toggleGridLetter(['F', 'R'], 'F')).toEqual(['R'])
  })
})

describe('toGridRows and fromGridRows', () => {
  afterEach(() => vi.unstubAllEnvs())

  const stored = (slug: string) => `https://abc.supabase.co/storage/v1/object/public/values-items/${slug}.webp`
  const base = gridItemBase('adopt-me', 'buy-items')
  const full = (items: FeedItem[], stock = {}, formStock?: ValuesFeed['formStock']) =>
    toGridItems('adopt-me', { ...feed(items, stock), formStock }, 'buy-items')

  it('the browser rebuilds exactly the cards the server had, in stock', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    const items = full(
      [item('parrot', { imageUrl: stored('parrot'), popularRank: 3, isNew: true, itemType: 'Pets' })],
      { parrot: [4, 12.5, ['FR', 'NFR']] },
      { parrot: [
        { variant: 'fly-ride', label: 'FR', count: 3, minPrice: 12.5 },
        { variant: 'neon-fly-ride', label: 'NFR', count: 1, minPrice: 40 },
      ] },
    )
    expect(fromGridRows(toGridRows(items), base)).toEqual(items)
  })

  it('the browser rebuilds exactly the cards the server had, out of stock with no picture', () => {
    const items = full([item('brew', { imageUrl: '/games/brew.png', rarityKey: null, valueUsd: null })])
    expect(fromGridRows(toGridRows(items), base)).toEqual(items)
  })

  it('keeps forms that differ from the forms with their own stock', () => {
    const items = full([item('owl')], { owl: [1, 5, ['FR']] })
    expect(fromGridRows(toGridRows(items), base)[0].forms).toEqual(['FR'])
  })

  it('sends only what cards use: no links, no empty fields, no repeated storage address', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    const [row] = toGridRows(full([item('owl', { imageUrl: stored('owl'), rarityKey: null, valueUsd: null })]))
    expect(row).toEqual({ slug: 'owl', name: 'owl', image: 'values-items/owl.webp' })
  })

  it('a value only orders the cards, so two decimals are enough', () => {
    const [row] = toGridRows(full([item('owl', { valueUsd: 12.3456789 })]))
    expect(row.value).toBe(12.35)
  })

  it('a thousand cards take less than half the room', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    const items = full(Array.from({ length: 1000 }, (_, i) => item(`chroma-item-${i}`, { name: `Chroma Item ${i}`, imageUrl: stored(`chroma-item-${i}`), valueUsd: 12.3456789 })))
    expect(JSON.stringify(toGridRows(items)).length).toBeLessThan(JSON.stringify(items).length * 0.4)
  })
})
