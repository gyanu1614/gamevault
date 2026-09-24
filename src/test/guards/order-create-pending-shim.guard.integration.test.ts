/**
 * Checkout B3 — the 21-arg `order_create_pending` compatibility shim
 * (20260924051344). DELETE THIS FILE with the shim in the cleanup PR.
 *
 *   · both overloads produce IDENTICAL orders (every money column, the fee
 *     snapshot, the attempt) for the same inputs — the shim ignores the three
 *     legacy money args and derives the method from pm_id / provider;
 *   · an OLD-code checkout completes end to end against the new DB: the
 *     round-B RPC sequence (21-arg create → payment_attempt_activate →
 *     order_confirm_payment) lands a paid order with the quoted fee;
 *   · the shim is service-role only.
 *
 * Every row this file causes is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { ANON, URL, hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

let fx: Fixture | null = null
let listingId = ''
const CUR = 'USD'
const PRICE = 19.99
const tag = () => Math.random().toString(36).slice(2, 8)
const createdOrderIds: string[] = []

const COMMON = () => ({
  p_buyer_id: fx!.buyer.id, p_seller_id: fx!.seller.id, p_listing_id: listingId, p_quantity: 1,
  p_unit_price: PRICE, p_subtotal: PRICE, p_platform_fee_rate: 2, p_platform_fee: 0.4,
  p_seller_payout: 18.59, p_seller_commission_pct: 7, p_seller_fee_trace: { guard: true },
  p_currency: CUR, p_promo_code_id: null, p_promo_discount: 0, p_wallet_minor: '0',
  p_fallback_expires_at: '2030-01-01T00:00:00.000Z',
})
/** The round-B (old code) shape: three legacy money args carry deliberately WRONG values. */
const legacyArgs = (provider: string, pmId: string | null) => ({
  ...COMMON(), p_payment_processing_fee_rate: 12.5, p_payment_processing_fee: 9.99, p_total_amount: 99.99,
  p_provider: provider, p_pm_id: pmId,
})
const newArgs = (provider: string, pmId: string | null, method: string) => ({
  ...COMMON(), p_provider: provider, p_pm_id: pmId, p_buyer_fee_method: method,
})

async function create(args: Record<string, unknown>) {
  const { data, error } = await fx!.svc.rpc('order_create_pending', args as any)
  if (error) throw new Error(`order_create_pending: ${error.message}`)
  const r = data as any
  createdOrderIds.push(r.order_id)
  return r
}
async function orderRow(id: string) {
  const { data, error } = await fx!.svc.from('orders').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as any
}
async function attemptRow(orderId: string) {
  const { data } = await fx!.svc.from('payment_attempts').select('*').eq('order_id', orderId).maybeSingle()
  return data as any
}
async function park(orderId: string) {
  const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
  await cancelOrderReturnWallet(orderId, 'test-reset')
}
const MONEY_COLS = ['subtotal', 'platform_fee_rate', 'platform_fee', 'payment_processing_fee_rate', 'payment_processing_fee', 'total_amount', 'seller_payout', 'seller_commission_pct', 'buyer_fee_pct', 'buyer_fee_amount', 'buyer_fee_method', 'currency', 'status', 'escrow_status', 'promo_discount', 'payment_provider', 'quantity', 'unit_price']
const pick = (row: any) => Object.fromEntries(MONEY_COLS.map((c) => [c, row[c]]))

