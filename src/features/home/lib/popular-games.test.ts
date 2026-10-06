/**
 * Homepage Popular Games chips read the ONE category system
 * (`game_categories`), never the Phase A `categories` mirror.
 */
import { describe, it, expect, vi } from 'vitest'

interface Call {
  table: string
  method: string
  args: unknown[]
}

/** Records every builder call with its arguments; resolves to the seeded rows. */
function createFakeClient(seed: Record<string, unknown[]>) {
  const calls: Call[] = []
  const from = (table: string) => {
    const builder: any = {}
    for (const method of ['select', 'eq', 'is', 'in', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return builder
      }
    }
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: seed[table] ?? [], error: null }).then(resolve, reject)
    calls.push({ table, method: 'from', args: [] })
    return builder
  }
  return { client: { from }, calls }
}

let fake: ReturnType<typeof createFakeClient>
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => fake.client,
  // Listing reads go through the tagged client (lib/listings/read-client.ts).
  createTaggedAnonClient: () => fake.client,
}))
vi.mock('@/lib/supabase/server', () => {
  throw new Error('the homepage must not import the cookie client')
})

import { getPopularGames } from './popular-games'

const GAMES = [
  { id: 'g-val', slug: 'valorant', name: 'Valorant' },
  { id: 'g-cs2', slug: 'cs2', name: 'CS2' },
]

describe('getPopularGames category chips', () => {
  it('reads enabled game_categories ordered by sort_order, never the legacy categories table', async () => {
    fake = createFakeClient({ games: GAMES, listings: [], game_categories: [] })
    await getPopularGames()

    const tables = new Set(fake.calls.map((c) => c.table))
    expect(tables.has('categories')).toBe(false)
    expect(tables.has('game_categories')).toBe(true)

    const gc = fake.calls.filter((c) => c.table === 'game_categories')
    expect(gc).toContainEqual({ table: 'game_categories', method: 'eq', args: ['is_enabled', true] })
    expect(gc).toContainEqual({
      table: 'game_categories',
      method: 'order',
      args: ['sort_order', { ascending: true }],
    })
    const select = gc.find((c) => c.method === 'select')
    expect(String(select?.args[0])).toMatch(/\btype\b/)
    expect(String(select?.args[0])).not.toMatch(/metadata/)
  })

  it('ranks chips by the type column, caps at three, and shortens labels by slug', async () => {
    fake = createFakeClient({
      games: GAMES,
      listings: [],
      // Already in sort_order, as the query returns them.
      game_categories: [
        { game_id: 'g-val', slug: 'boosting', name: 'Boosting', type: 'service' },
        { game_id: 'g-val', slug: 'coaching', name: 'Coaching', type: 'service' },
        { game_id: 'g-val', slug: 'buy-vp', name: 'VP (Valorant Points)', type: 'currency' },
        { game_id: 'g-val', slug: 'buy-accounts', name: 'Valorant Accounts', type: 'account' },
        { game_id: 'g-cs2', slug: 'buy-items', name: 'Skins & Items', type: 'items' },
        { game_id: 'g-cs2', slug: 'cases', name: 'Cases', type: 'items' },
        { game_id: 'g-other', slug: 'buy-robux', name: 'Robux', type: 'currency' },
      ],
    })
    const cards = await getPopularGames()
    const chips = Object.fromEntries(cards.map((c) => [c.slug, c.categories]))

    expect(chips.valorant).toEqual([
      { label: 'Accounts', href: '/valorant/buy-accounts' },
      { label: 'VP', href: '/valorant/buy-vp' },
      { label: 'Boosting', href: '/valorant/boosting' },
    ])
    // Same type keeps sort_order; a slug with no short form uses its name.
    expect(chips.cs2).toEqual([
      { label: 'Items', href: '/cs2/buy-items' },
      { label: 'Cases', href: '/cs2/cases' },
    ])
  })
})
