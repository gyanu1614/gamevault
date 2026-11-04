/**
 * Notify Me dispatch: each claimed alert becomes one email that names what the
 * buyer waited for — the trait too, for a trait alert — and links to the pet
 * page with that trait picked. A failed send goes back in the queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  claimed: [] as Array<{ id: string; user_id: string; game_id: string; item_slug: string; variant: string | null }>,
  sends: [] as Array<{ to: string; itemName: string; url: string }>,
  failFor: null as string | null,
  released: [] as string[],
}))

vi.mock('server-only', () => ({}))
vi.mock('@vercel/functions', () => ({ waitUntil: () => {} }))
vi.mock('@/lib/email', () => ({}))
vi.mock('@/config/site', () => ({ SITE_URL: 'https://dropmarket.gg' }))
vi.mock('@/lib/email/stock-alert', () => ({
  sendStockAlertEmail: vi.fn(async (a: { to: string; itemName: string; url: string }) => {
    if (a.itemName === h.failFor) throw new Error('smtp down')
    h.sends.push({ to: a.to, itemName: a.itemName, url: a.url })
  }),
}))
vi.mock('@/lib/value-listings/stock-server', () => ({
  getValueCatalog: vi.fn(async () => ({ items: [{ slug: 'parrot', name: 'Parrot', imageUrl: null }], mutations: [] })),
  getItemsPair: vi.fn(async () => ({ categorySlug: 'buy-items' })),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: async () => ({ data: h.claimed, error: null }),
    from(table: string) {
      const rows =
        table === 'games'
          ? [{ id: 'g-1', slug: 'adopt-me', name: 'Adopt Me', image_url: null }]
          : [{ id: 'u-1', email: 'buyer@example.com', username: 'buyer' }]
      const b: Record<string, unknown> = {
        select: () => b,
        update: () => b,
        in: (_c: string, ids: string[]) => {
          if (table === 'stock_alerts') h.released.push(...ids)
          return b
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
      }
      return b
    },
  }),
}))

import { sendDueStockAlerts } from './dispatch'

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
  h.claimed = []
  h.sends = []
  h.failFor = null
  h.released = []
})

describe('sendDueStockAlerts', () => {
  it('names the trait and links to it for a trait alert; the pet page for an any-trait alert', async () => {
    h.claimed = [
      { id: 'a-1', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: 'neon-fly-ride' },
      { id: 'a-2', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: null },
    ]
    expect(await sendDueStockAlerts()).toEqual({ sent: 2, failed: 0 })
    expect(h.sends).toContainEqual({
      to: 'buyer@example.com',
      itemName: 'Neon Fly Ride Parrot',
      url: 'https://dropmarket.gg/adopt-me/buy-items/item/parrot/neon-fly-ride',
    })
    expect(h.sends).toContainEqual({ to: 'buyer@example.com', itemName: 'Parrot', url: 'https://dropmarket.gg/adopt-me/buy-items/item/parrot' })
  })

  it('puts an alert whose email failed back in the queue', async () => {
    h.claimed = [{ id: 'a-9', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: 'fly-ride' }]
    h.failFor = 'Fly Ride Parrot'
    expect(await sendDueStockAlerts()).toEqual({ sent: 0, failed: 1 })
    expect(h.released).toEqual(['a-9'])
  })
})
