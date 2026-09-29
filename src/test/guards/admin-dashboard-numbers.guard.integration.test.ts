/**
 * Admin dashboard + analytics numbers (integration) —
 * getDashboardStats (src/lib/actions/admin-dashboard.ts) and
 * getAnalyticsData (src/lib/actions/admin-analytics.ts).
 * Runs as the fixture ADMIN's real session client, so RLS (is_admin()) is
 * exercised, not bypassed.
 *   · seeds one order per real status (with buyer + seller fees), a last-month
 *     order and 1,001 paid orders, so every sum crosses PostgREST's silent
 *     1000-row cap;
 *   · seeds one dispute per dispute_status_enum value;
 *   · every count and sum equals SQL over the real status sets:
 *       collected   = paid, delivering, delivered, disputed, completed
 *       in progress = paid, delivering, delivered
 *       open dispute = anything not resolved_* / closed;
 *   · platform revenue = buyer fees (marketplace + processing + legacy tier)
 *     + seller fee (subtotal − seller_payout);
 *   · a non-admin caller is refused (requireAdmin's redirect is not swallowed).
 * Day / month boundaries are UTC (what Vercel serves).
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

import { getDashboardStats } from '@/lib/actions/admin-dashboard'
import { getAnalyticsData } from '@/lib/actions/admin-analytics'
import { OPEN_DISPUTE_STATUSES, FINISHED_DISPUTE_STATUSES } from '@/lib/admin/status-sets'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const COLLECTED = `('paid','delivering','delivered','disputed','completed')`
const IN_PROGRESS = `('paid','delivering','delivered')`
const FINISHED = `('resolved_buyer_favor','resolved_seller_favor','resolved_partial','closed')`
const PLATFORM = `(platform_fee + payment_processing_fee + vaultshield_tier_fee + (subtotal - seller_payout))`
const TODAY = `date_trunc('day', now(), 'UTC')`
const MONTH = `date_trunc('month', now(), 'UTC')`
const PREV_MONTH = `(date_trunc('month', now(), 'UTC') - interval '1 month')`

const BULK = 1001

let fx: Fixture | null = null

function sql(q: string): string[] {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim().split('|')
}

/** Fee-bearing order: $10 item, 2% buyer fee, $0.50 processing, 8% seller fee. */
function order(status: string, escrow: string, extra: Record<string, unknown> = {}) {
  return {
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 10, subtotal: 10, platform_fee_rate: 2, payment_processing_fee_rate: 5,
    platform_fee: 0.2, payment_processing_fee: 0.5, total_amount: 10.7, seller_payout: 9.2,
    seller_commission_pct: 8, currency: 'USD', status, escrow_status: escrow, ...extra,
  }
}

async function deleteFixtureDisputes() {
  if (!fx) return
  const { error } = await fx.svc.from('disputes').delete().in('buyer_id', [fx.buyer.id, fx.admin.id])
  if (error) throw new Error(`disputes cleanup: ${error.message}`)
}

