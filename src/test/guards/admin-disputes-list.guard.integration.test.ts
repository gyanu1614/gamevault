/**
 * Admin disputes list + stats (integration) — getDisputes / getDisputeStats
 * in src/lib/actions/admin-disputes.ts, run as the fixture ADMIN's session
 * client (RLS is_admin()).
 *   · search finds a dispute by order number, dispute title, buyer username,
 *     seller shop name and listing title, and returns the order number;
 *   · typed metacharacters / PostgREST syntax never widen the result or error;
 *   · "Resolved (7d)" counts by resolved_at; stats match SQL.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture, activateFixtureListing } from './throwaway'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/actions/admin-permissions', () => ({
  requirePermission: async () => ({ userId: fx!.admin.id }),
  requireAdmin: async () => ({ userId: fx!.admin.id }),
}))
vi.mock('@/lib/admin/activity-log', () => ({ logAdminActivity: async () => undefined }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fx!.admin.client }))

import { getDisputes, getDisputeStats } from '@/lib/actions/admin-disputes'

const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let fx: Fixture | null = null
let ready = false
const createdOrderIds: string[] = []
const createdDisputeIds: string[] = []
let disputeId = ''
let orderNumber = ''
const shopName = `Dispute Shop ${Date.now().toString(36)}`
const disputeTitle = `Guard dispute ${Date.now().toString(36)}`

function sql(q: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim()
}
async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}
async function paidOrder(): Promise<string> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
    status: 'pending', escrow_status: 'pending',
  }).select('id, order_number').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const id = (data as any).id as string
  createdOrderIds.push(id)
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
  return id
}
async function openDispute(orderId: string, title: string): Promise<string> {
  const r = await rpc('order_dispute_open', {
    p_order_id: orderId, p_actor_id: fx!.buyer.id, p_actor_role: 'buyer',
    p_reason: 'seller_unresponsive', p_title: title, p_description: 'guard test dispute',
  })
  createdDisputeIds.push(r.dispute_id)
  return r.dispute_id as string
}
async function ids(search: string) {
  const res = await getDisputes({ search, limit: 100 }) as any
  expect(res.success, search).toBe(true)
  return (res.disputes as any[]).map((d) => d.id as string)
}

describe.skipIf(!hasEnv)('admin disputes: search + stats (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_disputes_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
    const { error } = await fx.svc.from('profiles').update({ shop_name: shopName }).eq('id', fx.seller.id)
    if (error) throw new Error(`shop_name: ${error.message}`)

    const orderId = await paidOrder()
    disputeId = await openDispute(orderId, disputeTitle)
    const { data } = await fx.svc.from('orders').select('order_number').eq('id', orderId).single()
    orderNumber = (data as any).order_number
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('order_dispute_events').delete().in('order_id', createdOrderIds)
    await fx.svc.from('dispute_resolutions').delete().in('dispute_id', createdDisputeIds)
    await fx.svc.from('disputes').delete().in('id', createdDisputeIds)
    for (const id of createdOrderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', createdOrderIds)
    await fx.cleanup()
  }, 60_000)

  it('order_disputes migration is applied', () => {
    expect(ready).toBe(true)
  })

  it('finds the dispute by order number, title, buyer, seller shop and listing title', async () => {
    const { data: b } = await fx!.svc.from('profiles').select('username').eq('id', fx!.buyer.id).single()
    const { data: l } = await fx!.svc.from('listings').select('title').eq('id', fx!.listingId).single()
    expect(await ids(orderNumber)).toContain(disputeId)
    expect(await ids(orderNumber.toLowerCase().replace(/-/g, ' '))).toContain(disputeId)
    expect(await ids(disputeTitle)).toContain(disputeId)
    expect(await ids((b as any).username)).toContain(disputeId)
    expect(await ids(shopName)).toContain(disputeId)
    expect(await ids((l as any).title)).toContain(disputeId)
  })

  it('returns the order number for the table', async () => {
    const res = await getDisputes({ search: disputeTitle }) as any
    const row = (res.disputes as any[]).find((d) => d.id === disputeId)
    expect(row?.order_number).toBe(orderNumber)
  })

  it('metacharacters and filter syntax never widen the result or error', async () => {
    for (const term of ['%', '___', '%_%', 'x,status.eq.open', 'a),id.not.is.null', '"', '\\']) {
      const res = await getDisputes({ search: term, limit: 100 }) as any
      expect(res.success, term).toBe(true)
      expect((res.disputes as any[]).map((d) => d.id), term).not.toContain(disputeId)
    }
  })

  it('stats: Resolved (7d) counts by resolved_at; every figure matches SQL', async () => {
    const before = (await getDisputeStats() as any).stats
    // Resolve a second dispute now: it was opened now too, so move its
    // created_at back 30 days — it must still count (resolved this week).
    const other = await paidOrder()
    const d2 = await openDispute(other, `${disputeTitle} old`)
    sql(`update disputes set created_at = now() - interval '30 days' where id = '${d2}'`)
    await rpc('order_dispute_resolve', { p_dispute_id: d2, p_admin_id: fx!.admin.id, p_outcome: 'release', p_refund_minor: null, p_notes: 'guard' })

    const res = await getDisputeStats() as any
    expect(res.success).toBe(true)
    expect(res.stats.resolvedThisWeek).toBe(before.resolvedThisWeek + 1)

    const [total, open, review, escalated, awaiting, resolved7d, urgent] = sql(`
      select count(*),
             count(*) filter (where status = 'open'),
             count(*) filter (where status = 'under_review'),
             count(*) filter (where status = 'escalated'),
             count(*) filter (where status in ('awaiting_seller_response','awaiting_buyer_response')),
             count(*) filter (where (status::text like 'resolved_%' or status = 'closed') and resolved_at > now() - interval '7 days'),
             count(*) filter (where priority = 'urgent' and not (status::text like 'resolved_%' or status = 'closed'))
      from disputes`).split('|').map(Number)
    expect(res.stats).toMatchObject({
      total, open, underReview: review, escalated, awaitingResponse: awaiting, resolvedThisWeek: resolved7d, urgent,
    })
  })
})
