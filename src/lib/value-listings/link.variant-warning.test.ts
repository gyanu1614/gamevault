import { describe, expect, it, vi } from 'vitest'

// The real Adopt Me catalogue (title parser, aliases); only the DB reads are faked.
vi.mock('./catalogs', async (importOriginal) => {
  const real = await importOriginal<typeof import('./catalogs')>()
  return {
    ...real,
    loadValueCatalog: async () =>
      real.buildValueCatalog('adopt-me', { items: [{ slug: 'frost-dragon', name: 'Frost Dragon' }] }),
    loadOptionLabels: async () => ({ trait: { r: 'R', fr: 'FR', nfr: 'NFR' } }),
  }
})

const { linkListingsToValueItems } = await import('./link')

function fakeClient(rows: Array<Record<string, unknown>>) {
  const listings = {
    select: () => listings,
    in: async () => ({ data: rows, error: null }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }
  const games = { select: () => ({ in: async () => ({ data: [{ id: 'g-am', slug: 'adopt-me' }], error: null }) }) }
  return { from: (t: string) => (t === 'games' ? games : listings) }
}

const row = (id: string, title: string, trait?: string) => ({
  id,
  title,
  game_id: 'g-am',
  game_category_id: 'c-items',
  template_data: { 'pet-name': 'frost-dragon', ...(trait ? { trait } : {}) },
  value_matched_at: null,
})

describe('linkListingsToValueItems — Adopt Me variant warning', () => {
  it('reports a pick the title disagrees with, and keeps the pick', async () => {
    const out = await linkListingsToValueItems(fakeClient([row('a', 'FR Frost Dragon', 'r')]), ['a'])
    expect(out.variantMismatches).toEqual([
      { id: 'a', text: 'Your title says FR. Switch to Fly Ride?', switchTo: { value: 'fr', label: 'FR' } },
    ])
  })

  it('says nothing when they agree, when the title is silent, or when nothing is picked', async () => {
    const out = await linkListingsToValueItems(
      fakeClient([row('a', 'FR Frost Dragon', 'fr'), row('b', 'Frost Dragon', 'r'), row('c', 'FR Frost Dragon')]),
      ['a', 'b', 'c'],
    )
    expect(out.variantMismatches).toEqual([])
  })
})
