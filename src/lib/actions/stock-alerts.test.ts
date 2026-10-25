/**
 * Notify Me actions: the session decides WHO, every service-role write and
 * read is scoped to that user id, inputs are slug-checked before anything
 * runs, the item must be in the game's catalogue, and the per-user budget
 * applies. The DB side (posture, trigger, claim) is
 * src/test/guards/stock-alerts.guard.integration.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Call = { table: string; ops: Array<[string, unknown[]]> }
const h = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  limited: false,
  catalog: ['frost-dragon'] as string[],
  live: false,
  openCount: 0,
  calls: [] as Call[],
  dispatched: 0,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null }, error: null }) } }),
}))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: vi.fn(async () => ({ limited: h.limited })) }))
vi.mock('@/lib/value-listings/stock-server', () => ({
  getValueCatalog: vi.fn(async () => ({ items: h.catalog.map((slug) => ({ slug })) })),
}))
vi.mock('@/lib/stock-alerts/dispatch', () => ({ scheduleStockAlertDispatch: () => { h.dispatched += 1 } }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      const call: Call = { table, ops: [] }
      h.calls.push(call)
      const result = () => {
        const op = call.ops[0]?.[0]
        if (table === 'games') return { data: { id: 'g-1' }, error: null }
        if (table === 'listings') return { data: h.live ? [{ id: 'l-1' }] : [], error: null }
        if (op === 'select') return { data: Array.from({ length: h.openCount }, (_, i) => ({ id: `a-${i}`, item_slug: `item-${i}` })), error: null }
        return { data: null, error: null }
      }
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'in', 'limit', 'upsert', 'delete', 'maybeSingle']) {
        builder[m] = (...args: unknown[]) => { call.ops.push([m, args]); return builder }
      }
      builder.then = (resolve: (v: unknown) => unknown) => resolve(result())
      return builder
    },
  }),
}))

import { setStockAlert, clearStockAlert, listMyStockAlerts } from './stock-alerts'

const alertCalls = () => h.calls.filter((c) => c.table === 'stock_alerts')
const eqs = (c: Call) => c.ops.filter(([m]) => m === 'eq').map(([, a]) => a)

beforeEach(() => {
  h.userId = 'u-1'
  h.limited = false
  h.catalog = ['frost-dragon']
  h.live = false
  h.openCount = 0
  h.calls = []
  h.dispatched = 0
})

describe('setStockAlert', () => {
  it('refuses a malformed slug before touching the session or the DB', async () => {
    expect(await setStockAlert('adopt-me', "x'; drop table")).toEqual({ ok: false, error: 'That item could not be found.' })
    expect(h.calls).toEqual([])
  })

  it('asks a signed-out visitor to sign in and writes nothing', async () => {
    h.userId = null
    expect(await setStockAlert('adopt-me', 'frost-dragon')).toEqual({ ok: false, error: 'Sign in to get an alert.' })
    expect(alertCalls()).toEqual([])
  })

  it('stops at the per-user budget', async () => {
    h.limited = true
    expect((await setStockAlert('adopt-me', 'frost-dragon')).ok).toBe(false)
    expect(alertCalls()).toEqual([])
  })

  it('refuses an item that is not in the game catalogue', async () => {
    expect(await setStockAlert('adopt-me', 'made-up-pet')).toEqual({ ok: false, error: 'That item could not be found.' })
    expect(alertCalls().some((c) => c.ops.some(([m]) => m === 'upsert'))).toBe(false)
  })

  it('upserts one row for the SESSION user, not due while nothing is listed', async () => {
    expect(await setStockAlert('adopt-me', 'frost-dragon')).toEqual({ ok: true })
    const upsert = alertCalls().flatMap((c) => c.ops).find(([m]) => m === 'upsert')!
    expect(upsert[1][0]).toMatchObject({ user_id: 'u-1', game_id: 'g-1', item_slug: 'frost-dragon', due_at: null, notified_at: null })
    expect(h.dispatched).toBe(0)
  })

  it('an item already listed is due at once and the send is scheduled', async () => {
    h.live = true
    await setStockAlert('adopt-me', 'frost-dragon')
    const upsert = alertCalls().flatMap((c) => c.ops).find(([m]) => m === 'upsert')!
    expect((upsert[1][0] as { due_at: string | null }).due_at).not.toBeNull()
    expect(h.dispatched).toBe(1)
  })

  it('caps open alerts per account', async () => {
    h.openCount = 200
    expect((await setStockAlert('adopt-me', 'frost-dragon')).ok).toBe(false)
    expect(alertCalls().some((c) => c.ops.some(([m]) => m === 'upsert'))).toBe(false)
  })
})

describe('clearStockAlert / listMyStockAlerts', () => {
  it('deletes only the session user’s row for that item', async () => {
    expect(await clearStockAlert('adopt-me', 'frost-dragon')).toEqual({ ok: true })
    const del = alertCalls().find((c) => c.ops.some(([m]) => m === 'delete'))!
    expect(eqs(del)).toEqual([['user_id', 'u-1'], ['game_id', 'g-1'], ['item_slug', 'frost-dragon']])
  })

  it('lists the session user’s open alerts only', async () => {
    h.openCount = 2
    expect(await listMyStockAlerts('adopt-me')).toEqual({ ok: true, slugs: ['item-0', 'item-1'] })
    expect(eqs(alertCalls()[0])).toEqual([['user_id', 'u-1'], ['game_id', 'g-1']])
  })

  it('a signed-out visitor has no alerts and causes no reads', async () => {
    h.userId = null
    expect(await listMyStockAlerts('adopt-me')).toEqual({ ok: true, slugs: [] })
    expect(h.calls).toEqual([])
  })
})
