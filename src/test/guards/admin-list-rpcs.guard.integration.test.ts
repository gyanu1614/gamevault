/**
 * Admin lists read one page from one query (integration) — migration
 * 20261103142817_admin_list_rpcs.
 *
 *   · each function matches the plain queries it replaced;
 *   · filters, sort and paging happen in the database;
 *   · a person's stage on the Sellers page follows deriveStage (the same rule
 *     /founding uses), including the { game, categories } rows it saves today;
 *   · a staff session cannot call any of them: they return emails and money.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    throw new Error('cookie client used')
  },
}))
vi.mock('@/lib/email', () => ({}))
vi.mock('@/lib/actions/admin-permissions', () => {
  const gate = async () => ({ userId: 'admin', role: 'super_admin' })
  return { requireAdmin: gate, requireRole: gate }
})

import { deriveStage } from '@/lib/founding/onboarding'
import { getActiveSellers, getSellerStats } from '@/lib/actions/admin-active-sellers'
import { getAllSellers } from '@/lib/actions/admin-all-sellers'

let fx: Fixture | null = null

async function countOf(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

const activePageArgs = {
  p_search: null,
  p_status: null,
  p_tier: null,
  p_default_tier: 'bronze',
  p_verified: null,
  p_paused: null,
  p_sort: 'listings',
  p_ascending: false,
  p_limit: 50,
  p_offset: 0,
}

describe.skipIf(!hasEnv)('admin list RPCs (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    // A live seller: the fixture's completed order counts as a sale.
    const { error } = await fx.svc.from('profiles').update({ role: 'seller', seller_status: 'active' }).eq('id', fx.seller.id)
    if (error) throw new Error(`seller role: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (fx) {
      await fx.svc.from('seller_onboarding').delete().eq('user_id', fx.buyer.id)
      await fx.cleanup()
    }
  }, 60_000)

  describe('Active Sellers', () => {
    it('counts match plain queries and the fixture seller carries their numbers', async () => {
      const { data, error } = await fx!.svc.rpc('admin_active_sellers_page', { ...activePageArgs, p_limit: 1000 })
      expect(error).toBeNull()
      expect(data.total).toBe(await countOf(fx!.svc.from('profiles').select('id', { count: 'exact' }).eq('role', 'seller').limit(1)))
      const row = data.rows.find((r: any) => r.id === fx!.seller.id)
      expect(row.completed_sales).toBe(1)
      expect(Number(row.revenue)).toBe(1)
      expect(row.pending_listings).toBe(1)
      expect(row.active_listings).toBe(0)
      expect(row.last_active_at).toBeTruthy()
    })

    it('filters, sorts and pages in the database', async () => {
      const onePage = await fx!.svc.rpc('admin_active_sellers_page', { ...activePageArgs, p_limit: 1 })
      expect(onePage.data.rows).toHaveLength(1)
      expect(onePage.data.total).toBeGreaterThanOrEqual(1)

      const { data: seller } = await fx!.svc.from('profiles').select('email').eq('id', fx!.seller.id).single()
      const found = await fx!.svc.rpc('admin_active_sellers_page', { ...activePageArgs, p_search: `%${(seller as any).email}%` })
      expect(found.data.rows.map((r: any) => r.id)).toEqual([fx!.seller.id])

      const banned = await fx!.svc.rpc('admin_active_sellers_page', { ...activePageArgs, p_search: `%${(seller as any).email}%`, p_status: 'banned' })
      expect(banned.data.total).toBe(0)

      const bySales = await fx!.svc.rpc('admin_active_sellers_page', { ...activePageArgs, p_sort: 'sales', p_limit: 1000 })
      const sales = bySales.data.rows.map((r: any) => r.completed_sales)
      expect(sales).toEqual([...sales].sort((a: number, b: number) => b - a))
    })

    it('the action returns a page with the row shape the screen reads', async () => {
      const result = await getActiveSellers({ sortBy: 'sales', pageSize: 5 })
      expect(result.success).toBe(true)
      expect(result.sellers!.length).toBeLessThanOrEqual(5)
      expect(result.total).toBeGreaterThanOrEqual(1)
      const row = result.sellers![0]
      expect(row.stats).toEqual(
        expect.objectContaining({
          active_listings: expect.any(Number),
          pending_listings: expect.any(Number),
          completed_sales: expect.any(Number),
          revenue: expect.any(Number),
          pending_withdrawals: expect.any(Number),
        }),
      )
      expect(typeof row.store_paused).toBe('boolean')
    })

    it('search treats a typed % as itself, not as everything', async () => {
      const result = await getActiveSellers({ searchQuery: '%' })
      expect(result.success).toBe(true)
      expect(result.total).toBe(0)
    })

    it('the totals match plain queries', async () => {
      const { stats } = await getSellerStats()
      expect(stats!.totalSellers).toBe(await countOf(fx!.svc.from('profiles').select('id', { count: 'exact' }).eq('role', 'seller').limit(1)))
      expect(stats!.totalActiveListings).toBe(await countOf(fx!.svc.from('listings').select('id', { count: 'exact' }).eq('status', 'active').limit(1)))
      const { data: orders } = await fx!.svc.from('orders').select('seller_payout').eq('status', 'completed')
      expect(stats!.totalRevenue).toBeCloseTo((orders ?? []).reduce((sum: number, o: any) => sum + Number(o.seller_payout), 0), 2)
    })
  })

  describe('Sellers', () => {
    const onboarding = (extra: Record<string, unknown>) =>
      fx!.svc.from('seller_onboarding').upsert({ user_id: fx!.buyer.id, ...extra }, { onConflict: 'user_id' })

    async function buyerRow() {
      const { data: profile } = await fx!.svc.from('profiles').select('email').eq('id', fx!.buyer.id).single()
      const result = await getAllSellers({ q: (profile as any).email })
      return result.rows.find((r) => r.id === fx!.buyer.id)
    }

    it('a person mid-signup moves through the same stages as /founding', async () => {
      const inputs = { signedIn: true, isSeller: false, store: false, agreement: false }

      await onboarding({ sells: [], country: null })
      expect((await buyerRow())?.stage).toBe(deriveStage({ ...inputs, details: false }))

      // The shape /founding saves today.
      await onboarding({
        sells: [{ game: 'adopt-me', categories: ['items'] }],
        country: 'GB',
        is_adult_confirmed_at: new Date().toISOString(),
      })
      const atStore = await buyerRow()
      expect(atStore?.stage).toBe(deriveStage({ ...inputs, details: true }))
      expect(atStore?.sells).toEqual(['adopt-me'])

      await onboarding({ store_name: 'guardstore' })
      const atAgreement = await buyerRow()
      expect(atAgreement?.stage).toBe(deriveStage({ ...inputs, details: true, store: true }))
      expect(atAgreement?.shop_name).toBeTruthy()
    })

    it('a live seller shows their numbers and balance', async () => {
      const { data: profile } = await fx!.svc.from('profiles').select('email').eq('id', fx!.seller.id).single()
      const result = await getAllSellers({ q: (profile as any).email })
      const row = result.rows.find((r) => r.id === fx!.seller.id)
      expect(row?.stage).toBe(5)
      expect(row?.milestone).toBe('sold')
      expect(row?.stats.completed_sales).toBe(1)
      expect(row?.stats.active_listings).toBe(1)
      expect(typeof row?.stats.balance_usd).toBe('number')
    })

    it('stage filters slice the set, the funnel covers everyone, a page past the end comes back', async () => {
      const all = await getAllSellers({})
      const live = await getAllSellers({ stage: 'live' })
      const inProgress = await getAllSellers({ stage: 'in_progress' })
      expect(live.total + inProgress.total).toBe(all.total)
      expect(live.funnel.signed_up).toBe(all.funnel.signed_up)
      expect(all.funnel.live).toBe(live.total)
      expect((await getAllSellers({ page: 9999 })).page).toBe(all.total === 0 ? 1 : Math.ceil(all.total / all.pageSize))
    })
  })

  it('moderation numbers match plain queries', async () => {
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString()
    const { data, error } = await fx!.svc.rpc('admin_moderation_stats', { p_today: today })
    expect(error).toBeNull()
    const listings = () => fx!.svc.from('listings').select('id', { count: 'exact' }).limit(1)
    expect(data.pending).toBe(await countOf(listings().eq('status', 'pending_approval')))
    expect(data.awaiting_seller).toBe(await countOf(listings().eq('status', 'changes_requested')))
    expect(data.total_approved).toBe(await countOf(listings().eq('status', 'active').not('approved_at', 'is', null)))
  })

  it('released counts cover only released listings', async () => {
    const { data, error } = await fx!.svc.rpc('admin_seller_released_counts', { p_seller_ids: [fx!.seller.id, fx!.buyer.id] })
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('review numbers and game counts match plain queries', async () => {
    const { data: stats, error } = await fx!.svc.rpc('admin_review_stats')
    expect(error).toBeNull()
    expect(stats.total_reviews).toBe(await countOf(fx!.svc.from('reviews').select('id', { count: 'exact' }).limit(1)))

    const { data: counts, error: countsError } = await fx!.svc.rpc('admin_game_listing_counts')
    expect(countsError).toBeNull()
    const summed = (counts as { active_listings: number }[]).reduce((sum, c) => sum + Number(c.active_listings), 0)
    expect(summed).toBe(await countOf(fx!.svc.from('listings').select('id', { count: 'exact' }).eq('status', 'active').limit(1)))
  })

  it('withdrawal totals add up and the risk batch matches the single call', async () => {
    const { data: totals, error } = await fx!.svc.rpc('admin_withdrawal_totals', { p_open_statuses: ['pending', 'approved', 'processing'] })
    expect(error).toBeNull()
    expect(totals.total).toBe(await countOf(fx!.svc.from('withdrawal_requests').select('id', { count: 'exact' }).limit(1)))

    const { data: batch, error: batchError } = await fx!.svc.rpc('withdrawal_risk_snapshots', { p_seller_ids: [fx!.seller.id] })
    expect(batchError).toBeNull()
    const { data: single } = await fx!.svc.rpc('withdrawal_risk_snapshot', { p_seller_id: fx!.seller.id })
    expect((batch as { snapshot: unknown }[])[0].snapshot).toEqual(single)
  })

  it('a staff session can call none of them', async () => {
    const staff = fx!.admin.client
    const calls = [
      staff.rpc('admin_active_sellers_page', activePageArgs),
      staff.rpc('admin_seller_totals'),
      staff.rpc('admin_all_sellers_page', {
        p_q: null, p_stage: null, p_trust: null, p_founding: null, p_limit: 1, p_page: 1, p_stalled_before: new Date().toISOString(),
      }),
      staff.rpc('admin_moderation_stats', { p_today: new Date().toISOString() }),
      staff.rpc('admin_seller_released_counts', { p_seller_ids: [fx!.seller.id] }),
      staff.rpc('admin_review_stats'),
      staff.rpc('admin_game_listing_counts'),
      staff.rpc('withdrawal_risk_snapshots', { p_seller_ids: [fx!.seller.id] }),
      staff.rpc('admin_withdrawal_totals', { p_open_statuses: ['pending'] }),
    ]
    for (const { error } of await Promise.all(calls)) expect(error).not.toBeNull()
  })
})
