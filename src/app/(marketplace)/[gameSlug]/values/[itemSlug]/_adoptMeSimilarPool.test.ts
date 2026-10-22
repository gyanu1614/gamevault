/**
 * Every Adopt Me pet page reads the SAME similar-pets pool (2026-10-20 usage
 * audit, A4): every page-having pet and every Fly Ride value, ~1,600 rows. It
 * was read under each pet's own tags and with `.neq('slug', <this pet>)`, so
 * 500 pages made 500 different queries and 500 cache entries. Now the pool
 * query is identical on every page (shared game client, no per-pet filter);
 * the current pet is dropped in memory.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const calls: { client: string; table: string; ops: string[] }[] = []
const PETS = [
  { id: 'p1', slug: 'frost-dragon', name: 'Frost Dragon', image_url: null, rarity: 'legendary' },
  { id: 'p2', slug: 'shadow-dragon', name: 'Shadow Dragon', image_url: null, rarity: 'legendary' },
  { id: 'p3', slug: 'cat', name: 'Cat', image_url: null, rarity: 'common' },
]
const FR = [
  { pet_id: 'p1', cheapest_usd: 20, cash_value_usd: null, trade_value: 100 },
  { pet_id: 'p2', cheapest_usd: 25, cash_value_usd: null, trade_value: 120 },
  { pet_id: 'p3', cheapest_usd: 1, cash_value_usd: null, trade_value: 2 },
]
function fakeClient(name: string) {
  return {
    from(table: string) {
      const call = { client: name, table, ops: [] as string[] }
      calls.push(call)
      const api: any = {}
      for (const op of ['select', 'eq', 'neq', 'in', 'order', 'gt', 'or', 'limit', 'range']) {
        api[op] = (...args: unknown[]) => (call.ops.push(`${op}(${args.join(',')})`), api)
      }
      api.then = (resolve: (v: unknown) => void) => resolve({ data: table === 'adopt_me_pets' ? PETS : FR, error: null })
      return api
    },
  }
}
vi.mock('@/lib/values/read-client', () => ({
  createValueItemReadClient: (_g: string, item: string) => fakeClient(`item:${item}`),
  createValueListReadClient: () => fakeClient('list'),
  createValueGameSharedReadClient: () => fakeClient('shared'),
}))

import { getSimilarPets } from './_adoptMePetData'

describe('getSimilarPets', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('reads the pool through the shared game client with no per-pet filter', async () => {
    await getSimilarPets('legendary', 'frost-dragon', 20)
    expect(new Set(calls.map((c) => c.client))).toEqual(new Set(['shared']))
    expect(calls.flatMap((c) => c.ops).some((o) => o.includes('frost-dragon'))).toBe(false)
  })

  it('never offers the current pet, and still ranks same rarity first', async () => {
    const { similar, pool } = await getSimilarPets('legendary', 'frost-dragon', 20)
    expect(pool.map((p) => p.slug)).not.toContain('frost-dragon')
    expect(similar[0].slug).toBe('shadow-dragon')
  })
})
