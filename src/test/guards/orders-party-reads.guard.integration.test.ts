/**
 * Order reads still work under the orders column grant (integration).
 *
 * 20260927224019_orders_column_privacy withholds each party's private order
 * columns from session clients (orders-column-privacy.guard). This runs the
 * app's real read paths with each party's real session client and checks
 * they still load — and carry the caller's OWN private fields and never the
 * other side's:
 *   · getOrder (the order page, and the admin order page);
 *   · the seller's Sold list, earnings and analytics (browser client);
 *   · the seller dashboard, the GDPR export;
 *   · the admin orders list / stats / analytics / dashboard (service role
 *     after requireAdmin).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'
import { ORDER_BUYER_PRIVATE_COLUMNS, ORDER_SELLER_PRIVATE_COLUMNS } from '@/lib/orders/columns'

const { state, proxy } = vi.hoisted(() => {
  const state = { client: null as any }
  // Every createClient() resolves to whichever party the test set.
  const proxy = () =>
    new Proxy({}, {
      get: (_t, key) => {
        const v = state.client?.[key]
        return typeof v === 'function' ? v.bind(state.client) : v
      },
    })
  return { state, proxy }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => proxy() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => proxy() }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/actions/admin-permissions', () => ({ requireAdmin: async () => ({ userId: 'admin' }) }))
vi.mock('@/lib/actions/revalidate-listing-surfaces', () => ({ revalidateMyListingSurfaces: async () => undefined }))
vi.mock('@/lib/actions/listings', () => ({ updateListing: async () => undefined, bulkUpdateListings: async () => undefined }))

import { getOrder, confirmOrderReceipt } from '@/lib/actions/orders'
import { earningsApi, analyticsApi } from '@/lib/api/seller-compatible'
import { getSellerDashboard } from '@/lib/actions/seller-dashboard-v2'
import { exportMyData } from '@/lib/actions/gdpr'
import { getOrders, getOrderStats } from '@/lib/actions/admin-orders'
import { getAnalyticsData } from '@/lib/actions/admin-analytics'
import { getDashboardStats } from '@/lib/actions/admin-dashboard'
import { IN_PROGRESS_ORDER_STATUSES } from '@/lib/admin/status-sets'

let fx: Fixture | null = null
let orderId = ''
/** A delivered order the buyer confirms (completion side effects cleaned in afterAll). */
let confirmedId = ''

const hasNone = (row: Record<string, unknown>, cols: readonly string[], what: string) => {
  for (const c of cols) expect(row, `${what} carries ${c}`).not.toHaveProperty(c)
}

