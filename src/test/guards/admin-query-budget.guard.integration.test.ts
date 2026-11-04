/**
 * How many database calls each admin read and click may make (integration).
 *
 * Every call to the local Supabase API is counted. A screen that goes back to one
 * query per row, or a click that starts waiting on more reads, fails here instead
 * of showing up as a slow admin weeks later. Raise a budget only with a reason.
 *
 * Measured 2026-11-03, old code (86cd6028) against the budgets here:
 *   dashboard numbers 19 → 2 · analytics 21 → 1 · orders numbers 5 → 1 ·
 *   moderation numbers 5 → 1 · active sellers 7 → 1 · sellers 7 → 1 ·
 *   one Approve click 28 (action 10, page refresh 9, client reload 9) → 6.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any, adminId: '', calls: 0 }))

vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  unstable_cache: (fn: any) => fn,
}))
vi.mock('server-only', () => ({}))
vi.mock('@vercel/functions', () => ({ waitUntil: () => undefined }))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => ({ success: true })]))
})
vi.mock('@/lib/seo/indexnow', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  submitListingChanges: async () => undefined,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('@/lib/admin/context', () => ({
  getAdminGate: async () => ({ status: 'ok', user: { id: state.adminId }, admin: { role: 'super_admin' } }),
  getVerifiedAdmin: async () => ({ userId: state.adminId, role: 'super_admin', permissions: [] }),
}))
vi.mock('@/lib/actions/admin-permissions', () => {
  const gate = async () => ({ userId: state.adminId, role: 'super_admin', permissions: [] })
  return { requireAdmin: gate, requireRole: gate, requirePermission: gate }
})

import { getAnalyticsData } from '@/lib/actions/admin-analytics'
import { getActiveSellers, getSellerStats } from '@/lib/actions/admin-active-sellers'
import { getAllSellers } from '@/lib/actions/admin-all-sellers'
import { getDashboardStats } from '@/lib/actions/admin-dashboard'
import { getDisputeStats } from '@/lib/actions/admin-disputes'
import { fetchAdminGames } from '@/lib/actions/admin-games'
import { getOrderStats } from '@/lib/actions/admin-orders'
import { getReviewStats } from '@/lib/actions/admin-reviews'
import { getSellerDetail } from '@/lib/actions/admin-seller-detail'
import { approveListing, getModerationStats, getPendingListings, rejectListing } from '@/lib/actions/moderation'
import { getAllWithdrawalRequests } from '@/lib/actions/withdrawals'

let fx: Fixture | null = null

async function countCalls(work: () => Promise<unknown>): Promise<number> {
  state.calls = 0
  await work()
  return state.calls
}

async function pendingListing(): Promise<string> {
  const { data: base } = await fx!.svc.from('listings').select('game_id, game_category_id').eq('id', fx!.listingId).single()
  const { data, error } = await fx!.svc
    .from('listings')
    .insert({
      seller_id: fx!.seller.id,
      game_id: (base as any).game_id,
      game_category_id: (base as any).game_category_id,
      title: fx!.ns.listingTitle(),
      description: 'guard test throwaway',
      price: 1,
      quantity: 5,
      status: 'pending_approval',
    })
    .select('id')
    .single()
  if (error) throw new Error(`listing insert: ${error.message}`)
  return (data as any).id
}

describe.skipIf(!hasEnv)('admin query budget (integration)', () => {
  const realFetch = globalThis.fetch

  beforeAll(async () => {
    const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    vi.stubGlobal('fetch', (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url ?? String(input)
      if (url.startsWith(api) && !url.includes('/auth/v1/token')) state.calls += 1
      return realFetch(input, init)
    })
    fx = await makeFixture()
    state.client = fx.admin.client
    state.adminId = fx.admin.id
  }, 60_000)

  afterAll(async () => {
    vi.unstubAllGlobals()
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (fx) await fx.cleanup()
  }, 60_000)

  const budgets: [string, number, () => Promise<unknown>][] = [
    ['dashboard numbers', 2, () => getDashboardStats()],
    ['analytics', 1, () => getAnalyticsData()],
    ['orders page numbers', 1, () => getOrderStats()],
    ['disputes page numbers', 1, () => getDisputeStats()],
    ['moderation queue', 4, () => getPendingListings()],
    ['moderation numbers', 1, () => getModerationStats()],
    ['active sellers page', 1, () => getActiveSellers()],
    ['active sellers numbers', 1, () => getSellerStats()],
    ['sellers page', 1, () => getAllSellers()],
    ['withdrawals page', 2, () => getAllWithdrawalRequests()],
    ['reviews numbers', 1, () => getReviewStats()],
    ['games list', 2, () => fetchAdminGames()],
  ]

  it.each(budgets)('%s stays within %i calls', async (_label, budget, work) => {
    expect(await countCalls(work)).toBeLessThanOrEqual(budget)
  })

  it('the seller page does not grow with the seller', async () => {
    expect(await countCalls(() => getSellerDetail(fx!.seller.id))).toBeLessThanOrEqual(24)
  })

  it('one Approve click stays within its budget', async () => {
    const id = await pendingListing()
    expect(await countCalls(() => approveListing(id))).toBeLessThanOrEqual(8)
  })

  it('one Reject click stays within its budget', async () => {
    const id = await pendingListing()
    expect(await countCalls(() => rejectListing(id, 'not allowed'))).toBeLessThanOrEqual(5)
  })
})
