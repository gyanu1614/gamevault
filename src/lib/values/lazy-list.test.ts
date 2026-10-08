import { describe, it, expect } from 'vitest'
import { unpack } from '@/lib/serialize/columnar'
import { countFacets, initialValueList, INITIAL_ROWS_MAX, valueRowsUrl } from './lazy-list'

describe('initialValueList', () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ slug: `p${i}`, rarity: i % 2 ? 'Godly' : 'Ancient' }))

  it('carries one page of rows, never the whole list', () => {
    const init = initialValueList(rows, { pageSize: 25, facets: {} })
    expect(unpack<unknown[]>(init.rows)).toHaveLength(25)
    expect(init.total).toBe(500)
    expect(unpack<unknown[]>(initialValueList(rows, { pageSize: 999, facets: {} }).rows)).toHaveLength(INITIAL_ROWS_MAX)
  })

  it('keeps the display order it is given', () => {
    const init = initialValueList(rows, { pageSize: 3, facets: {} })
    expect(unpack<{ slug: string }[]>(init.rows).map((r) => r.slug)).toEqual(['p0', 'p1', 'p2'])
  })

  it('counts facets for the toolbar', () => {
    expect(countFacets(rows, { rarity: (r) => r.rarity })).toEqual({ rarity: { Ancient: 250, Godly: 250 } })
  })

  it('points at the game rows file', () => {
    expect(valueRowsUrl('adopt-me')).toBe('/adopt-me/values/rows.json')
  })
})
