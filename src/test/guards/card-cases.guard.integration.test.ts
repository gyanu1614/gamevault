/**
 * Card safeguards (2026-10-28, migration 20261028143542) — integration, real RPCs.
 *
 *   · a FULL card refund made outside DropMarket before completion: order
 *     refunded, seller never credited, NO store credit (no double pay); the
 *     wallet part of a split payment goes back to the wallet; replay is a no-op;
 *   · a partial or odd refund is recorded for review and moves nothing;
 *   · after completion the seller share is frozen until an admin decides;
 *     no other path can release the order meanwhile; Seller Pays / DropMarket
 *     Pays book exactly the card part;
 *   · a card dispute holds the order and blocks the buyer; won → released when
 *     delivered, else it stays with the admin; lost → the seller pays without
 *     delivery proof, DropMarket absorbs a delivered + confirmed order;
 *   · a fault inside any step rolls the whole step back.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture, activateFixtureListing } from './throwaway'

let sessionClient: any = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
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
const orders: string[] = []

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
async function order(id: string) {
  return ((await fx!.svc.from('orders').select('*').eq('id', id).single()).data ?? {}) as any
}
async function cases(id: string) {
  return ((await fx!.svc.from('card_cases').select('*').eq('order_id', id)).data ?? []) as any[]
}
async function bal(owner: 'seller' | 'platform' | 'provider', kind: string): Promise<number> {
  const ownerId = owner === 'seller' ? fx!.seller.id : null
  return Number(await rpc('ledger_balance', { p_owner_type: owner, p_owner_id: ownerId, p_kind: kind, p_currency: CUR }))
}
async function wallet(): Promise<number> {
  return Number(await rpc('user_wallet_balance', { p_user_id: fx!.buyer.id, p_currency: CUR }))
}
async function entriesOf(key: string) {
  const { data: txn } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()
  if (!txn) return null
  const { data } = await fx!.svc.from('ledger_entries').select('direction, amount_minor, account:account_id ( kind, owner_type )').eq('transaction_id', (txn as any).id)
  return ((data ?? []) as any[]).map((e) => `${e.account.owner_type}.${e.account.kind}:${e.direction}:${e.amount_minor}`).sort()
}
async function blocked(): Promise<boolean> {
  return Boolean((await fx!.svc.from('buyer_blocks').select('user_id').eq('user_id', fx!.buyer.id).maybeSingle()).data)
}

/** total 1.00, seller payout 0.80 (the platform takes 0.20). `walletMinor`
 *  of the gross is paid from the buyer's wallet, the rest by card. */
async function paidOrder(walletMinor = 0): Promise<string> {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0.2, payment_processing_fee: 0, total_amount: 1, seller_payout: 0.8, currency: CUR,
    status: 'pending', escrow_status: 'pending',
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const id = (data as any).id as string
  orders.push(id)
  if (walletMinor > 0) {
    await rpc('post_journal', {
      p_idempotency_key: `checkout_wallet:${id}`, p_event_ref: 'CHECKOUT_WALLET', p_order_id: id, p_matures_at: null,
      p_entries: [
        { owner_type: 'buyer', owner_id: fx!.buyer.id, kind: 'user_wallet', direction: 'debit', amount_minor: walletMinor, currency: CUR },
        { owner_type: 'platform', owner_id: null, kind: 'escrow_held', direction: 'credit', amount_minor: walletMinor, currency: CUR },
      ],
    })
  }
  await rpc('safedrop_transition', { p_order_id: id, p_event: 'CHARGE_CONFIRMED', p_dedupe_key: null, p_release_method: null, p_refund_minor: null })
  return id
}
async function delivered(): Promise<string> {
  const id = await paidOrder()
  await rpc('order_mark_delivered', { p_order_id: id, p_seller_id: fx!.seller.id })
  return id
}
async function completed(): Promise<string> {
  const id = await delivered()
  await rpc('order_confirm_receipt', { p_order_id: id, p_buyer_id: fx!.buyer.id })
  return id
}
const refund = (id: string, amount = 100) =>
  rpc('card_refund_external_book', { p_order_id: id, p_ref: `ch_${id}:refund`, p_amount_minor: amount, p_currency: CUR })
const disputeOpen = (id: string) =>
  rpc('card_dispute_open', { p_order_id: id, p_ref: `dp_${id}`, p_amount_minor: 100, p_currency: CUR, p_reason: 'fraudulent', p_due_by: null })
const disputeClose = (id: string, outcome: 'won' | 'lost') => rpc('card_dispute_close', { p_ref: `dp_${id}`, p_outcome: outcome })

