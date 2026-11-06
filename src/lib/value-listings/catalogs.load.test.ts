/**
 * PostgREST stops at 1,000 rows with no error, whatever .limit() asks for. On
 * 2026-11-04 Murder Mystery 2 had 1,108 items, so the catalogue read lost 108 of
 * them: their item pages 404'd and listings of them couldn't match. The loader
 * pages through every row, for every game.
 */
import { describe, it, expect } from 'vitest'
import { catalogHasItem, loadValueCatalog } from './catalogs'

const SERVER_CAP = 1000

/** The check before an item page saves a 404: one row, from the table the catalogue itself reads. */
describe('catalogHasItem', () => {
  function client(found: boolean, error: unknown = null) {
    const asked: string[] = []
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (c: string, v: unknown) => { asked.push(`${c}=${v}`); return b },
      not: (c: string, op: string, v: unknown) => { asked.push(`${c} not ${op} ${v}`); return b },
      limit: () => b,
      then: (resolve: (v: unknown) => unknown) => resolve({ data: found ? [{ slug: 'x' }] : [], error }),
    }
    return { asked, client: { from: (t: string) => { asked.push(t); return b } } }
  }

  it.each([
    ['steal-a-brainrot', 'sab_brainrot_market_catalog'],
    ['adopt-me', 'adopt_me_pets'],
    ['murder-mystery-2', 'values_items'],
  ])('%s asks %s for the one slug', async (slug, table) => {
    const c = client(true)
    await expect(catalogHasItem(c.client, { id: 'g1', slug }, 'x')).resolves.toBe(true)
    expect(c.asked).toContain(table)
    expect(c.asked).toContain('slug=x')
    expect(c.asked).toHaveLength(slug === 'murder-mystery-2' ? 4 : 2)
  })

  it('a values game keeps the catalogue’s own rule: its game only, and not switched off', async () => {
    const c = client(false)
    await expect(catalogHasItem(c.client, { id: 'g1', slug: 'murder-mystery-2' }, 'x')).resolves.toBe(false)
    expect(c.asked).toEqual(expect.arrayContaining(['game_id=g1', 'is_enabled not is false']))
  })

  it('a game with no catalogue has no items and asks nothing', async () => {
    const c = client(true)
    await expect(catalogHasItem(c.client, { id: 'g1', slug: 'fortnite' }, 'x')).resolves.toBe(false)
    expect(c.asked).toEqual([])
  })

  it('a failed read throws, it does not become "no such item"', async () => {
    const c = client(false, { message: 'down' })
    await expect(catalogHasItem(c.client, { id: 'g1', slug: 'adopt-me' }, 'x')).rejects.toMatchObject({ message: 'down' })
  })
})

/** A client that behaves like PostgREST: never more than 1,000 rows a request, rows in a stable order. */
function cappedClient(tables: Record<string, Array<Record<string, unknown>>>) {
  const requests: Array<{ table: string; from: number; to: number; ordered: boolean }> = []
  const client = {
    from(table: string) {
      let range: [number, number] | null = null
      let ordered = false
      let filter: { column: string; value: unknown } | null = null
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (column: string, value: unknown) => {
          filter = { column, value }
          return b
        },
        limit: () => b,
        order: () => {
          ordered = true
          return b
        },
        range: (from: number, to: number) => {
          range = [from, to]
          return b
        },
        then: (resolve: (v: unknown) => unknown) => {
          const rows = (tables[table] ?? []).filter((r) => !filter || r[filter.column] === filter.value)
          const [from, to] = range ?? [0, rows.length - 1]
          requests.push({ table, from, to, ordered })
          return resolve({ data: rows.slice(from, Math.min(to + 1, from + SERVER_CAP)), error: null })
        },
      }
      return b
    },
  }
  return { client, requests }
}

const rows = (n: number, extra: Record<string, unknown> = {}) =>
  Array.from({ length: n }, (_, i) => ({ slug: `item-${i}`, name: `Item ${i}`, rarity: 'Common', image_url: null, ...extra }))

describe('loadValueCatalog reads every row', () => {
  it('Murder Mystery 2: all 1,108 items, including the ones past the server cap', async () => {
    const { client } = cappedClient({ values_items: rows(1108, { game_id: 'g-1', is_enabled: true }) })
    const loaded = await loadValueCatalog(client, { id: 'g-1', slug: 'murder-mystery-2' })
    expect(loaded?.items).toHaveLength(1108)
    expect(loaded?.items.some((i) => i.slug === 'item-1107')).toBe(true)
  })

  it('Adopt Me past 1,000 rows: all of them', async () => {
    const { client } = cappedClient({ adopt_me_pets: rows(1234, { is_active: true, demand_rank: 1 }) })
    const loaded = await loadValueCatalog(client, { id: 'g-1', slug: 'adopt-me' })
    expect(loaded?.items).toHaveLength(1234)
  })

  it('Steal a Brainrot past 1,000 rows: all of them', async () => {
    const { client } = cappedClient({ sab_brainrot_market_catalog: rows(1500, { market_value_usd: 1 }), sab_mutations: [] })
    const loaded = await loadValueCatalog(client, { id: 'g-1', slug: 'steal-a-brainrot' })
    expect(loaded?.items).toHaveLength(1500)
  })

  it('pages in a stable order, or rows could repeat or go missing between pages', async () => {
    const { client, requests } = cappedClient({ values_items: rows(1108, { game_id: 'g-1', is_enabled: true }) })
    await loadValueCatalog(client, { id: 'g-1', slug: 'murder-mystery-2' })
    const items = requests.filter((r) => r.table === 'values_items')
    expect(items.map((r) => r.from)).toEqual([0, 1000])
    expect(items.every((r) => r.ordered)).toBe(true)
  })

  it('stops after a short page, so a small game costs one request', async () => {
    const { client, requests } = cappedClient({ values_items: rows(40, { game_id: 'g-1', is_enabled: true }) })
    await loadValueCatalog(client, { id: 'g-1', slug: 'murder-mystery-2' })
    expect(requests.filter((r) => r.table === 'values_items')).toHaveLength(1)
  })

  it('still drops a disabled item', async () => {
    const { client } = cappedClient({ values_items: [...rows(2, { game_id: 'g-1', is_enabled: true }), { slug: 'off', name: 'Off', game_id: 'g-1', is_enabled: false }] })
    const loaded = await loadValueCatalog(client, { id: 'g-1', slug: 'murder-mystery-2' })
    expect(loaded?.items.map((i) => i.slug)).toEqual(['item-0', 'item-1'])
  })
})
