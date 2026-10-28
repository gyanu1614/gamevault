/**
 * Stripe card rail — webhook → paid on the local stack, through the REAL
 * spine (handleWebhook → webhook_event_claim → dispatch → order_confirm_payment).
 * Only the Stripe API is faked (the re-fetch); the signature check is
 * Stripe's own code over headers signed with Stripe's own test helper.
 *
 *   · a signed checkout.session.completed turns a pending order paid, with
 *     the same CHARGE_CONFIRMED journal a Payssion / fake payment writes,
 *     and closes the attempt as paid
 *   · a replay is deduped: no second dispatch, no second journal
 *   · a forged signature is rejected before any side effect
 *   · charge.refunded / charge.dispute.created alert admins and move nothing
 *     (order status, ledger and buyer wallet unchanged)
 *
 * Every row this file causes is removed in afterAll (orders, attempts,
 * ledger journals, webhook_events, notifications by link, audit logs).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Stripe from 'stripe'

import { hasEnv, makeFixture, promoteToEstablishedSeller, activateFixtureListing, type Fixture } from './throwaway'
import { purgeAuditLogs } from './fixture-namespace'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

/** What the faked Stripe API answers for the re-fetch, per object id. */
const stripeState: { sessions: Record<string, any>; charges: Record<string, any>; disputes: Record<string, any> } = {
  sessions: {},
  charges: {},
  disputes: {},
}
vi.mock('@/lib/payments/providers/stripe/client', () => ({
  STRIPE_API_VERSION: 'test',
  stripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: async (id: string) => {
          if (!stripeState.sessions[id]) throw new Error(`no such session ${id}`)
          return stripeState.sessions[id]
        },
      },
    },
    charges: { retrieve: async (id: string) => stripeState.charges[id] },
    disputes: { retrieve: async (id: string) => stripeState.disputes[id] },
  }),
}))

const SECRET = 'whsec_guard_test_dummy'
const CUR = 'USD'
const tag = () => Math.random().toString(36).slice(2, 8)
let fx: Fixture | null = null
const createdOrderIds: string[] = []

function signedEvent(type: string, objectId: string, secret = SECRET) {
  const payload = JSON.stringify({ id: `evt_${tag()}`, object: 'event', type, livemode: false, data: { object: { id: objectId } } })
  return { headers: { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret }) }, body: payload }
}

/** One pending order per (buyer, listing): cancel the fixture's / a previous test's first. */
async function parkPendingOrders() {
  const { data } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id).eq('status', 'pending')
  const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
  for (const o of (data ?? []) as any[]) await cancelOrderReturnWallet(o.id, 'test-reset')
}

async function pendingStripeOrder(totalMinor: number) {
  await parkPendingOrders()
  const orderNumber = `GT-STRIPE-${tag()}`
  const total = totalMinor / 100
  const { data: order, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: total, subtotal: total, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: total, seller_payout: total, currency: CUR,
    status: 'pending', escrow_status: 'pending', order_number: orderNumber, payment_provider: 'stripe',
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  const orderId = (order as any).id as string
  createdOrderIds.push(orderId)
  const sessionId = `cs_test_${orderId.replace(/-/g, '')}`
  const { error: aErr } = await fx!.svc.from('payment_attempts').insert({
    order_id: orderId, provider: 'stripe', provider_charge_id: sessionId, status: 'active',
    amount_minor: totalMinor, currency: CUR, order_total_minor: totalMinor, wallet_minor: 0,
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(), checkout_url: 'https://checkout.stripe.com/c/pay/x',
  })
  if (aErr) throw new Error(`attempt insert: ${aErr.message}`)
  stripeState.sessions[sessionId] = {
    id: sessionId, status: 'complete', payment_status: 'paid', amount_total: totalMinor, currency: 'usd',
    client_reference_id: orderId,
    metadata: { order_id: orderId, amount_minor: String(totalMinor), currency: CUR, order_number: orderNumber },
    payment_intent: `pi_${orderId.slice(0, 8)}`,
  }
  return { orderId, sessionId, orderNumber }
}

async function order(orderId: string) {
  const { data } = await fx!.svc.from('orders').select('status, escrow_status').eq('id', orderId).single()
  return data as any
}
async function confirmJournals(orderId: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id').eq('order_id', orderId).like('idempotency_key', '%CHARGE_CONFIRMED%')
  return (data ?? []).length
}
async function ledgerRows(orderId: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id').eq('order_id', orderId)
  return (data ?? []).length
}
async function walletMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', { p_user_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function sellerAvailableMinor(): Promise<number> {
  const { data, error } = await fx!.svc.rpc('ledger_balance', { p_owner_type: 'seller', p_owner_id: fx!.seller.id, p_kind: 'seller_available', p_currency: CUR } as any)
  if (error) throw new Error(`ledger_balance: ${error.message}`)
  return Number(data ?? 0)
}
async function adminAlert(orderId: string, titlePrefix: string) {
  const { data } = await fx!.svc.from('notifications').select('user_id, title, message')
    .eq('type', 'payment_review').eq('link', `/account/orders/${orderId}`).like('title', `${titlePrefix}%`)
  return ((data ?? []) as any[]).filter((n) => n.user_id === fx!.admin.id)
}