describe.skipIf(!hasEnv)('order_create_pending 21-arg compatibility shim (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    const { data: base } = await fx.svc.from('listings').select('game_id, game_category_id').eq('id', fx.listingId).single()
    const { data: l, error } = await fx.svc.from('listings').insert({
      seller_id: fx.seller.id, game_id: (base as any).game_id, game_category_id: (base as any).game_category_id,
      title: `GUARD-TEST-shim-${tag()}`, description: 'shim throwaway', price: PRICE, quantity: 50, status: 'active',
    }).select('id, status').single()
    if (error || (l as any)?.status !== 'active') throw new Error(`listing insert: ${error?.message ?? (l as any)?.status}`)
    listingId = (l as any).id
  }, 90_000)

  afterAll(async () => {
    if (!fx) return
    const svc = fx.svc
    const failures: string[] = []
    for (const id of createdOrderIds) {
      const { error: e1 } = await svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any)
      if (e1) failures.push(`ledger cleanup ${id}: ${e1.message}`)
      await svc.from('notifications').delete().like('link', `%${id}%`)
      await svc.from('provider_cancel_outbox').delete().eq('order_id', id)
      await svc.from('payment_attempts').delete().eq('order_id', id)
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (listingId) {
      const { error } = await svc.from('listings').delete().eq('id', listingId)
      if (error) failures.push(`listing: ${error.message}`)
    }
    if (failures.length) throw new Error(`shim cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  it.each([
    ['crypto (fake provider, no pm_id)', 'fake', null, 'fake'],
    ['Payssion local (pm_id gcash_ph)', 'payssion', 'gcash_ph', 'gcash_ph'],
  ])('%s: the 21-arg shim and the 19-arg function produce identical orders and attempts', async (_label, provider, pmId, method) => {
    const a = await create(legacyArgs(provider, pmId))
    const rowA = await orderRow(a.order_id)
    const attA = await attemptRow(a.order_id)
    await park(a.order_id)
    const b = await create(newArgs(provider, pmId, method))
    const rowB = await orderRow(b.order_id)
    const attB = await attemptRow(b.order_id)
    await park(b.order_id)

    expect(pick(rowA)).toEqual(pick(rowB))
    expect(rowA.buyer_fee_method).toBe(method)
    // the legacy args (12.5% / $9.99 / $99.99) never reached the row
    expect(Number(rowA.payment_processing_fee_rate)).not.toBe(12.5)
    expect(Number(rowA.payment_processing_fee)).not.toBe(9.99)
    expect(Number(rowA.total_amount)).not.toBe(99.99)
    expect(Number(rowA.total_amount)).toBe(Number(rowB.total_amount))
    expect(a.charge_minor).toBe(b.charge_minor)
    expect(a.buyer_fee_minor).toBe(b.buyer_fee_minor)
    expect(attA.provider).toBe(attB.provider)
    expect(attA.pm_id).toBe(attB.pm_id)
    expect(Number(attA.amount_minor)).toBe(Number(attB.amount_minor))
  }, 60_000)

  it('OLD code completes a checkout end to end: 21-arg create → activate → confirm lands a paid order carrying the quoted fee', async () => {
    const r = await create(legacyArgs('fake', null))
    expect(r.attempt_id).toBeTruthy()
    const chargeId = `fake_${r.order_id}`
    const act = await fx!.svc.rpc('payment_attempt_activate', {
      p_attempt_id: r.attempt_id, p_provider_charge_id: chargeId, p_checkout_url: `/checkout/pay/${r.order_id}`,
      p_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    } as any)
    expect(act.error, act.error?.message).toBeNull()
    const { confirmOrderPayment } = await import('@/lib/wallet/order-money')
    const confirmed = await confirmOrderPayment(r.order_id, `${chargeId}:paid`, { provider: 'fake', providerChargeId: chargeId }, { amountMinor: BigInt(r.charge_minor), currency: CUR, paidMinor: BigInt(r.charge_minor) })
    expect(confirmed.outcome).toBe('paid')
    const row = await orderRow(r.order_id)
    expect(row.status).toBe('paid')
    expect(row.buyer_fee_method).toBe('fake')
    const { data: q } = await fx!.svc.rpc('buyer_fee_quote', { p_method: 'fake', p_subtotal_minor: 1999, p_currency: CUR } as any)
    expect(Math.round(Number(row.buyer_fee_amount) * 100)).toBe((q as any).fee_minor)
    expect(Math.round(Number(row.total_amount) * 100)).toBe(1999 + 40 + (q as any).fee_minor)
  }, 60_000)

  it('the shim is service-role only (42501 for anon and a signed-in buyer)', async () => {
    for (const client of [createClient(URL!, ANON!), fx!.buyer.client]) {
      const res = await client.rpc('order_create_pending', legacyArgs('fake', null) as any)
      expect(res.error?.code).toBe('42501')
    }
  })
})
