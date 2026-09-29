/**
 * Mark As Delivered puts the proof in the chat (integration, real action +
 * RPCs, the seller's own session):
 *   · the proof photo path is saved on the order (own folder only);
 *   · the order chat gets the seller's "Delivery Evidence" message with the
 *     photo attached, then a centered Order Delivered notice naming the
 *     seller;
 *   · a path outside the order's folder is neither saved nor posted.
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

import { markOrderAsDelivered } from '@/lib/actions/orders'

let fx: Fixture | null = null
const orderIds: string[] = []
const convoIds: string[] = []

async function paidOrderWithChat(): Promise<{ orderId: string; convoId: string }> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
    status: 'pending', escrow_status: 'pending',
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const orderId = (data as any).id as string
  orderIds.push(orderId)
  const { error: pe } = await (fx!.svc.rpc as any)('safedrop_transition', {
    p_order_id: orderId, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null,
  })
  if (pe) throw new Error(`charge: ${pe.message}`)
  const { data: convo, error: ce } = await fx!.svc.from('conversations').insert({
    order_id: orderId, buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId,
  }).select('id').single()
  if (ce) throw new Error(`conversation: ${ce.message}`)
  convoIds.push((convo as any).id)
  return { orderId, convoId: (convo as any).id }
}

async function thread(convoId: string) {
  const { data } = await fx!.svc.from('messages').select('sender_id, content, attachments').eq('conversation_id', convoId).order('created_at')
  return (data ?? []) as Array<{ sender_id: string | null; content: string; attachments: string[] | null }>
}

describe.skipIf(!hasEnv)('Mark As Delivered: proof and notice in the chat (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
    state.client = fx.seller.client
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

  it('posts "Delivery Evidence" with the photo, then an Order Delivered notice naming the seller', async () => {
    const { orderId, convoId } = await paidOrderWithChat()
    const photo = `${orderId}/1790000000000-proof.jpg`
    const res = await markOrderAsDelivered(orderId, undefined, photo)
    expect(res.success, res.error).toBe(true)

    const { data: order } = await fx!.svc.from('orders').select('status, delivery_evidence_urls').eq('id', orderId).single()
    expect((order as any).status).toBe('delivered')
    expect((order as any).delivery_evidence_urls).toEqual([photo])

    const msgs = await thread(convoId)
    const evidence = msgs.find((m) => m.sender_id === fx!.seller.id)
    expect(evidence?.content).toBe('Delivery Evidence')
    expect(evidence?.attachments).toEqual([photo])

    const notice = msgs.find((m) => m.sender_id === null)
    expect(notice).toBeTruthy()
    const parsed = JSON.parse(notice!.content)
    expect(parsed.type).toBe('order_delivered')
    const { data: seller } = await fx!.svc.from('profiles').select('username, shop_name').eq('id', fx!.seller.id).single()
    expect(parsed.seller).toBe((seller as any).shop_name || (seller as any).username)
    // Evidence first, then the notice.
    expect(msgs.indexOf(evidence!)).toBeLessThan(msgs.indexOf(notice!))
  })

  it("a path outside the order's folder is not saved and not posted as evidence", async () => {
    const { orderId, convoId } = await paidOrderWithChat()
    const res = await markOrderAsDelivered(orderId, undefined, `someone-else/proof.jpg`)
    expect(res.success, res.error).toBe(true)
    const { data: order } = await fx!.svc.from('orders').select('delivery_evidence_urls').eq('id', orderId).single()
    expect((order as any).delivery_evidence_urls ?? []).toEqual([])
    const msgs = await thread(convoId)
    expect(msgs.some((m) => m.content === 'Delivery Evidence')).toBe(false)
    // The delivered notice still goes out: the order WAS marked delivered.
    expect(msgs.some((m) => m.sender_id === null && JSON.parse(m.content).type === 'order_delivered')).toBe(true)
  })
})