describe.skipIf(!hasEnv)('stripe webhook → paid (integration)', () => {
  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_guard_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id, { quantity: 50 })
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    const svc = fx.svc
    const users = [fx.buyer.id, fx.seller.id, fx.admin.id]
    const failures: string[] = []
    const del = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p
      if (error) failures.push(`${label}: ${error.message}`)
    }
    for (const id of createdOrderIds) {
      await del(`ledger_test_cleanup_by_order(${id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any))
      await del('notifications(by link)', svc.from('notifications').delete().like('link', `%${id}%`))
      await del('payment_attempts', svc.from('payment_attempts').delete().eq('order_id', id))
      await del('orders', svc.from('orders').delete().eq('id', id))
    }
    for (const s of Object.keys(stripeState.sessions)) {
      await del('webhook_events(session)', svc.from('webhook_events').delete().eq('provider', 'stripe').like('provider_event_id', `${s}:%`))
    }
    for (const c of [...Object.keys(stripeState.charges), ...Object.keys(stripeState.disputes)]) {
      await del('webhook_events(charge)', svc.from('webhook_events').delete().eq('provider', 'stripe').like('provider_event_id', `${c}:%`))
    }
    purgeAuditLogs(users, failures) // local stack only (fixture-namespace.ts)
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    if (failures.length) throw new Error(`stripe-webhook cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  it('a forged signature is rejected (400) and the order stays pending', async () => {
    const { handleWebhook } = await import('@/lib/payments/webhook-router')
    const { orderId, sessionId } = await pendingStripeOrder(1234)
    const forged = signedEvent('checkout.session.completed', sessionId, 'whsec_not_ours')
    const r = await handleWebhook('stripe', forged.headers, forged.body)
    expect(r.status).toBe(400)
    expect((await order(orderId)).status).toBe('pending')
    expect(await confirmJournals(orderId)).toBe(0)
  }, 30_000)

  it('checkout.session.completed turns the order paid, once; a replay is a no-op', async () => {
    const { handleWebhook } = await import('@/lib/payments/webhook-router')
    const { orderId, sessionId } = await pendingStripeOrder(1234)

    const first = signedEvent('checkout.session.completed', sessionId)
    const r1 = await handleWebhook('stripe', first.headers, first.body)
    expect(r1).toMatchObject({ ok: true, status: 200, processed: 1 })
    expect((await order(orderId)).status).toBe('paid')
    expect(await confirmJournals(orderId)).toBe(1)
    const { data: att } = await fx!.svc.from('payment_attempts').select('status').eq('provider_charge_id', sessionId).single()
    expect((att as any).status).toBe('paid')
    const ledgerAfterPay = await ledgerRows(orderId)

    // The same delivery again, and a different event reaching the same outcome.
    const again = await handleWebhook('stripe', first.headers, first.body)
    expect(again).toMatchObject({ ok: true, status: 200, deduped: true, processed: 0 })
    const asyncOk = signedEvent('checkout.session.async_payment_succeeded', sessionId)
    const r3 = await handleWebhook('stripe', asyncOk.headers, asyncOk.body)
    expect(r3).toMatchObject({ ok: true, deduped: true, processed: 0 })
    expect(await ledgerRows(orderId)).toBe(ledgerAfterPay)
    expect((await order(orderId)).status).toBe('paid')
  }, 30_000)

  it('a Stripe-paid order completes like any other: the seller is credited the payout', async () => {
    const { handleWebhook } = await import('@/lib/payments/webhook-router')
    const { orderId, sessionId } = await pendingStripeOrder(1500)
    const paid = signedEvent('checkout.session.completed', sessionId)
    expect((await handleWebhook('stripe', paid.headers, paid.body)).ok).toBe(true)
    const before = await sellerAvailableMinor()
    const delivered = await fx!.svc.rpc('order_mark_delivered', { p_order_id: orderId, p_seller_id: fx!.seller.id } as any)
    expect(delivered.error).toBeNull()
    const confirmed = await fx!.svc.rpc('order_confirm_receipt', { p_order_id: orderId, p_buyer_id: fx!.buyer.id } as any)
    expect(confirmed.error).toBeNull()
    expect((await order(orderId)).status).toBe('completed')
    // seller_payout on the fixture order is the full $15.00 (no commission set).
    expect(await sellerAvailableMinor()).toBe(before + 1500)
  }, 30_000)

  it('charge.refunded and charge.dispute.created alert admins and move no money', async () => {
    const { handleWebhook } = await import('@/lib/payments/webhook-router')
    const { orderId, sessionId, orderNumber } = await pendingStripeOrder(2500)
    const paid = signedEvent('checkout.session.completed', sessionId)
    expect((await handleWebhook('stripe', paid.headers, paid.body)).ok).toBe(true)
    const ledgerBefore = await ledgerRows(orderId)
    const walletBefore = await walletMinor(fx!.buyer.id)

    const chargeId = `ch_${orderId.slice(0, 8)}`
    stripeState.charges[chargeId] = {
      id: chargeId, amount_refunded: 2500, currency: 'usd',
      payment_intent: { id: `pi_${orderId.slice(0, 8)}`, metadata: { order_id: orderId } },
    }
    const refunded = signedEvent('charge.refunded', chargeId)
    expect(await handleWebhook('stripe', refunded.headers, refunded.body)).toMatchObject({ ok: true, processed: 1 })
    const refundAlerts = await adminAlert(orderId, 'Card Refund Recorded')
    expect(refundAlerts).toHaveLength(1)
    expect(refundAlerts[0].title).toBe('Card Refund Recorded · $25.00')
    expect(refundAlerts[0].message).toContain(orderNumber)

    const disputeId = `dp_${orderId.slice(0, 8)}`
    stripeState.disputes[disputeId] = {
      id: disputeId, amount: 2500, currency: 'usd', reason: 'fraudulent', charge: chargeId,
      evidence_details: { due_by: null }, payment_intent: { id: `pi_${orderId.slice(0, 8)}`, metadata: { order_id: orderId } },
    }
    const disputed = signedEvent('charge.dispute.created', disputeId)
    expect(await handleWebhook('stripe', disputed.headers, disputed.body)).toMatchObject({ ok: true, processed: 1 })
    expect(await adminAlert(orderId, 'Card Dispute Opened')).toHaveLength(1)

    // Replays alert nobody twice.
    expect(await handleWebhook('stripe', refunded.headers, refunded.body)).toMatchObject({ deduped: true })
    expect(await adminAlert(orderId, 'Card Refund Recorded')).toHaveLength(1)

    // Nothing moved.
    expect((await order(orderId)).status).toBe('paid')
    expect(await ledgerRows(orderId)).toBe(ledgerBefore)
    expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)
  }, 30_000)
})
