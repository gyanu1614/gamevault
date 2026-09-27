/**
 * Disputes the parties settle themselves (integration, real RPCs) —
 * migration 20260927001408_order_dispute_self_resolve.
 *
 *   · order_mark_delivered_in_dispute: stamps delivered_at ONLY — status stays
 *     disputed, escrow stays frozen, no journal, no auto-complete window; the
 *     buyer is told once; wrong seller / wrong state / repeat are refused;
 *   · order_dispute_buyer_confirm, dispute BEFORE completion: the ordinary
 *     buyer-confirm release (BUYER_CONFIRMED, maturity hold), dispute closed
 *     resolved_seller_favor with resolved_by = buyer, audit row, seller told once;
 *   · dispute AFTER completion: DISPUTE_RESOLVED_SELLER unfreezes the seller;
 *   · an admin-opened dispute is refused; so is a stranger;
 *   · a fault after the money step rolls everything back;
 *   · once the buyer closed it, an admin resolve sees already_resolved.
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

describe.skipIf(!hasEnv)('dispute self-resolve — seller delivers, buyer confirms (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_dispute_self_resolve_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
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
    expect(ready, 'apply 20260927001408_order_dispute_self_resolve first').toBe(true)
  })

  it('seller marks delivered inside a dispute: delivered_at only — no status, money or auto-complete change', async () => {
    const id = await insertPaidOrder()
    await open(id)
    const avail = await sellerBal('seller_available')

    const r = await deliverInDispute(id)
    expect(r).toMatchObject({ changed: true })
    const o = await orderRow(id)
    expect(o).toMatchObject({ status: 'disputed', escrow_status: 'frozen', auto_release_at: null })
    expect(o.delivered_at).not.toBeNull()
    expect(await txn(`order:${id}:SELLER_DELIVERED`)).toBeNull()
    expect(await sellerBal('seller_available')).toBe(avail)
    const readyList: any[] = await rpc('get_orders_ready_for_auto_release', { p_limit: 500 })
    expect(readyList.map((x) => x.id)).not.toContain(id)
    expect(await notifCount(`dispute_delivered:${id}`)).toBe(1)

    // Repeat, stranger, and a non-disputed order are all refused.
    expect(await deliverInDispute(id)).toMatchObject({ changed: false, reason: 'already_delivered' })
    expect(await deliverInDispute(id, fx!.buyer.id)).toMatchObject({ changed: false, reason: 'not_found' })
    const plain = await insertPaidOrder()
    expect(await deliverInDispute(plain)).toMatchObject({ changed: false, reason: 'not_disputed' })
    expect(await notifCount(`dispute_delivered:${id}`)).toBe(1)
  })

  it('buyer confirms a pre-completion dispute: ordinary buyer-confirm release (with hold), dispute closed by the buyer', async () => {
    // total 1.00, seller payout 0.80, platform 0.20.
    const id = await insertPaidOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    await deliverInDispute(id)
    const avail = await sellerBal('seller_available')

    const r = await buyerConfirm(id)
    expect(r).toMatchObject({ changed: true, resolved: true, post_completion: false, dispute_id: d.dispute_id, status: 'completed' })
    const o = await orderRow(id)
    expect(o).toMatchObject({ status: 'completed', escrow_status: 'released', release_method: 'buyer_confirmed' })
    expect(o.buyer_confirmed_at).not.toBeNull()
    expect(o.completed_at).not.toBeNull()

    // Same journal as an ordinary confirm, including the maturity hold.
    expect(await entriesOf(`order:${id}:BUYER_CONFIRMED`)).toEqual([
      'platform.escrow_held:debit:100',
      'platform.platform_commission:credit:20',
      'seller.seller_available:credit:80',
    ].sort())
    expect((await txn(`order:${id}:BUYER_CONFIRMED`))?.matures_at).not.toBeNull()
    expect(await sellerBal('seller_available')).toBe(avail + 80)

    expect(await disputeRow(d.dispute_id)).toMatchObject({
      status: 'resolved_seller_favor', resolution_type: 'no_refund', resolved_by: fx!.buyer.id,
    })
    const { data: resolutions } = await fx!.svc.from('dispute_resolutions').select('*').eq('dispute_id', d.dispute_id)
    expect(resolutions).toHaveLength(1)
    expect((resolutions as any[])[0]).toMatchObject({ favored_party: 'seller', resolution_type: 'release_seller', resolved_by: fx!.buyer.id })
    const ev = await events(id)
    expect(ev.map((e) => `${e.actor_role}:${e.action}`)).toEqual(['buyer:opened', 'buyer:resolved_release'])
    expect(await notifCount(`dispute:${d.dispute_id}:resolved:seller`)).toBe(1)

    // Replay: nothing left to close, nothing moves again.
    expect(await buyerConfirm(id)).toMatchObject({ changed: false, reason: 'no_open_dispute' })
    expect(await sellerBal('seller_available')).toBe(avail + 80)
    // An admin arriving late finds it resolved.
    const late = await rpc('order_dispute_resolve', { p_dispute_id: d.dispute_id, p_admin_id: fx!.admin.id, p_outcome: 'refund_full', p_refund_minor: null, p_notes: 'late' })
    expect(late).toMatchObject({ resolved: false, reason: 'already_resolved' })
  })

  it('buyer confirms a post-completion dispute: the frozen amount is released back, like an admin release', async () => {
    const id = await completedOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    expect(d.post_completion).toBe(true)
    const frozen = await sellerBal('seller_frozen')
    const avail = await sellerBal('seller_available')

    const r = await buyerConfirm(id)
    expect(r).toMatchObject({ changed: true, post_completion: true })
    expect(await orderRow(id)).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await entriesOf(`order:${id}:DISPUTE_RESOLVED_SELLER:${d.dispute_id}`)).toEqual([
      'seller.seller_available:credit:80',
      'seller.seller_frozen:debit:80',
    ].sort())
    expect(await sellerBal('seller_frozen')).toBe(frozen - 80)
    expect(await sellerBal('seller_available')).toBe(avail + 80)
  })

  it('refuses an admin-opened dispute and a stranger', async () => {
    const id = await insertPaidOrder()
    await open(id, 'admin')
    expect(await buyerConfirm(id)).toMatchObject({ changed: false, reason: 'admin_opened' })
    expect(await orderRow(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })

    const mine = await insertPaidOrder()
    await open(mine)
    expect(await buyerConfirm(mine, fx!.seller.id)).toMatchObject({ changed: false, reason: 'not_found' })
    expect(await orderRow(mine)).toMatchObject({ status: 'disputed' })
  })

  it('a fault after the money step rolls everything back', async () => {
    const id = await insertPaidOrder()
    const d = await open(id)
    const avail = await sellerBal('seller_available')
    const err = withFault(
      'order_dispute_buyer_confirm:after_money',
      `SELECT public.order_dispute_buyer_confirm('${id}'::uuid, '${fx!.buyer.id}'::uuid)`,
    )
    expect(err).toMatch(/money_fault|after_money/)
    expect(await orderRow(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect((await disputeRow(d.dispute_id)).status).toBe('open')
    expect(await txn(`order:${id}:BUYER_CONFIRMED`)).toBeNull()
    expect(await sellerBal('seller_available')).toBe(avail)
    // …and the real call still works afterwards.
    expect(await buyerConfirm(id)).toMatchObject({ changed: true })
  })
})
