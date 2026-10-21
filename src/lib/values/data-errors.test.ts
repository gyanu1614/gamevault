import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 2026-10-20 outage: the database timed out, the values loaders returned
 * "nothing", every item looked missing and ISR cached a 404 for the page's
 * whole window. A read error must THROW (Next keeps serving the last good
 * page); only a game or item that truly doesn't exist may come back empty.
 */

type Result = { data: unknown; error: { message: string } | null }
let gamesResult: Result
let itemsResult: Result

/** A PostgREST-ish builder: every filter returns itself; awaiting it (or maybeSingle) resolves the result. */
function builder(result: () => Result) {
  const b: any = {}
  for (const m of ['select', 'eq', 'in', 'order', 'range', 'neq', 'gte', 'lte', 'limit']) b[m] = () => b
  b.maybeSingle = () => Promise.resolve(result())
  b.then = (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad)
  return b
}

vi.mock('@/lib/values/read-client', () => ({
  createValuesReadClient: () => ({
    from: (table: string) => builder(() => (table === 'games' ? gamesResult : itemsResult)),
  }),
}))

beforeEach(() => {
  gamesResult = { data: { id: 'g1' }, error: null }
  itemsResult = { data: [], error: null }
})

describe('values loaders on a database error', () => {
  it('a games read error throws instead of reading as "no such game"', async () => {
    const { getValueItems } = await import('./data')
    gamesResult = { data: null, error: { message: 'canceling statement due to statement timeout' } }
    await expect(getValueItems('murder-mystery-2', { itemSlug: 'harvester' })).rejects.toThrow(/games read failed/)
  })
  it('an items read error throws instead of returning an empty list', async () => {
    const { getValueItems } = await import('./data')
    itemsResult = { data: null, error: { message: 'connection timeout' } }
    await expect(getValueItems('murder-mystery-2')).rejects.toThrow(/values read failed/)
  })
  it('a game that truly does not exist is still an empty list (a real 404)', async () => {
    const { getValueItems } = await import('./data')
    gamesResult = { data: null, error: null }
    await expect(getValueItems('no-such-game')).resolves.toEqual([])
  })
})
