/**
 * Admin resolveDispute action (integration, real RPC + action):
 *   · a PARTIAL refund sends the dispute-resolved email (with the wallet
 *     note), never the "cancelled and refunded" email — the order completes;
 *   · a FULL refund still sends the refunded email;
 *   · the resolution card is posted into the order chat (system notice).
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

const createdConvoIds: string[] = []
async function withConversation(orderId: string) {
  const { data, error } = await fx!.svc.from('conversations')
    .insert({ order_id: orderId, buyer_id: fx!.buyer.id, seller_id: fx!.seller.id }).select('id').single()
  if (error) throw new Error(`conversation: ${error.message}`)
  createdConvoIds.push((data as any).id)
  return (data as any).id as string
}

describe.skipIf(!hasEnv)('admin resolveDispute — emails + chat card (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_disputes_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (createdConvoIds.length) {
      await fx.svc.from('messages').delete().in('conversation_id', createdConvoIds)
      await fx.svc.from('conversations').delete().in('id', createdConvoIds)
    }
    await fx.svc.from('order_dispute_events').delete().in('order_id', createdOrderIds)
    await fx.svc.from('dispute_resolutions').delete().in('dispute_id', createdDisputeIds)
    await fx.svc.from('disputes').delete().in('id', createdDisputeIds)
    for (const id of createdOrderIds) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', createdOrderIds)
    await fx.cleanup()
  }, 60_000)

  it('migration is applied', () => {
    expect(ready).toBe(true)
  })

  it('partial refund: dispute-resolved email with the wallet note, no "refunded" email, card in chat', async () => {
    const id = await insertPaidOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const convo = await withConversation(id)
    const d = await open(id)
    mail.refunded.mockClear(); mail.resolved.mockClear()
    const { resolveDispute } = await import('@/lib/actions/admin-disputes')
    const r = await resolveDispute(d.dispute_id, {
      status: 'resolved_partial', resolutionType: 'refund_partial', resolvedAmount: 0.3, notes: 'guard partial',
    })
    expect(r).toEqual({ success: true })
    expect(mail.refunded).not.toHaveBeenCalled()
    const buyerCall = (mail.resolved.mock.calls as any[]).find((c) => c[0].resolution === 'resolved_partial')
    expect(buyerCall?.[0]).toMatchObject({ amount: 0.3, note: expect.stringMatching(/Store Balance/) })
    const { data: msgs } = await fx!.svc.from('messages').select('sender_id, content').eq('conversation_id', convo)
    const card = ((msgs ?? []) as any[]).find((m) => m.sender_id === null)
    expect(JSON.parse(card.content)).toMatchObject({ type: 'dispute_resolved', resolution: 'partial', resolvedBy: 'admin' })
  })

  it('full refund: the refunded email is still sent', async () => {
    const id = await insertPaidOrder()
    await withConversation(id)
    const d = await open(id)
    mail.refunded.mockClear()
    const { resolveDispute } = await import('@/lib/actions/admin-disputes')
    const r = await resolveDispute(d.dispute_id, {
      status: 'resolved_buyer_favor', resolutionType: 'refund_full', notes: 'guard full',
    })
    expect(r).toEqual({ success: true })
    expect(mail.refunded).toHaveBeenCalledTimes(1)
  })
})
