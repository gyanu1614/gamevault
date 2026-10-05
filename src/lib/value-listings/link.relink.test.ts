import { describe, expect, it, vi } from 'vitest'
import type { ValueCatalog } from './match'

// Catalogue AFTER the 2026-10-05 Adopt Me import: Fairy Bat Dragon now exists.
const AM: ValueCatalog = {
  gameSlug: 'adopt-me',
  items: [
    { slug: 'bat-dragon', name: 'Bat Dragon' },
    { slug: 'fairy-bat-dragon', name: 'Fairy Bat Dragon' },
  ],
  variants: [
    { key: 'nfr', names: ['NFR', 'Neon Fly Ride'] },
    { key: 'fr', names: ['FR', 'Fly Ride'] },
  ],
  identityKeys: ['pet-name'],
  variantKeys: ['variant'],
  defaultVariant: 'default',
}

vi.mock('./catalogs', () => ({
  loadValueCatalog: async () => ({ catalog: AM, items: [], mutations: [] }),
  loadOptionLabels: async () => ({}),
}))

const { reconcileValueRefs } = await import('./link')

function fakeClient(rows: Array<Record<string, unknown>>) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  const listings = {
    select: () => listings,
    eq: () => listings,
    is: () => listings,
    order: () => listings,
    limit: async () => ({ data: rows, error: null }),
    update: (patch: Record<string, unknown>) => ({
      eq: async (_col: string, id: string) => {
        updates.push({ id, patch })
        return { error: null }
      },
    }),
  }
  const games = { select: () => ({ in: async () => ({ data: [{ id: 'g-am', slug: 'adopt-me' }], error: null }) }) }
  return { client: { from: (t: string) => (t === 'games' ? games : listings) }, updates }
}

const base = { game_id: 'g-am', game_category_id: 'c-items', template_data: {}, value_matched_at: '2026-10-03T00:00:00Z' }

describe('reconcileValueRefs relink', () => {
  it('moves a link stored before its item existed, and refreshes both item pages', async () => {
    const { client, updates } = fakeClient([
      { ...base, id: 'fairy', title: 'Fairy Bat Dragon NFR', value_item_slug: 'bat-dragon', value_variant: 'nfr' },
    ])
    const out = await reconcileValueRefs(client, { relink: true })
    expect(updates).toHaveLength(1)
    expect(updates[0].patch.value_item_slug).toBe('fairy-bat-dragon')
    expect(out.relinked).toBe(1)
    expect(out.changedItems).toEqual([
      { gameSlug: 'adopt-me', itemSlug: 'bat-dragon' },
      { gameSlug: 'adopt-me', itemSlug: 'fairy-bat-dragon' },
    ])
  })

  it('does not rewrite a link that is already right', async () => {
    const { client, updates } = fakeClient([
      { ...base, id: 'bd', title: 'FR bat dragon |quick delivery| adopt me', value_item_slug: 'bat-dragon', value_variant: 'fr' },
    ])
    const out = await reconcileValueRefs(client, { relink: true })
    expect(updates).toHaveLength(0)
    expect(out.relinked).toBe(0)
    expect(out.changedItems).toEqual([])
  })
})
