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
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture, activateFixtureListing } from './throwaway'
import { cardCaseKit, TARGET_IS_LOCAL, withFault } from './card-cases-kit'

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

let fx: Fixture | null = null
let ready = false
const orders: string[] = []
const {
  rpc, order, cases, bal, wallet, entriesOf, blocked, paidOrder, delivered, completed,
  refund, disputeOpen, disputeClose, safedropDisputes, cleanup,
} = cardCaseKit(() => fx!, orders)

describe.skipIf(!hasEnv)('card safeguards: external refunds, chargebacks, buyer block (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await (fx.svc as any).from('card_cases').select('session_ref').limit(1)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('orders').update({ status: 'cancelled' }).eq('id', fx.pendingOrderId)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await cleanup()
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
    // The seller kept the sale: the case's SafeDrop row closes neutral, not as a buyer win.
    expect((await safedropDisputes(id)).map((d) => d.status)).toEqual(['closed'])
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

  it('a refund or dispute of a payment that did not pay the order (duplicate / late) is only recorded', async () => {
    const id = await paidOrder()
    expect(await refund(id, 100, 'cs_duplicate')).toMatchObject({ booked: false, reason: 'review' })
    expect(await order(id)).toMatchObject({ status: 'paid', escrow_status: 'held' })
    await fx!.svc.from('payment_attempts').update({ credited_minor: 100, credit_reason: 'late' } as any).eq('order_id', id)
    expect(await disputeOpen(id)).toMatchObject({ opened: false, status: 'review' })
    expect(await order(id)).toMatchObject({ status: 'paid' })
  })

  it('one active case per order: a chargeback during a refund decision is only recorded; settling twice is refused', async () => {
    const id = await completed()
    await refund(id)
    expect(await disputeOpen(id)).toMatchObject({ opened: false, status: 'review' })
    const [refundCase] = (await cases(id)).filter((c) => c.kind === 'refund')
    await rpc('card_case_settle', { p_case_id: refundCase.id, p_bearer: 'seller', p_actor_id: fx!.admin.id })
    expect(await order(id)).toMatchObject({ status: 'refunded' })
    const again = await (fx!.svc.rpc as any)('card_case_settle_internal', { p_case_id: refundCase.id, p_bearer: 'seller', p_actor_id: null })
    expect(again.data).toMatchObject({ settled: false, reason: 'already_settled' })
  })

  it('freezes under its own key even after an earlier admin dispute on the order was released', async () => {
    const id = await completed()
    const opened = await rpc('order_dispute_open', { p_order_id: id, p_actor_id: fx!.admin.id, p_actor_role: 'admin', p_reason: 'other', p_title: 'guard', p_description: 'guard admin dispute' })
    await rpc('order_dispute_resolve', { p_dispute_id: opened.dispute_id, p_admin_id: fx!.admin.id, p_outcome: 'release', p_refund_minor: null, p_notes: 'guard release' })
    const avail = await bal('seller', 'seller_available')
    await disputeOpen(id)
    expect(await order(id)).toMatchObject({ status: 'disputed', escrow_status: 'frozen' })
    expect(await bal('seller', 'seller_available')).toBe(avail - 80)
  })

  it('won while the buyer\'s own dispute is open: nothing is released, their dispute stays open', async () => {
    const id = await delivered()
    await rpc('order_dispute_open', { p_order_id: id, p_actor_id: fx!.buyer.id, p_actor_role: 'buyer', p_reason: 'item_not_received', p_title: 'guard', p_description: 'guard buyer dispute' })
    await disputeOpen(id)
    await disputeClose(id, 'won')
    expect(await order(id)).toMatchObject({ status: 'disputed' })
    expect((await safedropDisputes(id)).map((d) => d.status)).toEqual(['open'])
  })

  it('a partial chargeback lost: the hold lifts and the order goes back to the admin tools', async () => {
    const id = await delivered()
    await disputeOpen(id, 60)
    expect(await disputeClose(id, 'lost')).toMatchObject({ closed: true, settled: false })
    expect((await cases(id))[0]).toMatchObject({ status: 'review' })
    const [d] = await safedropDisputes(id)
    expect(d.status).toBe('open')
    // The SafeDrop seam may now settle it (the guard no longer holds the order).
    await rpc('order_dispute_resolve', { p_dispute_id: d.id, p_admin_id: fx!.admin.id, p_outcome: 'release', p_refund_minor: null, p_notes: 'guard settle' })
    expect(await order(id)).toMatchObject({ status: 'completed' })
  })

  it('a close for a dispute not recorded yet raises, so Stripe retries', async () => {
    const r = await (fx!.svc.rpc as any)('card_dispute_close', { p_ref: 'dp_never_opened', p_outcome: 'lost' })
    expect(r.error?.message).toMatch(/not recorded yet/)
  })

  it.skipIf(!TARGET_IS_LOCAL)('a fault inside a step rolls the whole step back', async () => {
    const id = await paidOrder()
    const before = await order(id)
    const err = withFault('card_case_settle:after_journal',
      `SELECT public.card_refund_external_book('${id}', 'ch_fault_${id}:refund', 'cs_${id}', 100, 'USD')`)
    expect(err).toMatch(/money_fault/)
    expect(await cases(id)).toHaveLength(0)
    expect(await order(id)).toMatchObject({ status: before.status, escrow_status: before.escrow_status })

    await fx!.svc.from('buyer_blocks').delete().eq('user_id', fx!.buyer.id)
    const err2 = withFault('card_dispute_open:after_hold',
      `SELECT public.card_dispute_open('${id}', 'dp_fault_${id}', 'cs_${id}', 100, 'USD', 'fraudulent', NULL)`)
    expect(err2).toMatch(/money_fault/)
    expect(await cases(id)).toHaveLength(0)
    expect(await blocked()).toBe(false)
    expect(await order(id)).toMatchObject({ status: 'paid' })
  })
})
