/**
 * Buyers keep seeing what they bought (integration) —
 * migration 20260927191606_listings_buyer_can_read_ordered.
 *   · a paused listing is hidden from a signed-in user with no order on it
 *     and from the public (anon);
 *   · once that user has an order for it, they can read it (their order
 *     page / list / wallet / chat stop losing the item).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture, activateFixtureListing, URL, ANON } from './throwaway'
import { createClient } from '@supabase/supabase-js'

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
describe.skipIf(!hasEnv)('listings: a buyer can read the listing they ordered (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of createdOrderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', createdOrderIds)
    await fx.cleanup()
  }, 60_000)

  it('paused listing: hidden from the public and from a signed-in user without an order', async () => {
    expect((await fx!.svc.from('listings').update({ status: 'paused' }).eq('id', fx!.listingId)).error).toBeNull()
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const pub = await anon.from('listings').select('id').eq('id', fx!.listingId)
    expect(pub.data ?? []).toHaveLength(0)
    // Temporarily move the buyer's existing fixture orders off this listing
    // so the buyer truly has no order on it.
    const { data: mine } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id).eq('listing_id', fx!.listingId)
    const ids = ((mine ?? []) as any[]).map((o) => o.id)
    if (ids.length) await fx!.svc.from('orders').update({ buyer_id: fx!.admin.id }).in('id', ids)
    const none = await fx!.buyer.client.from('listings').select('id').eq('id', fx!.listingId)
    expect(none.data ?? []).toHaveLength(0)
    if (ids.length) await fx!.svc.from('orders').update({ buyer_id: fx!.buyer.id }).in('id', ids)
  })

  it('the buyer of an order can read that listing even though it is paused', async () => {
    await fx!.svc.from('listings').update({ status: 'active' }).eq('id', fx!.listingId)
    await insertPaidOrder()
    expect((await fx!.svc.from('listings').update({ status: 'paused' }).eq('id', fx!.listingId)).error).toBeNull()
    const { data } = await fx!.buyer.client.from('listings').select('id, title, images').eq('id', fx!.listingId)
    expect(data ?? []).toHaveLength(1)
    // The order page's join works too.
    const { data: joined } = await fx!.buyer.client
      .from('orders').select('id, listing:listing_id ( id, title )').eq('id', createdOrderIds[createdOrderIds.length - 1]).single()
    expect((joined as any)?.listing?.id).toBe(fx!.listingId)
  })
})
