import { describe, expect, it, vi } from 'vitest'

vi.mock('./catalogs', async (importOriginal) => {
  const real = await importOriginal<typeof import('./catalogs')>()
  return {
    ...real,
    loadValueCatalog: async () =>
      real.buildValueCatalog('adopt-me', {
        items: [
          { slug: 'frost-dragon', name: 'Frost Dragon' },
          { slug: 'owl', name: 'Owl' },
        ],
      }),
    loadOptionLabels: async () => ({ trait: { r: 'R', fr: 'FR', nfr: 'NFR' } }),
  }
})

const { findVariantMismatches, switchTraitPicks } = await import('./variant-mismatches')

const LISTINGS = [
  { id: 'a', title: 'FR Frost Dragon | Adopt Me', seller_id: 's1', game_category_id: 'gc', value_item_slug: 'frost-dragon', template_data: { 'pet-name': 'frost-dragon', trait: 'r' } },
  { id: 'b', title: 'FR Owl', seller_id: 's1', game_category_id: 'gc', value_item_slug: 'owl', template_data: { trait: 'fr' } },
  { id: 'c', title: 'Alley Cat R', seller_id: 's2', game_category_id: 'gc', value_item_slug: null, template_data: { trait: 'r' } },
  { id: 'd', title: 'Frost Dragon FR/NFR', seller_id: 's2', game_category_id: 'gc', value_item_slug: 'frost-dragon', template_data: { trait: 'r' } },
]

function fakeClient() {
  const calls: string[] = []
  const updates: Array<{ id: string; patch: Record<string, unknown>; guard: unknown }> = []
  const listings = () => {
    const q: Record<string, any> = {}
    for (const m of ['select', 'eq', 'not', 'order', 'gt', 'in']) q[m] = (...a: unknown[]) => (calls.push(`${m}:${a.map(String).join(',')}`), q)
    q.limit = async () => ({ data: LISTINGS, error: null })
    q.update = (patch: Record<string, unknown>) => {
      const u: Record<string, any> = { id: '', guard: null }
      u.eq = (col: string, v: unknown) => {
        if (col === 'id') u.id = v
        else if (col === 'template_data->>trait') u.guard = v
        return u
      }
      u.select = async () => (updates.push({ id: u.id, patch, guard: u.guard }), { data: [{ id: u.id }], error: null })
      return u
    }
    return q
  }
  const games = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'g-am', slug: 'adopt-me' }, error: null }) }) }) }
  return { client: { from: (t: string) => (t === 'games' ? games : listings()) }, calls, updates }
}

describe('findVariantMismatches', () => {
  it('lists active Adopt Me listings whose title names another variant than the pick', async () => {
    const { client, calls } = fakeClient()
    const rows = await findVariantMismatches(client)
    expect(rows.map((r) => r.id)).toEqual(['a'])
    expect(rows[0]).toMatchObject({
      title: 'FR Frost Dragon | Adopt Me',
      pickedLabel: 'R',
      titleSays: 'Fly Ride',
      switchTo: { value: 'fr', label: 'FR' },
      text: 'Your title says FR. Switch to Fly Ride?',
    })
    // the index-friendly filter: one game, active only, a trait picked
    expect(calls).toContain('eq:game_id,g-am')
    expect(calls).toContain('eq:status,active')
    expect(calls).toContain('not:template_data->>trait,is,null')
  })
})

describe('switchTraitPicks', () => {
  it('writes the choice the title names, guarded on the pick it saw', async () => {
    const { client, updates } = fakeClient()
    const rows = await findVariantMismatches(client)
    const out = await switchTraitPicks(client, rows)
    expect(out).toEqual({ fixed: ['a'], skipped: [], errors: [] })
    expect(updates).toEqual([
      { id: 'a', patch: { template_data: { 'pet-name': 'frost-dragon', trait: 'fr' } }, guard: 'r' },
    ])
  })
})
