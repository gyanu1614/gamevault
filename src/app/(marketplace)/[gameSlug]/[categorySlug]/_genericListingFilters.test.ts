/**
 * Step 7a — the generic category branch used to filter/sort/paginate on the
 * server from `searchParams`, which made the route dynamic. The same rules now
 * run on the client over the full active set the ISR page ships. This pins
 * each rule to what the PostgREST query did, so a URL means the same listings
 * before and after.
 */
import { describe, it, expect } from 'vitest'
import { applyCategoryListingParams, LISTINGS_PER_PAGE } from './_genericListingFilters'

type L = Parameters<typeof applyCategoryListingParams>[0][number]

let n = 0
const listing = (over: Partial<L> = {}): L => ({
  id: `l${++n}`,
  title: `Listing ${n}`,
  description: '',
  price: 10,
  view_count: 0,
  created_at: new Date(Date.UTC(2026, 0, 1) + n * 3_600_000).toISOString(),
  delivery_time: 'instant',
  seller: { seller_tier: 'bronze', presence: { is_online: false } },
  ...over,
})
const params = (entries: Record<string, string> = {}) => (key: string) => entries[key] ?? null
const ids = (r: { listings: { id: string }[] }) => r.listings.map((l) => l.id)

describe('applyCategoryListingParams', () => {
  it('default: newest first, first page of 12, hasMore when more remain', () => {
    const all = Array.from({ length: 15 }, () => listing())
    const r = applyCategoryListingParams(all, params())
    expect(r.listings).toHaveLength(LISTINGS_PER_PAGE)
    expect(r.listings[0].id).toBe(all[14].id)
    expect(r).toMatchObject({ hasMore: true, currentPage: 1, totalListings: 15 })
  })

  it('page=N returns the first N pages cumulatively (load-more semantics)', () => {
    const all = Array.from({ length: 30 }, () => listing())
    const r = applyCategoryListingParams(all, params({ page: '2' }))
    expect(r.listings).toHaveLength(24)
    expect(r).toMatchObject({ hasMore: true, currentPage: 2, totalListings: 30 })
    expect(applyCategoryListingParams(all, params({ page: '3' })).hasMore).toBe(false)
  })

  it('an unparseable page falls back to page 1', () => {
    const all = Array.from({ length: 3 }, () => listing())
    expect(applyCategoryListingParams(all, params({ page: 'abc' })).currentPage).toBe(1)
    expect(applyCategoryListingParams(all, params({ page: '0' })).currentPage).toBe(1)
  })

  it('minPrice/maxPrice are inclusive bounds', () => {
    const a = listing({ price: 5 }), b = listing({ price: 10 }), c = listing({ price: 20 })
    expect(ids(applyCategoryListingParams([a, b, c], params({ minPrice: '10' })))).toEqual([c.id, b.id])
    expect(ids(applyCategoryListingParams([a, b, c], params({ maxPrice: '10' })))).toEqual([b.id, a.id])
    expect(ids(applyCategoryListingParams([a, b, c], params({ minPrice: '6', maxPrice: '19' })))).toEqual([b.id])
  })

  it('a non-numeric price bound yields no listings (the server query errored → empty)', () => {
    const all = [listing(), listing()]
    expect(applyCategoryListingParams(all, params({ minPrice: 'cheap' })).listings).toEqual([])
  })

  it('search matches any synonym-expanded term in title OR description, case-insensitively', () => {
    const title = listing({ title: 'Cheap RBX bundle' })
    const desc = listing({ title: 'Bundle', description: 'roblox currency, fast' })
    const miss = listing({ title: 'Skins', description: 'nothing here' })
    expect(ids(applyCategoryListingParams([title, desc, miss], params({ search: 'Robux' })))).toEqual([
      desc.id,
      title.id,
    ])
  })

  it('type matches the de-hyphenated label as a title substring', () => {
    const knife = listing({ title: 'Karambit Knife Fade' })
    const glove = listing({ title: 'Sport Gloves' })
    expect(ids(applyCategoryListingParams([knife, glove], params({ type: 'knife' })))).toEqual([knife.id])
    const rare = listing({ title: 'Rare Skin Pack' })
    expect(ids(applyCategoryListingParams([rare, glove], params({ type: 'rare-skin' })))).toEqual([rare.id])
  })

  it('delivery is a comma-separated allow-list on delivery_time', () => {
    const inst = listing({ delivery_time: 'instant' })
    const hr = listing({ delivery_time: '1 hr' })
    const day = listing({ delivery_time: '24 hr' })
    expect(ids(applyCategoryListingParams([inst, hr, day], params({ delivery: 'instant,24 hr' })))).toEqual([
      day.id,
      inst.id,
    ])
  })

  it('sorts: price_low asc, price_high desc, popular by view_count desc (nulls first, as Postgres does)', () => {
    const cheap = listing({ price: 1, view_count: 5 })
    const mid = listing({ price: 5, view_count: null as unknown as number })
    const dear = listing({ price: 9, view_count: 50 })
    expect(ids(applyCategoryListingParams([mid, dear, cheap], params({ sort: 'price_low' })))).toEqual([cheap.id, mid.id, dear.id])
    expect(ids(applyCategoryListingParams([mid, dear, cheap], params({ sort: 'price_high' })))).toEqual([dear.id, mid.id, cheap.id])
    expect(ids(applyCategoryListingParams([cheap, dear, mid], params({ sort: 'popular' })))).toEqual([mid.id, dear.id, cheap.id])
  })

  it('tiers and online=true are post-filters on the seller', () => {
    const gold = listing({ seller: { seller_tier: 'gold', presence: { is_online: true } } })
    const silver = listing({ seller: { seller_tier: 'silver', presence: { is_online: false } } })
    const bronzeOn = listing({ seller: { seller_tier: 'bronze', presence: { is_online: true } } })
    expect(ids(applyCategoryListingParams([gold, silver, bronzeOn], params({ tiers: 'gold,silver' })))).toEqual([silver.id, gold.id])
    expect(ids(applyCategoryListingParams([gold, silver, bronzeOn], params({ online: 'true' })))).toEqual([bronzeOn.id, gold.id])
    expect(applyCategoryListingParams([gold, silver, bronzeOn], params({ online: 'false' })).totalListings).toBe(3)
  })

  it('maxPrice for the slider is the dearest listing ON THE PAGE, 1000 when empty', () => {
    const all = [listing({ price: 3 }), listing({ price: 42 })]
    expect(applyCategoryListingParams(all, params()).maxPrice).toBe(42)
    expect(applyCategoryListingParams([], params()).maxPrice).toBe(1000)
  })
})
