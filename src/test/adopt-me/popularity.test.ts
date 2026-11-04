import { describe, expect, it } from 'vitest'
import { blendRanks, fetchProductOrder, planRankUpdates, rankPetsByFeed, rankPetsBySellers } from '../../../scripts/lib/adoptme-popularity.mjs'

// One of the two signals: distinct sellers listing a pet (owner, 2026-11-01).
const row = (pet_id: string, seller_id: string | null) => ({ pet_id, seller_id })

describe('fetchProductOrder', () => {
  const page = (totalPages: number, names: string[]) => ({ totalPages, results: names.map((name) => ({ name })) })

  it('walks every page of the pet feed, in order', async () => {
    const urls: URL[] = []
    const pages: Record<string, unknown> = { '1': page(2, ['Skelicorn', 'Crystal Egg']), '2': page(2, ['Unicorn']) }
    const names = await fetchProductOrder(async (u: URL) => {
      urls.push(u)
      return pages[u.searchParams.get('pageIndex')!]
    })
    expect(names).toEqual(['Skelicorn', 'Crystal Egg', 'Unicorn'])
    expect(urls[0].pathname).toBe('/api/v1/item-management/products')
    expect(urls[0].searchParams.get('gameId')).toBe('201')
  })

  it('a failed page throws: a partial order would rank wrongly', async () => {
    await expect(
      fetchProductOrder(async (u: URL) => {
        if (u.searchParams.get('pageIndex') === '2') throw new Error('blocked')
        return page(2, ['Skelicorn'])
      }),
    ).rejects.toThrow('blocked')
  })
})

describe('rankPetsByFeed', () => {
  const pets = [
    { id: 'u', name: 'Unicorn' },
    { id: 's', name: 'Skelicorn' },
    { id: 'r', name: 'Wooly Rhino' },
  ]

  it('ranks among pets only: eggs and potions push nothing down', () => {
    const ranks = rankPetsByFeed(['Crystal Egg', 'Skelicorn', 'Ride Potion', 'Unicorn'], pets)
    expect([...ranks]).toEqual([
      ['s', 1],
      ['u', 2],
    ])
  })

  it('matches by normalised name and the known spelling differences, first position wins', () => {
    const ranks = rankPetsByFeed(['UNICORN!', 'Woolly Rhino', 'Unicorn'], pets)
    expect([...ranks]).toEqual([
      ['u', 1],
      ['r', 2],
    ])
  })
})

describe('blendRanks', () => {
  it('near the top of both beats the top of one; a classic high on sellers still makes it', () => {
    const feed = new Map([
      ['new-hit', 1],
      ['both', 5],
      ['classic', 160],
    ])
    const sellers = new Map([
      ['classic', 2],
      ['both', 5],
      ['new-hit', 170],
    ])
    expect([...blendRanks(feed, sellers).keys()]).toEqual(['both', 'new-hit', 'classic'])
  })

  it('a pet on one list only still gets a rank, below one strong on both', () => {
    const ranks = blendRanks(new Map([['a', 1], ['b', 2]]), new Map([['a', 1], ['c', 2]]))
    expect(ranks.get('a')).toBe(1)
    expect([...ranks.keys()].sort()).toEqual(['a', 'b', 'c'])
  })

  it('ties break on the seller rank, then pet id, so a re-run gives the same ranks', () => {
    const feed = new Map([['y', 1], ['x', 1]])
    expect([...blendRanks(feed, new Map()).keys()]).toEqual(['x', 'y'])
    expect([...blendRanks(feed, new Map([['y', 3], ['x', 3]])).keys()]).toEqual(['x', 'y'])
  })
})

describe('rankPetsBySellers', () => {
  it('ranks by distinct sellers, not by copies from one seller', () => {
    const ranks = rankPetsBySellers([
      row('parrot', 's1'),
      row('parrot', 's2'),
      row('parrot', 's3'),
      row('cow', 's1'),
      row('cow', 's1'),
      row('cow', 's1'),
      row('cow', 's1'),
    ])
    expect(ranks.get('parrot')).toBe(1)
    expect(ranks.get('cow')).toBe(2)
  })

  it('ties break on listing count, then pet id, so a re-run gives the same ranks', () => {
    const rows = [row('b', 's1'), row('b', 's1'), row('a', 's2'), row('c', 's3')]
    expect([...rankPetsBySellers(rows)]).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ])
    expect([...rankPetsBySellers([...rows].reverse())]).toEqual([...rankPetsBySellers(rows)])
  })

  it('a listing without a seller counts as a listing, not a seller; rows without a pet are skipped', () => {
    const ranks = rankPetsBySellers([row('a', null), row('a', null), row('b', 's1'), { pet_id: null, seller_id: 's9' }])
    expect(ranks.get('b')).toBe(1)
    expect(ranks.get('a')).toBe(2)
    expect(ranks.size).toBe(2)
  })
})

describe('planRankUpdates', () => {
  it('writes only changed ranks; a pet off the market goes back to null', () => {
    const ranks = new Map([
      ['parrot', 1],
      ['owl', 2],
    ])
    const pets = [
      { id: 'parrot', name: 'Parrot', demand_rank: 1 },
      { id: 'owl', name: 'Owl', demand_rank: '5' },
      { id: 'dodo', name: 'Dodo', demand_rank: 3 },
      { id: 'cat', name: 'Cat', demand_rank: null },
    ]
    expect(planRankUpdates(pets, ranks)).toEqual([
      { id: 'owl', name: 'Owl', from: 5, to: 2 },
      { id: 'dodo', name: 'Dodo', from: 3, to: null },
    ])
  })
})