describe.skipIf(!hasEnv)('card safeguards: external refunds, chargebacks, buyer block (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('card_paid_minor' as any, { p_order_id: fx.pendingOrderId })).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const links = orders.flatMap((id) => [`/admin/orders/${id}`, `/account/orders/${id}`])
    await fx.svc.from('notifications').delete().in('link', links)
    await fx.svc.from('order_dispute_events').delete().in('order_id', orders)
    await fx.svc.from('disputes').delete().in('transaction_id', orders)
    await fx.svc.from('buyer_blocks').delete().eq('user_id', fx.buyer.id)
    for (const id of orders) await fx.svc.rpc('ledger_test_cleanup_by_order' as any, { p_order_id: id })
    await fx.svc.from('orders').delete().in('id', orders) // card_cases cascade
    await fx.cleanup()
  }, 60_000)

  it('migration is applied', () => {
    expect(ready, 'apply 20261028143542_card_cases first').toBe(true)
  })

  it('external full refund before completion: refunded, seller unpaid, no store credit, replay is a no-op', async () => {
    const id = await paidOrder()
    const w = await wallet()
    const avail = await bal('seller', 'seller_available')
    expect(await refund(id)).toMatchObject({ booked: true, bearer: 'seller' })
    expect(await order(id)).toMatchObject({ status: 'refunded', escrow_status: 'refunded' })
    const [c] = await cases(id)
    expect(c).toMatchObject({ kind: 'refund', status: 'settled', bearer: 'seller', card_minor: 100 })
    expect(await entriesOf(`card_case_out:${c.id}`)).toEqual(['platform.refunds:debit:100', 'provider.provider_float:credit:100'].sort())
    expect(await wallet()).toBe(w)
    expect(await bal('seller', 'seller_available')).toBe(avail)
    expect(await refund(id)).toMatchObject({ booked: false, reason: 'already_recorded' })
  })

  it('split payment: only the card part leaves, the wallet part goes back to the wallet', async () => {
    const id = await paidOrder(30)
    const w = await wallet()
    expect(await refund(id, 70)).toMatchObject({ booked: true })
    const [c] = await cases(id)
    expect(c.card_minor).toBe(70)
    expect(await wallet()).toBe(w + 30)
  })

  it('a partial refund or one on a refunded order is recorded for review and moves nothing', async () => {
    const id = await paidOrder()
    expect(await refund(id, 40)).toMatchObject({ booked: false, reason: 'review' })
    expect(await order(id)).toMatchObject({ status: 'paid', escrow_status: 'held' })
    expect((await cases(id))[0]).toMatchObject({ status: 'review' })

    const done = await paidOrder()
    await rpc('safedrop_transition', { p_order_id: done, p_event: 'REFUNDED', p_dedupe_key: 'guard', p_release_method: null, p_refund_minor: null })
    expect(await refund(done)).toMatchObject({ booked: false, reason: 'review' })
  })

  it('after completion: the seller share is frozen, nothing else can release it, Seller Pays books the loss', async () => {
    const id = await completed()
    const avail = await bal('seller', 'seller_available')
    expect(await refund(id)).toMatchObject({ reason: 'awaiting_decision' })
    expect(await order(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect(await bal('seller', 'seller_available')).toBe(avail - 80)

    const sneak = await (fx!.svc.rpc as any)('safedrop_transition', { p_order_id: id, p_event: 'DISPUTE_RESOLVED_SELLER', p_dedupe_key: 'sneak', p_release_method: null, p_refund_minor: null })
    expect(sneak.error?.message).toMatch(/held by a card dispute or refund/)

    const [c] = await cases(id)
    const commission = await bal('platform', 'platform_commission')
    expect(await rpc('card_case_settle', { p_case_id: c.id, p_bearer: 'seller', p_actor_id: fx!.admin.id })).toMatchObject({ settled: true })
    expect(await order(id)).toMatchObject({ status: 'refunded' })
    expect(await bal('seller', 'seller_frozen')).toBe(0)
    expect(await bal('seller', 'seller_available')).toBe(avail - 80)
    expect(await bal('platform', 'platform_commission')).toBe(commission - 20)
    expect((await cases(id))[0]).toMatchObject({ status: 'settled', bearer: 'seller', decided_by: fx!.admin.id })
    expect(await rpc('card_case_settle', { p_case_id: c.id, p_bearer: 'platform', p_actor_id: fx!.admin.id })).toMatchObject({ settled: false })
  })

  it('after completion, DropMarket Pays: the seller keeps the sale, the commission pays the card back', async () => {
    const id = await completed()
    const avail = await bal('seller', 'seller_available')
    await refund(id)
    const [c] = await cases(id)
    const commission = await bal('platform', 'platform_commission')
    await rpc('card_case_settle', { p_case_id: c.id, p_bearer: 'platform', p_actor_id: fx!.admin.id })
    expect(await order(id)).toMatchObject({ status: 'completed', escrow_status: 'released' })
    expect(await bal('seller', 'seller_available')).toBe(avail)
    expect(await bal('platform', 'platform_commission')).toBe(commission - 100)
    expect(await entriesOf(`card_case_out:${c.id}`)).toEqual(['platform.platform_commission:debit:100', 'provider.provider_float:credit:100'].sort())
  })

  it('a dispute holds the order and blocks the buyer; won on a delivered order releases it to the seller', async () => {
    await fx!.svc.from('buyer_blocks').delete().eq('user_id', fx!.buyer.id)
    const id = await delivered()
    const avail = await bal('seller', 'seller_available')
    expect(await disputeOpen(id)).toMatchObject({ opened: true, status: 'open' })
    expect(await order(id)).toMatchObject({ status: 'disputed' })
    expect(await blocked()).toBe(true)
    expect(await disputeOpen(id)).toMatchObject({ opened: false, reason: 'already_recorded' })

    expect(await disputeClose(id, 'won')).toMatchObject({ closed: true, outcome: 'won' })
    expect(await order(id)).toMatchObject({ status: 'completed' })
    expect(await bal('seller', 'seller_available')).toBe(avail + 80)
    const { data: d } = await fx!.svc.from('disputes').select('status').eq('transaction_id', id).single()
    expect((d as any).status).toBe('resolved_seller_favor')
    expect(await disputeClose(id, 'lost')).toMatchObject({ closed: false, reason: 'already_closed' })
  })

  it('won on an undelivered order: the order stays on hold for the admin', async () => {
    const id = await paidOrder()
    await disputeOpen(id)
    await disputeClose(id, 'won')
    expect(await order(id)).toMatchObject({ status: 'disputed' })
    expect((await cases(id))[0]).toMatchObject({ status: 'won' })
  })

  it('lost without delivery proof: the seller pays, no store credit', async () => {
    const id = await paidOrder()
    const w = await wallet()
    await disputeOpen(id)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'seller' })
    expect(await order(id)).toMatchObject({ status: 'refunded' })
    expect(await wallet()).toBe(w)
  })

  it('lost on a delivered + confirmed order: DropMarket absorbs, the seller keeps the sale', async () => {
    const id = await completed()
    const avail = await bal('seller', 'seller_available')
    const commission = await bal('platform', 'platform_commission')
    await disputeOpen(id)
    expect(await bal('seller', 'seller_available')).toBe(avail - 80)
    expect(await disputeClose(id, 'lost')).toMatchObject({ settled: true, bearer: 'platform' })
    expect(await order(id)).toMatchObject({ status: 'completed' })
    expect(await bal('seller', 'seller_available')).toBe(avail)
    expect(await bal('platform', 'platform_commission')).toBe(commission - 100)
  })

  it('a dispute on an already refunded order is recorded for review; nothing is held', async () => {
    const id = await paidOrder()
    await rpc('safedrop_transition', { p_order_id: id, p_event: 'REFUNDED', p_dedupe_key: 'guard', p_release_method: null, p_refund_minor: null })
    expect(await disputeOpen(id)).toMatchObject({ opened: false, status: 'review' })
    expect(await order(id)).toMatchObject({ status: 'refunded' })
  })

  it('a blocked buyer cannot check out or retry a payment; unblocking lets them back', async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    vi.resetModules()
    const { createCheckout, retryOrderPayment } = await import('@/lib/actions/checkout')
    const { BUYER_BLOCKED_MESSAGE } = await import('@/lib/checkout/buyer-block')
    await fx!.svc.from('buyer_blocks').upsert({ user_id: fx!.buyer.id, reason: 'card_dispute', source_ref: 'dp_guard' })
    sessionClient = fx!.buyer.client
    expect(await createCheckout({ listingId: fx!.listingId, quantity: 1 })).toMatchObject({ success: false, error: BUYER_BLOCKED_MESSAGE })
    expect(await retryOrderPayment(fx!.pendingOrderId)).toMatchObject({ success: false, error: BUYER_BLOCKED_MESSAGE })
    expect(await rpc('buyer_unblock', { p_user_id: fx!.buyer.id })).toBe(true)
    expect(await blocked()).toBe(false)
    expect(await rpc('buyer_unblock', { p_user_id: fx!.buyer.id })).toBe(false)
    delete process.env.NEXT_PUBLIC_PURCHASES_ENABLED
  })

  it('signed-in users can neither read the case tables nor call the card functions', async () => {
    const client = fx!.buyer.client
    expect((await client.from('card_cases').select('id').limit(1)).data ?? []).toEqual([])
    expect((await client.from('buyer_blocks').select('user_id').limit(1)).data ?? []).toEqual([])
    const r = await (client.rpc as any)('buyer_unblock', { p_user_id: fx!.buyer.id })
    expect(r.error?.message).toMatch(/permission denied/i)
  })

  it.skipIf(!TARGET_IS_LOCAL)('a fault inside a step rolls the whole step back', async () => {
    const id = await paidOrder()
    const before = await order(id)
    const err = withFault('card_case_settle:after_journal',
      `SELECT public.card_refund_external_book('${id}', 'ch_fault_${id}:refund', 100, 'USD')`)
    expect(err).toMatch(/money_fault/)
    expect(await cases(id)).toHaveLength(0)
    expect(await order(id)).toMatchObject({ status: before.status, escrow_status: before.escrow_status })

    await fx!.svc.from('buyer_blocks').delete().eq('user_id', fx!.buyer.id)
    const err2 = withFault('card_dispute_open:after_hold',
      `SELECT public.card_dispute_open('${id}', 'dp_fault_${id}', 100, 'USD', 'fraudulent', NULL)`)
    expect(err2).toMatch(/money_fault/)
    expect(await cases(id)).toHaveLength(0)
    expect(await blocked()).toBe(false)
    expect(await order(id)).toMatchObject({ status: 'paid' })
  })
})