describe.skipIf(!hasEnv)('admin dashboard + analytics numbers (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    state.client = fx.admin.client

    const now = new Date()
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5 * 86_400_000).toISOString()
    const rows = [
      order('paid', 'held'),
      order('delivering', 'held'),
      order('delivered', 'held'),
      order('disputed', 'frozen'),
      order('completed', 'released', { completed_at: now.toISOString() }),
      // Money that was never collected or was returned: not revenue.
      order('cancelled', 'pending', { total_amount: 500, subtotal: 499.3, unit_price: 499.3 }),
      order('refunded', 'refunded', { total_amount: 700, subtotal: 699.3, unit_price: 699.3 }),
      // A second buyer (distinct buyers ≠ orders) and a last-month sale.
      order('completed', 'released', { buyer_id: fx.admin.id, completed_at: lastMonth, created_at: lastMonth }),
      // 1,001 paid $1 orders: one response would stop at 1000.
      ...Array.from({ length: BULK }, () => order('paid', 'held', {
        unit_price: 1, subtotal: 1, platform_fee: 0.02, payment_processing_fee: 0.05,
        total_amount: 1.07, seller_payout: 0.92,
      })),
    ]
    // Rows differ in keys (completed_at, created_at): absent keys take the
    // column default, not null.
    const { data: ins, error } = await fx.svc.from('orders').insert(rows, { defaultToNull: false }).select('id')
    if (error) throw new Error(`orders insert: ${error.message}`)
    const orderIds = (ins as any[]).map((r) => r.id as string)

    // One dispute per enum value; two open ones and one finished one urgent.
    const disputes = [...OPEN_DISPUTE_STATUSES, ...FINISHED_DISPUTE_STATUSES].map((status, i) => ({
      transaction_id: orderIds[i], buyer_id: fx!.buyer.id, seller_id: fx!.seller.id,
      reason: 'other', title: `guard ${status}`, description: 'guard test', disputed_amount: 1,
      status, priority: ['escalated', 'awaiting_seller_response', 'resolved_partial'].includes(status) ? 'urgent' : 'normal',
      resolved_at: (FINISHED_DISPUTE_STATUSES as readonly string[]).includes(status) ? now.toISOString() : null,
    }))
    const { error: de } = await fx.svc.from('disputes').insert(disputes)
    if (de) throw new Error(`disputes insert: ${de.message}`)
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    await deleteFixtureDisputes()
    await fx.cleanup() // orders go with the fixture users (DEPENDENT_TABLES)
  }, 120_000)

  it('the two dispute sets partition dispute_status_enum exactly', () => {
    const [enumValues] = sql(`select string_agg(v::text, ',' order by v::text) from unnest(enum_range(null::dispute_status_enum)) v`)
    expect([...OPEN_DISPUTE_STATUSES, ...FINISHED_DISPUTE_STATUSES].sort().join(',')).toBe(enumValues)
    expect(OPEN_DISPUTE_STATUSES.filter((s) => (FINISHED_DISPUTE_STATUSES as readonly string[]).includes(s))).toEqual([])
  })

  it('seeded more collected orders than one PostgREST page', () => {
    const [collected] = sql(`select count(*) from orders where status in ${COLLECTED}`)
    expect(Number(collected)).toBeGreaterThan(1000)
  })

  it('dashboard counts + revenue match SQL', async () => {
    const res = await getDashboardStats()
    expect(res.success, res.error).toBe(true)
    const s = res.stats!
    const [total, today, active, revAll, revToday, revMonth, revPrev, buyers] = sql(`
      select count(*),
             count(*) filter (where created_at >= ${TODAY}),
             count(*) filter (where status in ${IN_PROGRESS}),
             coalesce(sum(total_amount) filter (where status in ${COLLECTED}), 0),
             coalesce(sum(total_amount) filter (where status in ${COLLECTED} and created_at >= ${TODAY}), 0),
             coalesce(sum(total_amount) filter (where status in ${COLLECTED} and created_at >= ${MONTH}), 0),
             coalesce(sum(total_amount) filter (where status in ${COLLECTED} and created_at >= ${PREV_MONTH} and created_at < ${MONTH}), 0),
             count(distinct buyer_id) filter (where status in ${COLLECTED})
      from orders`)
    expect(s.totalOrders).toBe(Number(total))
    expect(s.ordersToday).toBe(Number(today))
    expect(s.activeOrders).toBe(Number(active))
    expect(s.totalRevenue).toBeCloseTo(Number(revAll), 2)
    expect(s.revenueToday).toBeCloseTo(Number(revToday), 2)
    expect(s.revenueThisMonth).toBeCloseTo(Number(revMonth), 2)
    expect(s.revenueLastMonth).toBeCloseTo(Number(revPrev), 2)
    expect(s.totalBuyers).toBe(Number(buyers))
    expect(Number(revPrev)).toBeGreaterThan(0)
  })

  it('dashboard dispute counts cover every open state', async () => {
    const res = await getDashboardStats()
    expect(res.success, res.error).toBe(true)
    const [open, urgentOpen] = sql(`
      select count(*) filter (where status::text not in ${FINISHED}),
             count(*) filter (where status::text not in ${FINISHED} and priority = 'urgent')
      from disputes`)
    expect(res.stats!.openDisputes).toBe(Number(open))
    expect(res.stats!.highPriorityDisputes).toBe(Number(urgentOpen))
    expect(Number(open)).toBeGreaterThanOrEqual(OPEN_DISPUTE_STATUSES.length)
  })

  it('analytics revenue, GMV and order counts match SQL', async () => {
    const res = await getAnalyticsData()
    expect(res.success, res.error).toBe(true)
    const d = res.data!
    const [platAll, platMtd, platPrev, gmvAll, gmvMtd] = sql(`
      select coalesce(sum(${PLATFORM}) filter (where status in ${COLLECTED}), 0),
             coalesce(sum(${PLATFORM}) filter (where status in ${COLLECTED} and created_at >= ${MONTH}), 0),
             coalesce(sum(${PLATFORM}) filter (where status in ${COLLECTED} and created_at >= ${PREV_MONTH} and created_at < ${MONTH}), 0),
             coalesce(sum(total_amount) filter (where status in ${COLLECTED}), 0),
             coalesce(sum(total_amount) filter (where status in ${COLLECTED} and created_at >= ${MONTH}), 0)
      from orders`)
    expect(d.platformRevenueTotal).toBeCloseTo(Number(platAll), 2)
    expect(d.platformRevenueMtd).toBeCloseTo(Number(platMtd), 2)
    expect(d.platformRevenuePrevMonth).toBeCloseTo(Number(platPrev), 2)
    expect(d.gmvTotal).toBeCloseTo(Number(gmvAll), 2)
    expect(d.gmvMtd).toBeCloseTo(Number(gmvMtd), 2)

    const [total, mtd, prev, completed, disputed, refunded, guest, avg] = sql(`
      select count(*),
             count(*) filter (where created_at >= ${MONTH}),
             count(*) filter (where created_at >= ${PREV_MONTH} and created_at < ${MONTH}),
             count(*) filter (where status = 'completed'),
             count(*) filter (where status = 'disputed'),
             count(*) filter (where status = 'refunded'),
             count(*) filter (where is_guest_order),
             coalesce(avg(total_amount) filter (where status = 'completed'), 0)
      from orders`)
    expect(d.ordersTotal).toBe(Number(total))
    expect(d.ordersMtd).toBe(Number(mtd))
    expect(d.ordersPrevMonth).toBe(Number(prev))
    expect(d.ordersCompleted).toBe(Number(completed))
    expect(d.ordersDisputed).toBe(Number(disputed))
    expect(d.ordersRefunded).toBe(Number(refunded))
    expect(d.ordersGuest).toBe(Number(guest))
    expect(d.avgOrderValue).toBeCloseTo(Number(avg), 2)
  })

  it('analytics 30-day charts match SQL', async () => {
    const res = await getAnalyticsData()
    expect(res.success, res.error).toBe(true)
    const d = res.data!
    expect(d.dailyRevenue).toHaveLength(30)
    expect(d.dailyOrders).toHaveLength(30)
    const [rev30, ord30, revToday] = sql(`
      select coalesce(sum(${PLATFORM}) filter (where created_at >= ${TODAY} - interval '29 days'), 0),
             count(*) filter (where created_at >= ${TODAY} - interval '29 days'),
             coalesce(sum(${PLATFORM}) filter (where created_at >= ${TODAY}), 0)
      from orders where status in ${COLLECTED}`)
    expect(d.dailyRevenue.reduce((t, p) => t + p.value, 0)).toBeCloseTo(Number(rev30), 2)
    expect(d.dailyOrders.reduce((t, p) => t + p.value, 0)).toBe(Number(ord30))
    expect(d.dailyRevenue[29].date).toBe(new Date().toISOString().slice(0, 10))
    expect(d.dailyRevenue[29].value).toBeCloseTo(Number(revToday), 2)
  })

  it('analytics disputes + promo discount match SQL', async () => {
    const res = await getAnalyticsData()
    expect(res.success, res.error).toBe(true)
    const [open, finished] = sql(`
      select count(*) filter (where status::text not in ${FINISHED}),
             count(*) filter (where status::text in ${FINISHED})
      from disputes`)
    const [promo] = sql(`select coalesce(sum(discount_amount), 0) from promo_code_usages`)
    expect(res.data!.disputesOpen).toBe(Number(open))
    expect(res.data!.disputesResolved).toBe(Number(finished))
    expect(Number(finished)).toBeGreaterThanOrEqual(FINISHED_DISPUTE_STATUSES.length)
    expect(res.data!.promoTotalDiscount).toBeCloseTo(Number(promo), 2)
  })

  it('a non-admin caller is refused, not handed an empty result', async () => {
    state.admin = false
    try {
      await expect(getDashboardStats()).rejects.toThrow('NEXT_REDIRECT')
      await expect(getAnalyticsData()).rejects.toThrow('NEXT_REDIRECT')
    } finally {
      state.admin = true
    }
  })
})
