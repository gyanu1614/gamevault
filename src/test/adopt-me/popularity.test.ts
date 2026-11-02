import { describe, expect, it } from 'vitest'
import { planRankUpdates, rankPetsBySellers } from '../../../scripts/lib/adoptme-popularity.mjs'

// Popularity = distinct sellers listing a pet (owner, 2026-11-01).
const row = (pet_id: string, seller_id: string | null) => ({ pet_id, seller_id })

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
