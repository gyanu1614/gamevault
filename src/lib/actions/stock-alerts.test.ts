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
  emailLimited: false,
  catalog: ['frost-dragon'] as string[],
  live: false,
  openCount: 0,
  openRows: null as Array<{ id: string; item_slug: string; variant: string | null }> | null,
  calls: [] as Call[],
  dispatched: 0,
  visibleArgs: [] as unknown[][],
  visibleFail: false,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null }, error: null }) } }),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async (name: string) => ({ limited: h.limited || (name === 'stockAlertEmail' && h.emailLimited) })),
}))
vi.mock('@/lib/value-listings/stock-server', () => ({
  getValueCatalog: vi.fn(async () => ({
    items: h.catalog.map((slug) => ({ slug })),
    catalog: { variants: [{ key: 'fly-ride' }, { key: 'neon-fly-ride' }] },
  })),
}))
vi.mock('@/lib/stock-alerts/dispatch', () => ({ scheduleStockAlertDispatch: () => { h.dispatched += 1 } }))
vi.mock('@/lib/stock-alerts/visible-offer', () => ({
  itemHasVisibleOffer: vi.fn(async (...args: unknown[]) => {
    h.visibleArgs.push(args)
    if (h.visibleFail) throw new Error('read failed')
    return h.live
  }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      const call: Call = { table, ops: [] }
      h.calls.push(call)
      const result = () => {
        const op = call.ops[0]?.[0]
        if (table === 'games') return { data: { id: 'g-1' }, error: null }
        if (op === 'select')
          return { data: h.openRows ?? Array.from({ length: h.openCount }, (_, i) => ({ id: `a-${i}`, item_slug: `item-${i}`, variant: null })), error: null }
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

import { checkRateLimit } from '@/lib/security/rate-limit'
import { setStockAlert, clearStockAlert, listMyStockAlerts } from './stock-alerts'

const alertCalls = () => h.calls.filter((c) => c.table === 'stock_alerts')
const eqs = (c: Call) => c.ops.filter(([m]) => m === 'eq').map(([, a]) => a)
const iss = (c: Call) => c.ops.filter(([m]) => m === 'is').map(([, a]) => a)
const upsertRow = () => alertCalls().flatMap((c) => c.ops).find(([m]) => m === 'upsert')?.[1][0] as Record<string, unknown> | undefined

beforeEach(() => {
  h.userId = 'u-1'
  h.limited = false
  h.emailLimited = false
  h.catalog = ['frost-dragon']
  h.live = false
  h.openCount = 0
  h.openRows = null
  h.calls = []
  h.dispatched = 0
  h.visibleArgs = []
  h.visibleFail = false
  vi.mocked(checkRateLimit).mockClear()
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

  it('past the hourly email budget, an alert on a listed item waits for the next listing and sends nothing now', async () => {
    h.live = true
    h.emailLimited = true
    expect(await setStockAlert('adopt-me', 'frost-dragon')).toEqual({ ok: true })
    expect(upsertRow()).toMatchObject({ due_at: null, notified_at: null })
    expect(h.dispatched).toBe(0)
  })

  it('an alert on an item nobody lists spends none of the email budget', async () => {
    h.emailLimited = true
    expect(await setStockAlert('adopt-me', 'frost-dragon')).toEqual({ ok: true })
    expect(vi.mocked(checkRateLimit).mock.calls.filter(([name]) => (name as string) === 'stockAlertEmail')).toEqual([])
  })

  it('caps open alerts per account', async () => {
    h.openCount = 200
    expect((await setStockAlert('adopt-me', 'frost-dragon')).ok).toBe(false)
    expect(alertCalls().some((c) => c.ops.some(([m]) => m === 'upsert'))).toBe(false)
  })
  it('an item alert (no trait) stores variant null and checks any listing of the item', async () => {
    await setStockAlert('adopt-me', 'frost-dragon')
    expect(upsertRow()).toMatchObject({ variant: null })
    expect(h.visibleArgs[0]).toEqual(['adopt-me', 'frost-dragon', null])
  })

  it('a trait alert stores the trait and only that trait counts as listed', async () => {
    h.live = true
    expect(await setStockAlert('adopt-me', 'frost-dragon', 'neon-fly-ride')).toEqual({ ok: true })
    expect(upsertRow()).toMatchObject({ user_id: 'u-1', item_slug: 'frost-dragon', variant: 'neon-fly-ride' })
    expect(h.visibleArgs[0]).toEqual(['adopt-me', 'frost-dragon', 'neon-fly-ride'])
  })

  it('refuses a trait the game does not have, and a malformed one before any read', async () => {
    expect(await setStockAlert('adopt-me', 'frost-dragon', 'golden')).toEqual({ ok: false, error: 'That item could not be found.' })
    expect(upsertRow()).toBeUndefined()
    h.calls = []
    expect(await setStockAlert('adopt-me', 'frost-dragon', "fr'; --")).toEqual({ ok: false, error: 'That item could not be found.' })
    expect(h.calls).toEqual([])
  })
})

describe('clearStockAlert / listMyStockAlerts', () => {
  it('deletes only the session user’s item alert (variant null)', async () => {
    expect(await clearStockAlert('adopt-me', 'frost-dragon')).toEqual({ ok: true })
    const del = alertCalls().find((c) => c.ops.some(([m]) => m === 'delete'))!
    expect(eqs(del)).toEqual([['user_id', 'u-1'], ['game_id', 'g-1'], ['item_slug', 'frost-dragon']])
    expect(iss(del)).toEqual([['variant', null]])
  })

  it('deletes only that trait’s alert', async () => {
    await clearStockAlert('adopt-me', 'frost-dragon', 'fly-ride')
    const del = alertCalls().find((c) => c.ops.some(([m]) => m === 'delete'))!
    expect(eqs(del)).toEqual([['user_id', 'u-1'], ['game_id', 'g-1'], ['item_slug', 'frost-dragon'], ['variant', 'fly-ride']])
  })

  it('lists item alerts by slug and trait alerts as slug:trait', async () => {
    h.openRows = [
      { id: 'a', item_slug: 'parrot', variant: null },
      { id: 'b', item_slug: 'parrot', variant: 'neon-fly-ride' },
    ]
    expect(await listMyStockAlerts('adopt-me')).toEqual({ ok: true, slugs: ['parrot', 'parrot:neon-fly-ride'] })
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
