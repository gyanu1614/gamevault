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
  waiting: [] as string[],
  visible: true,
  visibleFail: false,
  visibleCalls: 0,
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
vi.mock('./visible-offer', () => ({
  itemHasVisibleOffer: vi.fn(async () => {
    h.visibleCalls += 1
    if (h.visibleFail) throw new Error('read failed')
    return h.visible
  }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: async () => ({ data: h.claimed, error: null }),
    from(table: string) {
      const rows =
        table === 'games'
          ? [{ id: 'g-1', slug: 'adopt-me', name: 'Adopt Me', image_url: null }]
          : [{ id: 'u-1', email: 'buyer@example.com', username: 'buyer' }]
      let update: Record<string, unknown> = {}
      const b: Record<string, unknown> = {
        select: () => b,
        update: (row: Record<string, unknown>) => {
          update = row
          return b
        },
        in: (_c: string, ids: string[]) => {
          if (table === 'stock_alerts') ('due_at' in update ? h.waiting : h.released).push(...ids)
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
  h.waiting = []
  h.visible = true
  h.visibleFail = false
  h.visibleCalls = 0
})

describe('sendDueStockAlerts', () => {
  it('names the trait and links to it for a trait alert; the pet page for an any-trait alert', async () => {
    h.claimed = [
      { id: 'a-1', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: 'neon-fly-ride' },
      { id: 'a-2', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: null },
    ]
    expect(await sendDueStockAlerts()).toEqual({ sent: 2, failed: 0, waiting: 0 })
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
    expect(await sendDueStockAlerts()).toEqual({ sent: 0, failed: 1, waiting: 0 })
    expect(h.released).toEqual(['a-9'])
  })

  it("sends nothing for an item the site doesn't show: the alert goes back to waiting, still open", async () => {
    h.claimed = [{ id: 'a-3', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: null }]
    h.visible = false
    expect(await sendDueStockAlerts()).toEqual({ sent: 0, failed: 0, waiting: 1 })
    expect(h.sends).toEqual([])
    expect(h.waiting).toEqual(['a-3'])
    expect(h.released).toEqual([])
  })

  it("can't check: sends nothing and retries later, because the alert stays due", async () => {
    h.claimed = [{ id: 'a-4', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: null }]
    h.visibleFail = true
    expect(await sendDueStockAlerts()).toEqual({ sent: 0, failed: 1, waiting: 0 })
    expect(h.sends).toEqual([])
    expect(h.released).toEqual(['a-4'])
    expect(h.waiting).toEqual([])
  })

  it('checks each item and trait once, however many buyers wait for it', async () => {
    h.claimed = [
      { id: 'a-5', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: null },
      { id: 'a-6', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: null },
      { id: 'a-7', user_id: 'u-1', game_id: 'g-1', item_slug: 'parrot', variant: 'fly-ride' },
    ]
    await sendDueStockAlerts()
    expect(h.visibleCalls).toBe(2)
  })
})
