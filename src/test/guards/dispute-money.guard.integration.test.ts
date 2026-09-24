/**
 * Fee engine PR 7, Part 2 — disputes (integration, real RPCs).
 *
 *   · buyer opens before completion: nothing credited, escrow frozen, the order
 *     leaves the auto-complete list, one open dispute per order;
 *   · the 7-day window (from delivered_at) binds the buyer, not the admin;
 *   · after completion: the seller amount is frozen (available ↓ frozen ↑);
 *     release unfreezes; full refund credits the buyer wallet, debits the
 *     seller (seller_frozen) and the platform's commission, and the seller's
 *     matured balance can go NEGATIVE; a later sale nets against it;
 *   · partial refund: seller covers first, remainder returns to available;
 *   · a fault after the money step rolls everything back (dispute stays open);
 *   · every transition writes an order_dispute_events row with actor+reason and
 *     each party is notified exactly once per transition.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)

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
/** total 1.00; seller_payout defaults to 1.00 (fees 0) unless overridden. */
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
async function deliveredOrder(over: Record<string, unknown> = {}): Promise<string> {
  const id = await insertPaidOrder(over)
  await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
  return id
}
async function completedOrder(over: Record<string, unknown> = {}): Promise<string> {
  const id = await deliveredOrder(over)
  await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
  return id
}
async function open(orderId: string, role: 'buyer' | 'admin' = 'buyer') {
  const r = await rpc('order_dispute_open', {
    p_order_id: orderId, p_actor_id: role === 'buyer' ? fx!.buyer.id : fx!.admin.id, p_actor_role: role,
    p_reason: 'not_as_described', p_title: 'Guard test dispute', p_description: `guard test ${role} reason`,
  })
  if (r.dispute_id) createdDisputeIds.push(r.dispute_id)
  return r
}
async function resolve(disputeId: string, outcome: 'release' | 'refund_full' | 'refund_partial', refundMinor: number | null = null) {
  return rpc('order_dispute_resolve', { p_dispute_id: disputeId, p_admin_id: fx!.admin.id, p_outcome: outcome, p_refund_minor: refundMinor, p_notes: `guard ${outcome}` })
}
async function sellerBal(kind: 'seller_available' | 'seller_frozen'): Promise<number> {
  return Number(await rpc('ledger_balance', { p_owner_type: 'seller', p_owner_id: fx!.seller.id, p_kind: kind, p_currency: CUR }))
}
async function platformBal(kind: string): Promise<number> {
  return Number(await rpc('ledger_balance', { p_owner_type: 'platform', p_owner_id: null, p_kind: kind, p_currency: CUR }))
}
async function buyerWallet(): Promise<number> {
  return Number(await rpc('user_wallet_balance', { p_user_id: fx!.buyer.id, p_currency: CUR }))
}
async function matured(): Promise<number> {
  return Number(await rpc('seller_matured_balance', { p_seller_id: fx!.seller.id, p_currency: CUR }))
}
async function notifCount(key: string): Promise<number> {
  const { count } = await fx!.svc.from('notifications').select('id', { count: 'exact', head: false }).eq('dedupe_key', key)
  return count ?? 0
}
async function events(orderId: string) {
  const { data } = await fx!.svc.from('order_dispute_events').select('*').eq('order_id', orderId).order('id')
  return (data ?? []) as any[]
}
async function entriesOf(key: string) {
  const { data: txn } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()
  if (!txn) return null
  const { data } = await fx!.svc.from('ledger_entries').select('direction, amount_minor, account:account_id ( kind, owner_type )').eq('transaction_id', (txn as any).id)
  return ((data ?? []) as any[]).map((e) => `${e.account.owner_type}.${e.account.kind}:${e.direction}:${e.amount_minor}`).sort()
}

