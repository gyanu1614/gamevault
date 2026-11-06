/**
 * The 2026-11-05 outage, in the reads behind an item page: Supabase answered 402
 * and `chroma-mortal` was saved as a 404 while the item still existed. A failed
 * read must throw out of these loaders (so the page keeps its last copy), and an
 * item that is really missing must still resolve to null (so the page 404s).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  cache: <T,>(fn: T) => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import { getValueCatalog, getItemsPair, itemPageExistsFresh } from './stock-server'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('item page reads', () => {
  it('a blocked database throws from the game lookup, instead of "no such game"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'exceed_cached_egress_quota' }, 402)))
    await expect(getItemsPair('murder-mystery-2')).rejects.toMatchObject({ name: 'PublicReadError', status: 402 })
  })

  it('a blocked database throws from the catalogue, instead of "no such item"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'exceed_cached_egress_quota' }, 402)))
    await expect(getValueCatalog('murder-mystery-2')).rejects.toMatchObject({ name: 'PublicReadError' })
  })

  it('a game that really does not exist still resolves to null, so the page 404s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json([])))
    await expect(getItemsPair('no-such-game')).resolves.toBeNull()
    await expect(getValueCatalog('no-such-game')).resolves.toBeNull()
  })
})

describe('itemPageExistsFresh: the check before a 404 is saved', () => {
  /** Answers each table the way the database would, and records what was asked. */
  const db = (rows: Record<string, unknown[]>) => {
    const asked: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const table = new URL(String(input)).pathname.split('/').pop()!
      asked.push(table)
      return json(rows[table] ?? [])
    }))
    return asked
  }
  const MM2 = { games: [{ id: 'g1', name: 'MM2', image_url: null }], game_categories: [{ id: 'p1', slug: 'buy-items', type: 'items' }] }

  it('says yes when the game, its items page and the item are all there', async () => {
    db({ ...MM2, values_items: [{ slug: 'emberbow' }] })
    await expect(itemPageExistsFresh('murder-mystery-2', 'buy-items', 'emberbow')).resolves.toBe(true)
  })

  it('says no for an item the game does not have', async () => {
    db({ ...MM2, values_items: [] })
    await expect(itemPageExistsFresh('murder-mystery-2', 'buy-items', 'nope')).resolves.toBe(false)
  })

  it('says no for a category that is not the game’s items page, without reading the item', async () => {
    const asked = db({ ...MM2, values_items: [{ slug: 'emberbow' }] })
    await expect(itemPageExistsFresh('murder-mystery-2', 'buy-accounts', 'emberbow')).resolves.toBe(false)
    expect(asked).not.toContain('values_items')
  })

  it('says no for an unknown game with one read', async () => {
    const asked = db({})
    await expect(itemPageExistsFresh('no-such-game', 'buy-items', 'emberbow')).resolves.toBe(false)
    expect(asked).toEqual(['games'])
  })

  it('a blocked database throws, so a failed check never becomes a 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'exceed_cached_egress_quota' }, 402)))
    await expect(itemPageExistsFresh('murder-mystery-2', 'buy-items', 'emberbow')).rejects.toMatchObject({ name: 'PublicReadError' })
  })
})

describe('getValueItemDescriptions', () => {
  it('a new offer gets a new cache entry, so it is never served a copy saved before it existed', async () => {
    const { unstable_cache } = await import('next/cache')
    const spy = vi.mocked(unstable_cache)
    spy.mockClear()
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const table = new URL(String(input)).pathname.split('/').pop()
      if (table === 'games') return json([{ id: 'g1', name: 'MM2', image_url: null }])
      if (table === 'game_categories') return json([{ id: 'p1', slug: 'buy-items', type: 'items' }])
      return json([{ id: 'new', description: 'Send your username' }])
    }))
    const { getValueItemDescriptions } = await import('./stock-server')
    await getValueItemDescriptions('murder-mystery-2', 'sunrise', ['old'])
    const after = await getValueItemDescriptions('murder-mystery-2', 'sunrise', ['old', 'new'])
    // The same offers in another order are the same entry.
    await getValueItemDescriptions('murder-mystery-2', 'sunrise', ['new', 'old'])
    const keys = spy.mock.calls.map((c) => (c[1] as string[]).join('|')).filter((k) => k.startsWith('value-item-descriptions'))
    expect(keys[0]).not.toBe(keys[1])
    expect(keys[1]).toBe(keys[2])
    expect(after.new).toBe('Send your username')
  })
})
