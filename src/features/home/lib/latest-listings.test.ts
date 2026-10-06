/**
 * Homepage listings rail reads the ONE category system (`game_categories`
 * through listings.game_category_id), never the Phase A `categories` mirror
 * that Phase B drops.
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

import { getLatestListings } from './latest-listings'

const GAME = { id: 'g-am', slug: 'adopt-me', name: 'Adopt Me', image_url: '/games/adopt-me.png' }

function row(id: string, category: { slug: string; name: string; type: string }, extra: object = {}) {
  return {
    id,
    title: `Listing ${id}`,
    price: 1,
    images: [`https://cdn.example/${id}.png`],
    slug: `listing-${id}`,
    created_at: '2026-09-30T00:00:00Z',
    quantity: null,
    delivery_time: null,
    game: GAME,
    category,
    ...extra,
  }
}

describe('getLatestListings category join', () => {
  it('joins game_categories through the game_category_id FK, never the legacy categories table', async () => {
    fake = createFakeClient({ listings: [], category_configs: [] })
    await getLatestListings()

    expect(fake.calls.some((c) => c.table === 'categories')).toBe(false)

    const select = String(fake.calls.find((c) => c.table === 'listings' && c.method === 'select')?.args[0])
    // !inner keeps the old semantics: a listing with no category row is dropped, not null-joined.
    expect(select).toMatch(/category:game_categories!listings_game_category_id_fkey!inner\(slug, name, type\)/)
    expect(select).not.toMatch(/category:categories!/)
    expect(select).not.toMatch(/metadata/)
  })

  it('derives card type, label and currency icon from the type column', async () => {
    fake = createFakeClient({
      listings: [
        row('cur', { slug: 'buy-bucks', name: 'Bucks', type: 'currency' }, { images: null, quantity: 1000 }),
        row('acc', { slug: 'buy-accounts', name: 'Adopt Me Accounts', type: 'account' }, { images: null }),
        row('itm', { slug: 'buy-pets', name: 'Pets', type: 'items' }),
      ],
      category_configs: [{ game_id: 'g-am', icon: 'https://cdn.example/bucks.png' }],
    })
    const listings = await getLatestListings()
    const byId = new Map(listings.map((l) => [l.id, l]))

    expect(byId.get('cur')).toMatchObject({
      categoryType: 'currency',
      categoryLabel: 'Bucks',
      cardType: 'currency',
      bgImage: 'https://cdn.example/bucks.png',
      // Currency listings have no page: the card links the currency page.
      href: '/adopt-me/buy-bucks?offer=cur',
    })
    expect(byId.get('acc')).toMatchObject({ categoryType: 'account', cardType: 'account' })
    expect(byId.get('itm')).toMatchObject({
      categoryType: 'items',
      cardType: 'item',
      bgImage: 'https://cdn.example/itm.png',
    })

    // The currency-icon lookup is keyed off the type column too.
    expect(fake.calls).toContainEqual({ table: 'category_configs', method: 'in', args: ['game_id', ['g-am']] })
  })
})