describe.skipIf(!hasEnv)('PR 7 Part 2 — disputes: freeze, refund, negative balance, audit (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_disputes_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('listings').update({ status: 'active' }).eq('id', fx.listingId)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
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

  it('migration is applied', () => {
    expect(ready, 'apply 20260923030931_order_disputes first').toBe(true)
  })

  it('post-completion FULL refund: buyer wallet credited; seller (frozen) + platform commission fund it; seller can go negative; a later sale nets', async () => {
    // total 1.00, seller payout 0.80 → the platform's 0.20 comes back too.
    const id = await completedOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const wallet = await buyerWallet()
    const commission = await platformBal('platform_commission')
    const r = await open(id, 'admin')
    expect(r.frozen_minor).toBe(80)

    const res = await resolve(r.dispute_id, 'refund_full')
    expect(res).toMatchObject({ resolved: true, outcome: 'refund_full', refund_minor: 100, seller_side_minor: 80, post_completion: true })
    expect(await orderRow(id)).toMatchObject({ status: 'refunded', escrow_status: 'refunded' })
    expect(await buyerWallet()).toBe(wallet + 100)
    expect(await platformBal('platform_commission')).toBe(commission - 20)
    expect(await entriesOf(`order:${id}:REFUNDED:dispute:${r.dispute_id}`)).toEqual([
      'platform.platform_commission:debit:20',
      'platform.refunds:credit:100',
      'seller.seller_frozen:debit:80',
    ].sort())
    // Buyer credit rode on the existing refund RPC's key.
    expect(await entriesOf(`wallet_refund:${id}`)).toEqual(['buyer.user_wallet:credit:100', 'platform.refunds:debit:100'].sort())
    expect((await disputeRow(r.dispute_id))).toMatchObject({ status: 'resolved_buyer_favor', resolution_type: 'refund_full' })
    const { data: resolutions } = await fx!.svc.from('dispute_resolutions').select('*').eq('dispute_id', r.dispute_id)
    expect(resolutions).toHaveLength(1)
    expect((resolutions as any[])[0]).toMatchObject({ favored_party: 'buyer', resolution_type: 'refund_buyer', resolved_by: fx!.admin.id })

    // Runs FIRST on a fresh seller: the only credit (buyer-confirmed, pending
    // maturity) was frozen and refunded, so the matured balance is NEGATIVE…
    expect(res.negative).toBe(true)
    const negative = await matured()
    expect(negative).toBeLessThan(0)
    // …and the next auto-completed sale (matures immediately) nets against it.
    const next = await deliveredOrder()
    await fx!.svc.from('orders').update({ auto_release_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', next)
    await rpc('safedrop_transition', { p_order_id: next, p_event: 'AUTO_RELEASED', p_dedupe_key: null, p_release_method: 'auto', p_refund_minor: null })
    expect(await matured()).toBe(negative + 100)
  })

  it('buyer dispute before completion: nothing credited, frozen, auto-complete blocked, one per order', async () => {
    const id = await deliveredOrder()
    const avail = await sellerBal('seller_available')
    const r = await open(id)
    expect(r.opened).toBe(true)
    expect(r.post_completion).toBe(false)
    expect(r.frozen_minor).toBe(0)
    expect(await orderRow(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect(await sellerBal('seller_available')).toBe(avail)
    expect(await entriesOf(`order:${id}:BUYER_DISPUTED`)).toBeNull()

    await fx!.svc.from('orders').update({ auto_release_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id)
    const ready: any[] = await rpc('get_orders_ready_for_auto_release', { p_limit: 500 })
    expect(ready.map((o) => o.id)).not.toContain(id)

    const again = await open(id)
    expect(again).toMatchObject({ opened: false, reason: 'already_open', dispute_id: r.dispute_id })

    const ev = await events(id)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ actor_id: fx!.buyer.id, actor_role: 'buyer', action: 'opened', reason: 'guard test buyer reason' })
    expect(await notifCount(`dispute:${r.dispute_id}:opened:seller`)).toBe(1)
    expect(await notifCount(`dispute:${r.dispute_id}:opened:buyer`)).toBe(1)

    // Wrong buyer / unpaid order refused.
    const stranger = await rpc('order_dispute_open', { p_order_id: id, p_actor_id: fx!.seller.id, p_actor_role: 'buyer', p_reason: 'other', p_title: 'x', p_description: 'x' })
    expect(stranger).toMatchObject({ opened: false, reason: 'not_found' })

    // Resolve to seller: pre-completion release credits the seller now.
    const res = await resolve(r.dispute_id, 'release')
    expect(res.resolved).toBe(true)
    expect(await orderRow(id)).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await sellerBal('seller_available')).toBe(avail + 100)
    expect((await disputeRow(r.dispute_id)).status).toBe('resolved_seller_favor')
  })

  it('dispute window binds the buyer (7 days from delivered_at), never the admin', async () => {
    const id = await deliveredOrder()
    await fx!.svc.from('orders').update({ delivered_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq('id', id)
    const late = await open(id)
    expect(late.opened).toBe(false)
    expect(late.reason).toBe('window_closed')
    expect(late.window_days).toBe(7)
    expect((await orderRow(id)).status).toBe('delivered')

    const byAdmin = await open(id, 'admin')
    expect(byAdmin.opened).toBe(true)
    expect(byAdmin.event).toBe('ADMIN_DISPUTED')
    const ev = await events(id)
    expect(ev[0]).toMatchObject({ actor_id: fx!.admin.id, actor_role: 'admin', action: 'admin_opened' })
    expect((await disputeRow(byAdmin.dispute_id)).priority).toBe('high')
    await resolve(byAdmin.dispute_id, 'release')
  })

  it('buyer can dispute a COMPLETED order inside the window; the seller amount is frozen; release unfreezes', async () => {
    const id = await completedOrder()
    const avail = await sellerBal('seller_available')
    const frozen = await sellerBal('seller_frozen')
    const r = await open(id)
    expect(r).toMatchObject({ opened: true, post_completion: true, frozen_minor: 100 })
    expect(await orderRow(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect(await sellerBal('seller_available')).toBe(avail - 100)
    expect(await sellerBal('seller_frozen')).toBe(frozen + 100)
    const w = await rpc('wallet_available_balance', { p_seller_id: fx!.seller.id, p_currency: CUR })
    expect(w.frozen_minor).toBe(frozen + 100)

    const res = await resolve(r.dispute_id, 'release')
    expect(res).toMatchObject({ resolved: true, outcome: 'release', refund_minor: 0, seller_side_minor: 0, post_completion: true })
    expect(await orderRow(id)).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await sellerBal('seller_available')).toBe(avail)
    expect(await sellerBal('seller_frozen')).toBe(frozen)
    expect(await events(id)).toHaveLength(2)
    expect(await notifCount(`dispute:${r.dispute_id}:resolved:seller`)).toBe(1)
    expect(await notifCount(`dispute:${r.dispute_id}:resolved:buyer`)).toBe(1)

    const twice = await resolve(r.dispute_id, 'refund_full')
    expect(twice).toMatchObject({ resolved: false, reason: 'already_resolved' })
  })

  it('post-completion PARTIAL refund: seller covers first, the rest of the frozen amount returns', async () => {
    const id = await completedOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const wallet = await buyerWallet()
    const avail = await sellerBal('seller_available')
    const commission = await platformBal('platform_commission')
    const r = await open(id)
    expect(r.frozen_minor).toBe(80)

    // 90 > seller's 80 → seller 80, platform 10.
    const res = await resolve(r.dispute_id, 'refund_partial', 90)
    expect(res).toMatchObject({ resolved: true, outcome: 'refund_partial', refund_minor: 90, seller_side_minor: 80 })
    expect(await orderRow(id)).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await buyerWallet()).toBe(wallet + 90)
    expect(await platformBal('platform_commission')).toBe(commission - 10)
    expect(await sellerBal('seller_available')).toBe(avail - 80) // frozen 80, nothing came back
    expect(await entriesOf(`wallet_refund:${id}:partial:${r.dispute_id}`)).toEqual(['buyer.user_wallet:credit:90', 'platform.refunds:debit:90'].sort())

    // 30 < 80 → seller 30, remaining 50 back to available.
    const id2 = await completedOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const avail2 = await sellerBal('seller_available')
    const r2 = await open(id2)
    const res2 = await resolve(r2.dispute_id, 'refund_partial', 30)
    expect(res2.seller_side_minor).toBe(30)
    expect(await sellerBal('seller_available')).toBe(avail2 - 80 + 50)
    expect(await entriesOf(`order:${id2}:DISPUTE_PARTIAL:${r2.dispute_id}`)).toEqual([
      'platform.refunds:credit:30',
      'seller.seller_available:credit:50',
      'seller.seller_frozen:debit:80',
    ].sort())

    // Partial must be strictly inside (0, total).
    const id3 = await completedOrder()
    const r3 = await open(id3)
    const { error } = await (fx!.svc.rpc as any)('order_dispute_resolve', { p_dispute_id: r3.dispute_id, p_admin_id: fx!.admin.id, p_outcome: 'refund_partial', p_refund_minor: 100, p_notes: 'x' })
    expect(error?.message).toMatch(/partial refund must be in/)
    expect((await disputeRow(r3.dispute_id)).status).toBe('open')
    await resolve(r3.dispute_id, 'release')
  })

  it('pre-completion full refund still refunds from escrow (buyer wallet credited, seller never credited)', async () => {
    const id = await deliveredOrder()
    const wallet = await buyerWallet()
    const avail = await sellerBal('seller_available')
    const r = await open(id)
    const res = await resolve(r.dispute_id, 'refund_full')
    expect(res).toMatchObject({ resolved: true, refund_minor: 100, post_completion: false })
    expect(await buyerWallet()).toBe(wallet + 100)
    expect(await sellerBal('seller_available')).toBe(avail)
    expect(await entriesOf(`order:${id}:REFUNDED:dispute:${r.dispute_id}`)).toEqual(['platform.escrow_held:debit:100', 'platform.refunds:credit:100'].sort())
  })

  it.skipIf(!TARGET_IS_LOCAL)('a fault after the money step rolls back everything (dispute stays open)', async () => {
    const id = await completedOrder()
    const r = await open(id)
    const wallet = await buyerWallet()
    const frozen = await sellerBal('seller_frozen')
    const err = withFault('order_dispute_resolve:after_money',
      `SELECT public.order_dispute_resolve('${r.dispute_id}'::uuid, '${fx!.admin.id}'::uuid, 'refund_full', NULL, 'fault')`)
    expect(err).toMatch(/injected fault/)
    expect((await disputeRow(r.dispute_id)).status).toBe('open')
    expect(await orderRow(id)).toMatchObject({ status: 'disputed' })
    expect(await buyerWallet()).toBe(wallet)
    expect(await sellerBal('seller_frozen')).toBe(frozen)
    expect(await events(id)).toHaveLength(1)
    expect(await notifCount(`dispute:${r.dispute_id}:resolved:buyer`)).toBe(0)

    const errOpen = withFault('order_dispute_open:after_transition',
      `SELECT public.order_dispute_open('${await completedOrder()}'::uuid, '${fx!.buyer.id}'::uuid, 'buyer', 'other', 't', 'd')`)
    expect(errOpen).toMatch(/injected fault/)

    const ok = await resolve(r.dispute_id, 'refund_full')
    expect(ok.resolved).toBe(true)
  })

  it('the app actions drive the same RPCs (buyer openDispute / admin resolveDispute)', async () => {
    const id = await deliveredOrder()
    // Session client for the buyer action.
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => fx!.buyer.client }))
    const { openDispute } = await import('@/lib/actions/orders')
    const r = await openDispute(id, 'Item not as described', 'guard test via action')
    expect(r.success).toBe(true)
    const { data: d } = await fx!.svc.from('disputes').select('id, reason, status').eq('transaction_id', id).single()
    createdDisputeIds.push((d as any).id)
    expect(d).toMatchObject({ reason: 'not_as_described', status: 'open' })
    const again = await openDispute(id, 'Other', 'x')
    expect(again.success).toBe(false)
    expect(again.error).toMatch(/already open/)
    await resolve((d as any).id, 'release')
  })
})
