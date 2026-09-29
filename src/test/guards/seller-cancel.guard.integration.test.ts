/**
 * Seller cancels an order they can't fulfil (integration, real action +
 * money RPCs, the seller's own session):
 *   · paid       -> CANCELLED, buyer's wallet credited in full, once
 *     (a second click is a no-op, not a second refund);
 *   · delivering -> REFUNDED, buyer's wallet credited in full;
 *   · the chat gets an "order_cancelled" notice with the reason;
 *   · a delivered order, the buyer, a bad reason: refused, nothing moves.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, promoteToEstablishedSeller, activateFixtureListing, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => ({ success: true })]))
})

import { sellerCancelOrder } from '@/lib/actions/orders'

const CUR = 'USD'
let fx: Fixture | null = null
const orderIds: string[] = []
const convoIds: string[] = []

async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}
async function buyerWallet(): Promise<number> {
  return Number(await rpc('user_wallet_balance', { p_user_id: fx!.buyer.id, p_currency: CUR }))
}
async function orderRow(id: string) {
  const { data } = await fx!.svc.from('orders').select('status, escrow_status').eq('id', id).single()
  return data as any
}
async function paidOrder(): Promise<string> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
    status: 'pending', escrow_status: 'pending',
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const id = (data as any).id as string
  orderIds.push(id)
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
  const { data: convo, error: ce } = await fx!.svc.from('conversations').insert({
    order_id: id, buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId,
  }).select('id').single()
  if (ce) throw new Error(`conversation: ${ce.message}`)
  convoIds.push((convo as any).id)
  return id
}

describe.skipIf(!hasEnv)('seller cancels an order (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (convoIds.length) {
      await fx.svc.from('messages').delete().in('conversation_id', convoIds)
      await fx.svc.from('conversations').delete().in('id', convoIds)
    }
    for (const id of orderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', orderIds)
    await fx.cleanup()
  }, 60_000)

  it('paid: cancelled and the buyer refunded in full, exactly once', async () => {
    state.client = fx!.seller.client
    const id = await paidOrder()
    const before = await buyerWallet()
    const r = await sellerCancelOrder(id, 'out_of_stock')
    expect(r.success, r.error).toBe(true)
    expect(await orderRow(id)).toMatchObject({ status: 'cancelled', escrow_status: 'refunded' })
    expect(await buyerWallet()).toBe(before + 100)
    // A double click: success, no second credit.
    const again = await sellerCancelOrder(id, 'out_of_stock')
    expect(again.success).toBe(false) // no longer paid/delivering
    expect(await buyerWallet()).toBe(before + 100)

    const { data: msgs } = await fx!.svc.from('messages').select('sender_id, content').eq('conversation_id', convoIds[convoIds.length - 1])
    const notice = ((msgs ?? []) as any[]).find((m) => m.sender_id === null)
    expect(JSON.parse(notice.content)).toMatchObject({ type: 'order_cancelled', by: 'seller', reason: 'Out Of Stock' })
  })

  it('delivering: refunded and the buyer credited in full', async () => {
    state.client = fx!.seller.client
    const id = await paidOrder()
    await rpc('safedrop_transition', { p_order_id: id, p_event: 'SELLER_DELIVERING', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
    const before = await buyerWallet()
    const r = await sellerCancelOrder(id, 'other', 'Game servers are down for a week')
    expect(r.success, r.error).toBe(true)
    expect((await orderRow(id)).status).toBe('refunded')
    expect(await buyerWallet()).toBe(before + 100)
  })

  it('delivered, the buyer, or a bad reason: refused and nothing moves', async () => {
    const id = await paidOrder()
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    const before = await buyerWallet()

    state.client = fx!.seller.client
    const delivered = await sellerCancelOrder(id, 'out_of_stock')
    expect(delivered.success).toBe(false)
    expect((await orderRow(id)).status).toBe('delivered')

    const other = await paidOrder()
    state.client = fx!.buyer.client
    const asBuyer = await sellerCancelOrder(other, 'out_of_stock')
    expect(asBuyer).toMatchObject({ success: false, error: 'Unauthorized' })

    state.client = fx!.seller.client
    const badReason = await sellerCancelOrder(other, 'because')
    expect(badReason.success).toBe(false)
    const noNote = await sellerCancelOrder(other, 'other', '')
    expect(noNote.success).toBe(false)
    expect((await orderRow(other)).status).toBe('paid')
    expect(await buyerWallet()).toBe(before)
  })
})
