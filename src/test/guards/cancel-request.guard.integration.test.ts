/**
 * Buyer asks DropMarket to cancel (integration, real action, the buyer's own
 * session; approval itself is covered by cancellation-approval):
 *   · a 12 h delivery, an hour after PAYMENT: request created (pending);
 *   · inside the first hour after payment: "too soon", nothing created;
 *   · a delivered order: refused;
 *   · the buyer can withdraw their pending request.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, promoteToEstablishedSeller, activateFixtureListing, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => ({ success: true })]))
})

import { createCancellationRequest, cancelCancellationRequest } from '@/lib/actions/order-cancellation'

let fx: Fixture | null = null
const orderIds: string[] = []

async function rpc(name: string, args: Record<string, unknown>) {
  const { error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
}
/** A paid order whose payment happened `hoursAgo` hours ago. */
async function paidOrder(hoursAgo: number): Promise<string> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
    status: 'pending', escrow_status: 'pending',
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const id = (data as any).id as string
  orderIds.push(id)
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
  // Backdate payment (service role; timestamps are not money).
  const when = new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
  const { error: ue } = await fx!.svc.from('orders').update({ paid_at: when, created_at: when }).eq('id', id)
  if (ue) throw new Error(`backdate: ${ue.message}`)
  return id
}
async function pendingRequests(orderId: string) {
  const { data } = await fx!.svc.from('order_cancellation_requests').select('id, status').eq('order_id', orderId).eq('status', 'pending')
  return (data ?? []) as any[]
}

describe.skipIf(!hasEnv)('buyer Request Cancellation (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id, { delivery_time: '12h' })
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
    state.client = fx.buyer.client
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('order_cancellation_requests').delete().in('order_id', orderIds)
    for (const id of orderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', orderIds)
    await fx.cleanup()
  }, 60_000)

  it('12 h delivery, 2 h after payment: request created; the buyer can withdraw it', async () => {
    const id = await paidOrder(2)
    const r = await createCancellationRequest(id, 'Seller has not started and I no longer need it')
    expect(r.error).toBeUndefined()
    expect(await pendingRequests(id)).toHaveLength(1)
    const w = await cancelCancellationRequest(id)
    expect(w.error).toBeUndefined()
    expect(await pendingRequests(id)).toHaveLength(0)
  })

  it('inside the first hour after payment: too soon, nothing created', async () => {
    const id = await paidOrder(0.25)
    const r = await createCancellationRequest(id, 'Changed my mind about this order')
    expect(r.error?.message).toMatch(/one hour after paying/)
    expect(await pendingRequests(id)).toHaveLength(0)
  })

  it('a delivered order cannot request cancellation', async () => {
    const id = await paidOrder(3)
    await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
    const r = await createCancellationRequest(id, 'It never arrived at all')
    expect(r.error?.message).toMatch(/cannot be cancelled/)
    expect(await pendingRequests(id)).toHaveLength(0)
  })
})
