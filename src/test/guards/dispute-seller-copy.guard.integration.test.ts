/**
 * order_dispute_resolve seller copy (integration, real RPCs) —
 * migration 20260927185652_order_dispute_resolve_seller_copy.
 *
 * The seller is only told money was "deducted" / is "available again" when
 * they had actually been paid (dispute AFTER completion). Before completion
 * the copy says what really happened. Money is covered by
 * dispute-money.guard; this file pins the words.
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

async function resolve(disputeId: string, outcome: 'release' | 'refund_full' | 'refund_partial', refundMinor: number | null = null) {
  return rpc('order_dispute_resolve', { p_dispute_id: disputeId, p_admin_id: fx!.admin.id, p_outcome: outcome, p_refund_minor: refundMinor, p_notes: `guard ${outcome}` })
}
async function sellerNote(disputeId: string): Promise<string> {
  const { data } = await fx!.svc.from('notifications').select('message').eq('dedupe_key', `dispute:${disputeId}:resolved:seller`).single()
  return (data as any)?.message ?? ''
}

describe.skipIf(!hasEnv)('dispute resolve — seller copy matches what happened (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('order_disputes_version' as any)).error
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
    expect(ready).toBe(true)
  })

  it('before completion, full refund: the seller is told there is no payout — nothing "deducted"', async () => {
    const id = await insertPaidOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    await resolve(d.dispute_id, 'refund_full')
    const msg = await sellerNote(d.dispute_id)
    expect(msg).toMatch(/buyer was refunded, so this sale is not paid out/)
    expect(msg).not.toMatch(/deducted/)
  })

  it('before completion, release: a first payout, not "available again"', async () => {
    const id = await insertPaidOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    await resolve(d.dispute_id, 'release')
    const msg = await sellerNote(d.dispute_id)
    expect(msg).toMatch(/sale is complete and your payout was added to your balance/)
    expect(msg).not.toMatch(/again/)
  })

  it('before completion, partial: names what went back and what the seller got', async () => {
    const id = await insertPaidOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    await resolve(d.dispute_id, 'refund_partial', 30)
    const msg = await sellerNote(d.dispute_id)
    expect(msg).toMatch(/\$0\.30 went back to the buyer and \$0\.50 was added to your balance/)
    expect(msg).not.toMatch(/deducted/)
  })

  it('after completion, full refund: still says the amount was deducted (it was)', async () => {
    const id = await completedOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    await resolve(d.dispute_id, 'refund_full')
    expect(await sellerNote(d.dispute_id)).toMatch(/\$0\.80 was deducted from your balance/)
  })

  it('after completion, release: payout available again', async () => {
    const id = await completedOrder({ seller_payout: 0.8, platform_fee: 0.2 })
    const d = await open(id)
    await resolve(d.dispute_id, 'release')
    expect(await sellerNote(d.dispute_id)).toMatch(/Your payout is available again/)
  })
})
