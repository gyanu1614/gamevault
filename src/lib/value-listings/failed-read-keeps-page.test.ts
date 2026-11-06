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
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

import { getValueCatalog, getItemsPair } from './stock-server'

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
