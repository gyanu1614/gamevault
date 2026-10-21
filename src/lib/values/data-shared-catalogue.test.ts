/**
 * Item pages share ONE cached copy of the game's catalogue (2026-10-20 usage
 * audit, A4).
 *
 * Each MM2 item page (213 at build) read the whole catalogue (~1,067 items
 * with their obtain JSON + every price) under that ITEM's tags. The tags are
 * part of the Data Cache key, so 213 identical queries were 213 entries and
 * 213 Supabase reads per pass. Now the catalogue is read under the game's
 * shared tag only (values:<game>, which every item page already carries), and
 * the page's OWN item + price is a one-row read under the item's tags, so a
 * published price change still refreshes that page at once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

type Call = { client: string; table: string; ops: string[] }
const calls: Call[] = []

const ITEMS = [
  { id: 'i1', slug: 'harvester', name: 'Harvester', kind: 'item', sort_order: 1, is_priced: true },
  { id: 'i2', slug: 'icebreaker', name: 'Icebreaker', kind: 'item', sort_order: 2, is_priced: true },
]
const PRICES_SHARED = [
  { item_id: 'i1', cheapest_usd: 10, sample_size: 5, source_count: 1 },
  { item_id: 'i2', cheapest_usd: 3, sample_size: 4, source_count: 1 },
]
// The item read sees today's price; the shared copy is a day old.
const PRICE_FRESH = { item_id: 'i1', cheapest_usd: 12, sample_size: 6, source_count: 1 }

function fakeClient(name: string) {
  return {
    from(table: string) {
      const call: Call = { client: name, table, ops: [] }
      calls.push(call)
      const api: any = {}
      for (const op of ['select', 'eq', 'in', 'order', 'gt', 'or', 'limit', 'range', 'maybeSingle']) {
        api[op] = (...args: unknown[]) => {
          call.ops.push(`${op}(${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`)
          if (op === 'maybeSingle') return Promise.resolve({ data: table === 'games' ? { id: 'g1' } : null, error: null })
          return api
        }
      }
      api.then = (resolve: (v: unknown) => void) => {
        const one = call.ops.includes('eq(slug,harvester)') || call.ops.includes('eq(item_id,i1)')
        if (table === 'values_items') return resolve({ data: one ? [ITEMS[0]] : ITEMS, error: null })
        if (table === 'values_prices') return resolve({ data: one ? [PRICE_FRESH] : PRICES_SHARED, error: null })
        return resolve({ data: [], error: null })
      }
      return api
    },
  }
}

vi.mock('@/lib/values/read-client', () => ({
  createValuesReadClient: ({ itemSlug }: { gameSlug: string; itemSlug?: string | null }) => fakeClient(itemSlug ? `item:${itemSlug}` : 'list'),
  createValueItemReadClient: (_g: string, itemSlug: string) => fakeClient(`item:${itemSlug}`),
  createValueGameSharedReadClient: () => fakeClient('shared'),
}))

import { getValueItems } from './data'

describe('getValueItems on an item page', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('reads the catalogue through the shared game client, never the item client', async () => {
    await getValueItems('murder-mystery-2', { itemSlug: 'harvester' })
    const catalogue = calls.filter((c) => (c.table === 'values_items' || c.table === 'values_prices') && !c.ops.some((o) => o.includes('harvester') || o.includes('i1')))
    expect(catalogue.length).toBeGreaterThan(0)
    expect(new Set(catalogue.map((c) => c.client))).toEqual(new Set(['shared']))
  })

  it("reads the page's own item and price under the item's tags, and that fresh price wins", async () => {
    const items = await getValueItems('murder-mystery-2', { itemSlug: 'harvester' })
    const own = calls.filter((c) => c.client === 'item:harvester')
    expect(own.map((c) => c.table).sort()).toEqual(['values_items', 'values_prices'])
    expect(items.find((i) => i.slug === 'harvester')?.price?.cheapestUsd).toBe(12)
    expect(items.find((i) => i.slug === 'icebreaker')?.price?.cheapestUsd).toBe(3)
    expect(items.map((i) => i.slug)).toEqual(['harvester', 'icebreaker'])
  })

  it('a list page still reads under the list client only', async () => {
    await getValueItems('murder-mystery-2')
    expect(new Set(calls.map((c) => c.client))).toEqual(new Set(['list']))
  })
})
