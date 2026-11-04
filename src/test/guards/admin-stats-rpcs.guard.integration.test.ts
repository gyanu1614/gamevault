/**
 * The admin numbers come from one query each (integration) — migration
 * 20261103131903_admin_stats_rpcs.
 *
 *   · admin_overview_stats returns the same numbers the old count queries and
 *     table walks produced (checked here against plain queries on the local DB);
 *   · it is service-role only; a staff session cannot call it directly;
 *   · admin_header_snapshot answers only for staff with two-factor;
 *   · admin_application_counts matches the applications list filters.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))
// Both reads use the service role: a cookie client here would be the bug.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used')
  },
}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/actions/admin-permissions', () => {
  const gate = async () => ({ userId: 'admin' })
  return { requireAdmin: gate, requireRole: gate }
})

import { hasEnv, makeFixture, type Fixture } from './throwaway'
import { utcPeriods } from '@/lib/admin/periods'
import {
  COLLECTED_ORDER_STATUSES,
  FINISHED_DISPUTE_STATUSES,
  IN_PROGRESS_ORDER_STATUSES,
  OPEN_DISPUTE_STATUSES,
} from '@/lib/admin/status-sets'
import { getAdminOverviewStats, type AdminOverviewStats } from '@/lib/admin/overview-stats'
import { getSellerApplicationCounts } from '@/lib/actions/admin-seller-review'

let fx: Fixture | null = null

const now = new Date()
const { todayStart, monthStart, prevMonthStart } = utcPeriods(now)
const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

const args = {
  p_today: todayStart.toISOString(),
  p_week: weekStart.toISOString(),
  p_month: monthStart.toISOString(),
  p_prev_month: prevMonthStart.toISOString(),
  p_collected: [...COLLECTED_ORDER_STATUSES],
  p_in_progress: [...IN_PROGRESS_ORDER_STATUSES],
  p_open_disputes: [...OPEN_DISPUTE_STATUSES],
  p_finished_disputes: [...FINISHED_DISPUTE_STATUSES],
}

async function countOf(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

describe.skipIf(!hasEnv)('admin stats RPCs (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  it('overview numbers match plain queries', { timeout: 60_000 }, async () => {
    const svc = fx!.svc
    const { data, error } = await svc.rpc('admin_overview_stats', args)
    expect(error).toBeNull()
    const stats = data as AdminOverviewStats

    const orders = () => svc.from('orders').select('id', { count: 'exact' }).limit(1)
    expect(stats.orders.total).toBe(await countOf(orders()))
    expect(stats.orders.today).toBe(await countOf(orders().gte('created_at', args.p_today)))
    expect(stats.orders.completed).toBe(await countOf(orders().eq('status', 'completed')))
    expect(stats.orders.in_progress).toBe(await countOf(orders().in('status', args.p_in_progress)))

    const { data: collected } = await svc
      .from('orders')
      .select('total_amount, platform_fee, payment_processing_fee, vaultshield_tier_fee, subtotal, seller_payout, buyer_id, status')
      .in('status', args.p_collected)
    const n = (v: unknown) => Number(v) || 0
    const rows = (collected ?? []) as Record<string, unknown>[]
    expect(stats.orders.revenue_total).toBeCloseTo(rows.reduce((sum, o) => sum + n(o.total_amount), 0), 2)
    expect(stats.orders.fees_total).toBeCloseTo(rows.reduce((sum, o) => sum + n(o.platform_fee), 0), 2)
    expect(stats.orders.charged_total).toBeCloseTo(
      rows.reduce(
        (sum, o) => sum + n(o.platform_fee) + n(o.payment_processing_fee) + n(o.vaultshield_tier_fee) + (n(o.subtotal) - n(o.seller_payout)),
        0,
      ),
      2,
    )
    expect(stats.orders.distinct_buyers).toBe(new Set(rows.map((o) => o.buyer_id)).size)

    const profiles = () => svc.from('profiles').select('id', { count: 'exact' }).limit(1)
    expect(stats.profiles.total).toBe(await countOf(profiles()))
    expect(stats.profiles.sellers).toBe(await countOf(profiles().eq('role', 'seller')))

    const listings = () => svc.from('listings').select('id', { count: 'exact' }).limit(1)
    expect(stats.listings.total).toBe(await countOf(listings()))
    expect(stats.listings.active).toBe(await countOf(listings().eq('status', 'active')))

    const disputes = () => svc.from('disputes').select('id', { count: 'exact' }).limit(1)
    expect(stats.disputes.open_all).toBe(await countOf(disputes().in('status', args.p_open_disputes)))
    expect(stats.disputes.finished).toBe(await countOf(disputes().in('status', args.p_finished_disputes)))
  })

  it('the daily series covers exactly the last 30 UTC days, oldest first, ending today', async () => {
    const { data } = await fx!.svc.rpc('admin_overview_stats', args)
    const { daily } = data as AdminOverviewStats
    expect(daily).toHaveLength(30)
    expect(daily[29].date).toBe(todayStart.toISOString().slice(0, 10))
    expect(daily[0].date).toBe(new Date(todayStart.getTime() - 29 * 86_400_000).toISOString().slice(0, 10))
  })

  it('counts a collected order today in the daily series', async () => {
    // The fixture's completed order was created moments ago.
    const { data } = await fx!.svc.rpc('admin_overview_stats', args)
    const { daily } = data as AdminOverviewStats
    expect(daily[29].orders).toBeGreaterThanOrEqual(1)
  })

  it('a staff session cannot call the overview or the counts directly', async () => {
    const overview = await fx!.admin.client.rpc('admin_overview_stats', args)
    expect(overview.error).not.toBeNull()
    const counts = await fx!.admin.client.rpc('admin_application_counts')
    expect(counts.error).not.toBeNull()
  })

  describe('admin_header_snapshot', () => {
    const snapshot = (client: SupabaseClient) => client.rpc('admin_header_snapshot', { p_open_disputes: args.p_open_disputes })

    it('answers staff with two-factor, with their own notifications', async () => {
      const inserted = await fx!.svc
        .from('notifications')
        .insert({ user_id: fx!.admin.id, type: 'guard_test', title: 'Guard', message: 'header', link: '/' })
      expect(inserted.error).toBeNull()
      const { data, error } = await snapshot(fx!.admin.client)
      expect(error).toBeNull()
      expect(data.unread_notifications).toBeGreaterThanOrEqual(1)
      expect(data.latest_notifications[0].type).toBe('guard_test')
      expect(typeof data.pending_applications).toBe('number')
    })

    it('is null for a buyer and for staff without two-factor', async () => {
      expect((await snapshot(fx!.buyer.client)).data).toBeNull()
      expect((await snapshot(await fx!.adminPasswordOnly())).data).toBeNull()
    })
  })

  it('the app reads both through their real entry points', async () => {
    expect((await getAdminOverviewStats()).daily).toHaveLength(30)
    expect(typeof (await getSellerApplicationCounts()).total).toBe('number')
  })

  it('application counts match the list filters', async () => {
    const { data, error } = await fx!.svc.rpc('admin_application_counts')
    expect(error).toBeNull()
    const apps = () => fx!.svc.from('seller_applications_with_users').select('id', { count: 'exact' }).limit(1)
    expect(data.total).toBe(await countOf(apps()))
    expect(data.pending).toBe(await countOf(apps().eq('status', 'pending')))
    expect(data.changes).toBe(await countOf(apps().eq('status', 'info_requested')))
    expect(data.restricted).toBe(await countOf(apps().in('seller_status', ['restricted', 'banned'])))
  })
})