describe.skipIf(!hasEnv)('order reads under the orders column grant (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    orderId = fx.completedOrderId
    const { error } = await fx.svc.from('orders').update({
      checkout_url: 'https://pay.example.test/c/reads', wallet_amount_used: 0.25, platform_fee: 0.2,
      platform_fee_rate: 0.2, seller_commission_pct: 20, seller_payout: 0.8, provider_charge_id: 'ch_reads',
    }).eq('id', orderId)
    if (error) throw new Error(`seed: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (confirmedId) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: confirmedId })
    await fx.svc.from('loyalty_credits').delete().in('user_id', [fx.buyer.id, fx.seller.id])
    await fx.cleanup()
  }, 60_000)

  describe('getOrder (order page)', () => {
    it("buyer: loads, with their checkout link and none of the seller's fields", async () => {
      state.client = fx!.buyer.client
      const res = await getOrder(orderId)
      expect(res.success, res.error).toBe(true)
      expect(res.order.checkout_url).toBe('https://pay.example.test/c/reads')
      expect(Number(res.order.wallet_amount_used)).toBe(0.25)
      expect(res.order.listing?.id).toBe(fx!.listingId)
      hasNone(res.order, ORDER_SELLER_PRIVATE_COLUMNS, 'buyer order')
    })

    it("seller: loads, with their payout + commission and none of the buyer's fields", async () => {
      state.client = fx!.seller.client
      const res = await getOrder(orderId)
      expect(res.success, res.error).toBe(true)
      expect(Number(res.order.seller_payout)).toBe(0.8)
      expect(Number(res.order.seller_commission_pct)).toBe(20)
      expect(Number(res.order.platform_fee)).toBe(0.2)
      expect(res.order.buyer?.username).toBeTruthy()
      hasNone(res.order, ORDER_BUYER_PRIVATE_COLUMNS, 'seller order')
    })

    it('admin: loads the whole row (service role after is_admin())', async () => {
      state.client = fx!.admin.client
      const res = await getOrder(orderId)
      expect(res.success, res.error).toBe(true)
      expect(Number(res.order.seller_payout)).toBe(0.8)
      expect(res.order.checkout_url).toBe('https://pay.example.test/c/reads')
      expect(res.order.provider_charge_id).toBe('ch_reads')
    })
  })

  describe("seller's browser reads", () => {
    it('earnings stats + transactions carry the payout', async () => {
      state.client = fx!.seller.client
      const stats = await earningsApi.getStats()
      expect(stats.total_earnings).toBeCloseTo(0.8)
      const tx = await earningsApi.getTransactions()
      const row = tx.find((t) => t.order_id === orderId)
      expect(row, 'transaction row').toBeTruthy()
      expect(Number(row!.net_amount)).toBe(0.8)
      expect(Number(row!.platform_fee)).toBe(0.2)
    })

    it('analytics dashboard stats (seller_dashboard_stats view) carry earnings', async () => {
      state.client = fx!.seller.client
      const s = await analyticsApi.getDashboardStats()
      expect(s.earnings.allTime).toBeCloseTo(0.8)
      expect(s.orders.completed).toBe(1)
    })
  })

  it('seller dashboard: net earnings from the payout', async () => {
    state.client = fx!.seller.client
    const d = await getSellerDashboard(7)
    expect(d).not.toBeNull()
    expect(d!.kpis.netEarnings).toBeCloseTo(0.8)
  })

  describe('GDPR export', () => {
    it("seller's export: their orders with their payout, none of the buyer's fields", async () => {
      state.client = fx!.seller.client
      const res = await exportMyData()
      expect(res.success, res.error).toBe(true)
      const row = JSON.parse(res.json!).orders.find((o: any) => o.id === orderId)
      expect(Number(row.seller_payout)).toBe(0.8)
      hasNone(row, ORDER_BUYER_PRIVATE_COLUMNS, 'seller export')
    })

    it("buyer's export: their orders with their payment fields, none of the seller's", async () => {
      state.client = fx!.buyer.client
      const res = await exportMyData()
      expect(res.success, res.error).toBe(true)
      const row = JSON.parse(res.json!).orders.find((o: any) => o.id === orderId)
      expect(row.checkout_url).toBe('https://pay.example.test/c/reads')
      hasNone(row, ORDER_SELLER_PRIVATE_COLUMNS, 'buyer export')
    })
  })

  describe('admin reads (service role after requireAdmin)', () => {
    it('orders list carries payout + fee', async () => {
      state.client = fx!.admin.client
      const res = await getOrders({ search: '', limit: 100 })
      expect(res.success).toBe(true)
      const row = res.orders.find((o: any) => o.id === orderId) as any
      expect(row, 'admin list has the order').toBeTruthy()
      expect(Number(row.seller_payout)).toBe(0.8)
      expect(Number(row.platform_fee)).toBe(0.2)
    })

    it('order stats sum platform fees', async () => {
      state.client = fx!.admin.client
      const res = await getOrderStats()
      expect(res.success).toBe(true)
      expect(res.stats!.totalFees).toBeGreaterThanOrEqual(0.2)
    })

    it('analytics counts platform revenue', async () => {
      state.client = fx!.admin.client
      const res = await getAnalyticsData()
      expect(res.success, res.error).toBe(true)
      expect(res.data!.platformRevenueTotal).toBeGreaterThanOrEqual(0.2)
    })

    it('dashboard counts orders', async () => {
      state.client = fx!.admin.client
      const res = await getDashboardStats()
      expect(res.success, res.error).toBe(true)
      expect(res.stats!.ordersThisWeek).toBeGreaterThanOrEqual(2)
      // Active = paid, not yet finished (PR #106: unpaid 'pending' is not
      // active). Same count as the DB over the shared status set.
      const { count } = await fx!.svc.from('orders').select('id', { count: 'exact' })
        .in('status', [...IN_PROGRESS_ORDER_STATUSES]).limit(1)
      expect(res.stats!.activeOrders).toBe(count ?? 0)
    })
  })

  // Last: completing a second order would move the earnings sums above.
  it("buyer confirms receipt: the seller's 'added to your balance' notice carries the real payout", async () => {
    // The buyer's session cannot read seller_payout, so the completion comms
    // must not take it from the buyer's row (it said $0.00).
    const { data, error } = await fx!.svc.from('orders').insert({
      buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0.2, payment_processing_fee_rate: 0, platform_fee: 0.2,
      payment_processing_fee: 0, total_amount: 1, seller_payout: 0.8, currency: 'USD',
      status: 'delivered', escrow_status: 'held', delivered_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`delivered order insert: ${error.message}`)
    confirmedId = (data as any).id
    state.client = fx!.buyer.client
    const res = await confirmOrderReceipt(confirmedId)
    expect(res.success, res.error).toBe(true)
    const { data: notes } = await fx!.svc.from('notifications').select('message')
      .eq('user_id', fx!.seller.id).eq('type', 'order_completed').eq('link', `/account/orders/${confirmedId}`)
    expect(notes).toHaveLength(1)
    expect((notes as any[])[0].message).toMatch(/^\$0\.80 added to your balance/)
  }, 60_000)
})
