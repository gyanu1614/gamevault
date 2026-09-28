/**
 * Admin orders list + stats (integration) — src/lib/actions/admin-orders.ts.
 * Runs as the fixture ADMIN's real session client, so RLS (is_admin()) is
 * exercised, not bypassed.
 *   · search finds an order by order number (any case / dashes), buyer
 *     username, seller shop name and listing title;
 *   · a term with ilike or PostgREST metacharacters never lists everything
 *     and never errors;
 *   · status filter takes the real statuses (delivering);
 *   · stats: counts + revenue/fees match SQL over the real status sets;
 *   · a non-admin caller is refused (requireAdmin's redirect is not swallowed).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any, admin: true }))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new Error('NEXT_REDIRECT')
    return { userId: 'admin' }
  },
}))

import { getOrders, getOrderStats } from '@/lib/actions/admin-orders'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CUR = 'USD'

let fx: Fixture | null = null
const createdOrderIds: string[] = []
let orderNumber = ''
let buyerUsername = ''
let listingTitle = ''
const shopName = `Guard Shop ${Date.now().toString(36)}`

function sql(q: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim()
}

async function ids(search: string, extra: Record<string, unknown> = {}) {
  const res = await getOrders({ search, limit: 100, ...extra })
  expect(res.success).toBe(true)
  return res.orders.map((o) => o.id)
}

describe.skipIf(!hasEnv)('admin orders: search, filters, stats (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    state.client = fx.admin.client

    const { data: o } = await fx.svc.from('orders').select('order_number').eq('id', fx.pendingOrderId).single()
    orderNumber = (o as any).order_number
    const { data: b } = await fx.svc.from('profiles').select('username').eq('id', fx.buyer.id).single()
    buyerUsername = (b as any).username
    const { data: l } = await fx.svc.from('listings').select('title').eq('id', fx.listingId).single()
    listingTitle = (l as any).title
    const { error } = await fx.svc.from('profiles').update({ shop_name: shopName }).eq('id', fx.seller.id)
    if (error) throw new Error(`shop_name: ${error.message}`)

    // A second order (another buyer: one pending order per buyer+listing)
    // moved to 'delivering' for the status filter + stats.
    const { data: ins, error: ie } = await fx.svc.from('orders').insert({
      buyer_id: fx.admin.id, seller_id: fx.seller.id, listing_id: fx.listingId, quantity: 1,
      unit_price: 3, subtotal: 3, platform_fee_rate: 2, payment_processing_fee_rate: 0,
      platform_fee: 0.06, payment_processing_fee: 0, total_amount: 3.06, seller_payout: 2.76,
      currency: CUR, status: 'pending', escrow_status: 'pending',
    }).select('id').single()
    if (ie) throw new Error(`order insert: ${ie.message}`)
    const id = (ins as any).id as string
    createdOrderIds.push(id)
    const { error: te } = await (fx.svc.rpc as any)('safedrop_transition', {
      p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null,
    })
    if (te) throw new Error(`charge: ${te.message}`)
    const { error: de } = await (fx.svc.rpc as any)('safedrop_transition', {
      p_order_id: id, p_event: 'SELLER_DELIVERING', p_dedupe_key: null, p_release_method: null, p_refund_minor: null,
    })
    if (de) throw new Error(`start delivery: ${de.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of createdOrderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', createdOrderIds)
    await fx.cleanup()
  }, 60_000)

  it('finds the order by order number in any case, with or without dashes', async () => {
    expect(await ids(orderNumber)).toContain(fx!.pendingOrderId)
    expect(await ids(orderNumber.toLowerCase().replace(/-/g, ''))).toContain(fx!.pendingOrderId)
  })

  it('finds orders by buyer username, seller shop name and listing title', async () => {
    expect(await ids(buyerUsername)).toContain(fx!.pendingOrderId)
    expect(await ids(shopName)).toContain(fx!.pendingOrderId)
    expect(await ids(listingTitle)).toContain(fx!.pendingOrderId)
  })

  it('metacharacters never list everything and never error', async () => {
    // '___' would match any 3+ char value if '_' were left as a wildcard
    // (a single '_' legitimately matches: fixture usernames contain one).
    for (const term of ['%', '___', '%%', '%_%', 'a,b)', 'x.in.(y)', '"', '\\']) {
      const res = await getOrders({ search: term, limit: 100 })
      expect(res.success, term).toBe(true)
      expect(res.orders.map((o) => o.id), term).not.toContain(fx!.pendingOrderId)
    }
  })

  it('status filter takes the real statuses', async () => {
    const delivering = await ids(shopName, { status: ['delivering'] })
    expect(delivering).toContain(createdOrderIds[0])
    expect(delivering).not.toContain(fx!.pendingOrderId)
    const pending = await ids(shopName, { status: ['pending'] })
    expect(pending).toContain(fx!.pendingOrderId)
    expect(pending).not.toContain(createdOrderIds[0])
  })

  it('stats match SQL over the real status sets', async () => {
    const res = await getOrderStats()
    expect(res.success).toBe(true)
    const [total, completed, inProgress, disputed, revenue, fees] = sql(`
      select count(*),
             count(*) filter (where status = 'completed'),
             count(*) filter (where status in ('paid','delivering','delivered')),
             count(*) filter (where status = 'disputed'),
             coalesce(sum(total_amount) filter (where status in ('paid','delivering','delivered','disputed','completed')), 0),
             coalesce(sum(platform_fee) filter (where status in ('paid','delivering','delivered','disputed','completed')), 0)
      from orders`).split('|')
    expect(res.stats.totalOrders).toBe(Number(total))
    expect(res.stats.completedOrders).toBe(Number(completed))
    expect(res.stats.pendingOrders).toBe(Number(inProgress))
    expect(res.stats.disputedOrders).toBe(Number(disputed))
    expect(res.stats.totalRevenue).toBeCloseTo(Number(revenue), 2)
    expect(res.stats.totalFees).toBeCloseTo(Number(fees), 2)
    // The delivering order counts as in progress.
    expect(Number(inProgress)).toBeGreaterThanOrEqual(1)
  })

  it('a non-admin caller is refused, not handed an empty success', async () => {
    state.admin = false
    try {
      await expect(getOrders({})).rejects.toThrow('NEXT_REDIRECT')
      await expect(getOrderStats()).rejects.toThrow('NEXT_REDIRECT')
    } finally {
      state.admin = true
    }
  })
})
