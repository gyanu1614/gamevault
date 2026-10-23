import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/blog/db', () => ({ getGamePosts: async () => [{ title: 'How To Get Bat Dragon', slug: 'bat-dragon' }] }))
vi.mock('@/lib/values/data', () => ({ getValueItems: async () => [] }))
vi.mock('../values/_sabBrainrots', () => ({ getSabBrainrots: async () => [] }))
vi.mock('../values/_generic/valueListRows', () => ({ getValueListRows: async () => ({ rows: [], hasTrends: false }) }))
vi.mock('../values/_adoptMeData', () => ({
  getAdoptMePets: async () => [
    { slug: 'owl', name: 'Owl', rarity: 'legendary', imageUrl: 'o.webp', demandRank: 9, values: { FR: { cashUsd: 30 } } },
    { slug: 'bat-dragon', name: 'Bat Dragon', rarity: 'legendary', imageUrl: 'b.webp', demandRank: 1, values: { FR: { cashUsd: 290 } } },
    { slug: 'dog', name: 'Dog', rarity: 'common', imageUrl: null, demandRank: null, values: { N: { cashUsd: 0.5 } } },
  ],
}))

import { loadSearchIndex } from './_searchIndex'

describe('navbar search index', () => {
  it('Adopt Me: pets most in demand first, labelled by rarity, with the Fly Ride price; then the guides', async () => {
    const ix = await loadSearchIndex('adopt-me')
    expect(ix?.name).toBe('Adopt Me')
    expect(ix?.items.map((i) => [i.n, i.p, i.h])).toEqual([
      ['Bat Dragon', 290, '/adopt-me/values/bat-dragon'],
      ['Owl', 30, '/adopt-me/values/owl'],
      ['Dog', 0.5, '/adopt-me/values/dog'],
    ])
    expect(ix?.items[0].k).toMatch(/Legendary Pet/)
    expect(ix?.items[0]).not.toHaveProperty('rank')
    expect(ix?.guides).toEqual([{ t: 'How To Get Bat Dragon', h: '/adopt-me/blog/bat-dragon' }])
  })

  it('a game with no values hub and no guides has no index', async () => {
    expect(await loadSearchIndex('blox-fruits')).toBeNull()
  })
})
