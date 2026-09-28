/**
 * Buyer + seller dashboards read every order (integration) — the orders
 * query in getBuyerDashboard / getSellerDashboard goes through fetchAllRows
 * (created_at, id ordering + range). Run with each party's real session
 * client: the paged query is valid against the schema and the totals match
 * SQL over the same rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, activateFixtureListing, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))

import { getBuyerDashboard } from '@/lib/actions/buyer-dashboard'
import { getSellerDashboard } from '@/lib/actions/seller-dashboard-v2'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
let fx: Fixture | null = null

function sql(q: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim()
}

describe.skipIf(!hasEnv)('dashboards read all orders through the pager (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    const { error } = await (fx.svc.rpc as any)('safedrop_transition', {
      p_order_id: fx.pendingOrderId, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null,
    })
    if (error) throw new Error(`charge: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: fx.pendingOrderId })
    await fx.cleanup()
  }, 60_000)

  it("buyer Total Spent = SQL over the buyer's paid, kept orders", async () => {
    state.client = fx!.buyer.client
    const d = await getBuyerDashboard()
    expect(d).not.toBeNull()
    const expected = Number(sql(
      `select coalesce(sum(total_amount), 0) from orders where buyer_id = '${fx!.buyer.id}' and status not in ('pending','cancelled','refunded')`,
    ))
    expect(expected).toBeGreaterThan(0)
    expect(d!.totalSpent).toBeCloseTo(expected, 2)
  })

  it("seller Pending Payout = SQL over the seller's paid, unreleased sales", async () => {
    state.client = fx!.seller.client
    const d = await getSellerDashboard(7)
    expect(d).not.toBeNull()
    const expected = Number(sql(
      `select coalesce(sum(seller_payout), 0) from orders where seller_id = '${fx!.seller.id}' and status in ('paid','delivering','delivered','disputed') and completed_at is null`,
    ))
    expect(expected).toBeGreaterThan(0)
    expect(d!.kpis.pendingPayout).toBeCloseTo(expected, 2)
  })
})
