/**
 * Admin cancellation approval (integration): the money moves FIRST, as one
 * RPC, and the request is marked approved only after it succeeded.
 *   · paid → CANCELLED + buyer wallet credited, request approved;
 *   · delivered → REFUNDED + credited;
 *   · a state that can't be cancelled here (disputed) changes nothing and
 *     the request stays PENDING, so it can be retried / handled elsewhere.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture, activateFixtureListing } from './throwaway'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
const mail = vi.hoisted(() => ({ refunded: vi.fn(async () => undefined), resolved: vi.fn(async () => undefined) }))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const stubs = Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
  return { ...stubs, sendOrderRefundedEmail: mail.refunded, sendDisputeResolvedEmail: mail.resolved }
})
vi.mock('@/lib/actions/admin-permissions', () => ({
  requirePermission: async () => ({ userId: fx!.admin.id }),
  requireAdmin: async () => ({ userId: fx!.admin.id }),
}))
vi.mock('@/lib/admin/activity-log', () => ({ logAdminActivity: async () => undefined }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fx!.admin.client }))

const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let fx: Fixture | null = null
let ready = false
const createdOrderIds: string[] = []
const createdDisputeIds: string[] = []

function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}
async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}
async function orderRow(id: string) {
  const { data } = await fx!.svc.from('orders').select('*').eq('id', id).single()
  return data as any
}
async function disputeRow(id: string) {
  const { data } = await fx!.svc.from('disputes').select('*').eq('id', id).single()
  return data as any
}
async function insertPaidOrder(over: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
    status: 'pending', escrow_status: 'pending', ...over,
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const id = (data as any).id as string
  createdOrderIds.push(id)
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
  return id
}
async function completedOrder(over: Record<string, unknown> = {}): Promise<string> {
  const id = await insertPaidOrder(over)
  await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
  await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
  return id
}
async function open(orderId: string, role: 'buyer' | 'admin' = 'buyer') {
  const r = await rpc('order_dispute_open', {
    p_order_id: orderId, p_actor_id: role === 'buyer' ? fx!.buyer.id : fx!.admin.id, p_actor_role: role,
    p_reason: 'seller_unresponsive', p_title: 'Guard test dispute', p_description: `guard test ${role} reason`,
  })
  if (r.dispute_id) createdDisputeIds.push(r.dispute_id)
  return r
}
const deliverInDispute = (orderId: string, sellerId = fx!.seller.id) =>
  rpc('order_mark_delivered_in_dispute', { p_order_id: orderId, p_seller_id: sellerId })
const buyerConfirm = (orderId: string, buyerId = fx!.buyer.id) =>
  rpc('order_dispute_buyer_confirm', { p_order_id: orderId, p_buyer_id: buyerId })

async function sellerBal(kind: 'seller_available' | 'seller_frozen'): Promise<number> {
  return Number(await rpc('ledger_balance', { p_owner_type: 'seller', p_owner_id: fx!.seller.id, p_kind: kind, p_currency: CUR }))
}
async function notifCount(key: string): Promise<number> {
  const { count } = await fx!.svc.from('notifications').select('id', { count: 'exact', head: false }).eq('dedupe_key', key)
  return count ?? 0
}
async function txn(key: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id, matures_at').eq('idempotency_key', key).maybeSingle()
  return data as { id: string; matures_at: string | null } | null
}
async function entriesOf(key: string) {
  const t = await txn(key)
  if (!t) return null
  const { data } = await fx!.svc.from('ledger_entries').select('direction, amount_minor, account:account_id ( kind, owner_type )').eq('transaction_id', t.id)
  return ((data ?? []) as any[]).map((e) => `${e.account.owner_type}.${e.account.kind}:${e.direction}:${e.amount_minor}`).sort()
}
async function events(orderId: string) {
  const { data } = await fx!.svc.from('order_dispute_events').select('*').eq('order_id', orderId).order('id')
  return (data ?? []) as any[]
}

const createdRequestIds: string[] = []
async function request(orderId: string) {
  const { data, error } = await fx!.svc.from('order_cancellation_requests')
    .insert({ order_id: orderId, buyer_id: fx!.buyer.id, reason: 'guard test' }).select('id').single()
  if (error) throw new Error(`request: ${error.message}`)
  createdRequestIds.push((data as any).id)
  return (data as any).id as string
}
async function requestRow(id: string) {
  const { data } = await fx!.svc.from('order_cancellation_requests').select('status, processed_at').eq('id', id).single()
  return data as any
}
async function buyerWallet(): Promise<number> {
  return Number(await rpc('user_wallet_balance', { p_user_id: fx!.buyer.id, p_currency: CUR }))
}

describe.skipIf(!hasEnv)('admin cancellation approval — money first, one RPC (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_disputes_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('order_cancellation_requests').delete().in('id', createdRequestIds)
    await fx.svc.from('order_dispute_events').delete().in('order_id', createdOrderIds)
    await fx.svc.from('disputes').delete().in('id', createdDisputeIds)
    for (const id of createdOrderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', createdOrderIds)
    await fx.cleanup()
  }, 60_000)

  it('paid: cancelled + buyer credited, then approved', async () => {
    const id = await insertPaidOrder()
    const req = await request(id)
    const before = await buyerWallet()
    const { processCancellationRequest } = await import('@/lib/actions/order-cancellation')
    const r = await processCancellationRequest(req, 'approve', 'guard')
    expect(r.error).toBeUndefined()
    const { data: o } = await fx!.svc.from('orders').select('status, escrow_status').eq('id', id).single()
    expect(o).toMatchObject({ status: 'cancelled', escrow_status: 'refunded' })
    expect(await buyerWallet()).toBe(before + 100)
    expect((await requestRow(req)).status).toBe('approved')
  })

  it('delivered: refunded + credited, then approved', async () => {
    const id = await insertPaidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    const req = await request(id)
    const before = await buyerWallet()
    const { processCancellationRequest } = await import('@/lib/actions/order-cancellation')
    const r = await processCancellationRequest(req, 'approve')
    expect(r.error).toBeUndefined()
    const { data: o } = await fx!.svc.from('orders').select('status').eq('id', id).single()
    expect((o as any).status).toBe('refunded')
    expect(await buyerWallet()).toBe(before + 100)
    expect((await requestRow(req)).status).toBe('approved')
  })

  it('disputed: nothing changes and the request stays pending (retryable)', async () => {
    const id = await insertPaidOrder()
    await open(id)
    const req = await request(id)
    const before = await buyerWallet()
    const { processCancellationRequest } = await import('@/lib/actions/order-cancellation')
    const r = await processCancellationRequest(req, 'approve')
    expect(r.error?.message).toMatch(/resolve the dispute/)
    const { data: o } = await fx!.svc.from('orders').select('status').eq('id', id).single()
    expect((o as any).status).toBe('disputed')
    expect(await buyerWallet()).toBe(before)
    expect((await requestRow(req)).status).toBe('pending')
  })
})
