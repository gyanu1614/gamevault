import { describe, expect, it } from 'vitest'
import { filterRows, pageOf, summarize, type AdminValueRow } from './admin-values'

const row = (over: Partial<AdminValueRow>): AdminValueRow => ({
  slug: 'x',
  name: 'X',
  rarity: 'Secret',
  imageUrl: 'https://img',
  ourUsd: null,
  marketUsd: 5,
  tradeValue: null,
  hasHowToGet: true,
  addedAt: '2026-07-23T00:00:00Z',
  releasedAt: null,
  isNew: false,
  isVisible: true,
  href: '/g/values/x',
  ...over,
})

const rows = [
  row({ slug: 'slushi', name: 'Slushi Huski', isNew: true, marketUsd: null, addedAt: '2026-10-22T00:00:00Z' }),
  row({ slug: 'draculino', name: 'Draculino', isNew: true, imageUrl: null, isVisible: false, marketUsd: null, addedAt: '2026-10-22T00:00:01Z' }),
  row({ slug: 'tralalero', name: 'Tralalero Tralala', hasHowToGet: false }),
  row({ slug: 'listed', name: 'Listed Only', marketUsd: null, ourUsd: 3 }),
]

describe('admin values read model', () => {
  it('counts the problems the owner checks', () => {
    expect(summarize(rows)).toEqual({ total: 4, visible: 3, newItems: 2, noPrice: 2, noImage: 1, noHowToGet: 1 })
  })

  it('each view picks its rows, newest first; our own price counts as a price', () => {
    expect(filterRows(rows, 'new', '').map((r) => r.slug)).toEqual(['draculino', 'slushi'])
    expect(filterRows(rows, 'no-price', '').map((r) => r.slug)).toEqual(['draculino', 'slushi'])
    expect(filterRows(rows, 'no-image', '').map((r) => r.slug)).toEqual(['draculino'])
    expect(filterRows(rows, 'no-facts', '').map((r) => r.slug)).toEqual(['tralalero'])
    expect(filterRows(rows, 'hidden', '').map((r) => r.slug)).toEqual(['draculino'])
    expect(filterRows(rows, 'all', 'tral').map((r) => r.slug)).toEqual(['tralalero'])
  })

  it('pages 50 at a time and clamps a page out of range', () => {
    const many = Array.from({ length: 120 }, (_, i) => i)
    expect(pageOf(many, 3)).toMatchObject({ page: 3, totalPages: 3 })
    expect(pageOf(many, 3).rows).toHaveLength(20)
    expect(pageOf(many, 9).page).toBe(3)
    expect(pageOf([], 1)).toEqual({ rows: [], page: 1, totalPages: 1 })
  })
})
