/**
 * Checkout fix round A — audit pass 6 (docs/audit/pass-6-checkout.md),
 * branch fix/checkout-p0. One describe per finding; each was RED before its
 * commit and drives the REAL RPCs / app functions against the local stack.
 *
 *   PAY-002  order_cancel_return_wallet cancels from `pending` only; paid /
 *            terminal → no-op + ONE deduped admin alert; buyer's explicit
 *            cancel (p_allow_paid) still cancels a paid order + credits wallet.
 *   PAY-003  order_confirm_payment claims the listing stock inside the
 *            confirm transaction; sold out → refunded to the wallet in the
 *            same transaction; an undelivered cancel returns the stock.
 *   PAY-015  inventory_claim_for_order refuses a new claim on an unpaid order.
 *   PAY-005  an in-flight racing order (no checkout_url yet) is never
 *            superseded or re-charged: "payment is being prepared".
 *
 * Every row this file causes is removed in afterAll — orders, ledger
 * journals, and the admin notifications the RPC inserts (for EVERY active
 * admin on the stack, not just the fixture's).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

let fx: Fixture | null = null
const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itFault = it.skipIf(!TARGET_IS_LOCAL)

/** Run `sql` in one psql transaction with app.money_fault = point (local stack only). */
function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}
async function listingRow() {
  const { data } = await fx!.svc.from('listings').select('quantity, status, is_unlimited').eq('id', fx!.listingId).single()
  return data as any
}
async function setStock(quantity: number, is_unlimited = false) {
  const { error } = await fx!.svc.from('listings').update({ quantity, is_unlimited, status: 'active' }).eq('id', fx!.listingId)
  if (error) throw new Error(`listing stock: ${error.message}`)
}
async function txnByKey(key: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()
  return data as { id: string } | null
}
const tag = () => Math.random().toString(36).slice(2, 8)
const createdOrderIds: string[] = []

async function walletMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', { p_user_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function orderRow(orderId: string) {
  const { data } = await fx!.svc.from('orders').select('*').eq('id', orderId).single()
  return data as any
}
async function insertOrder(over: Record<string, unknown>) {
  const { data, error } = await fx!.svc.from('orders').insert({
    buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
    unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
    platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
    ...over,
  }).select('id').single()
  if (error) throw new Error(`order insert: ${error.message}`)
  createdOrderIds.push((data as any).id)
  return (data as any).id as string
}
/** one_pending_order_per_buyer_listing: park whatever pending order an earlier test left. */
async function parkPendingOrders(buyerId = fx!.buyer.id) {
  await fx!.svc.from('orders').update({ status: 'cancelled' })
    .eq('buyer_id', buyerId).eq('listing_id', fx!.listingId).eq('status', 'pending')
}
async function adminAlerts(orderId: string) {
  const { data } = await fx!.svc.from('notifications').select('user_id')
    .eq('type', 'payment_review').eq('link', `/account/orders/${orderId}`)
  return (data ?? []) as { user_id: string }[]
}
async function activeAdminCount() {
  const { count } = await fx!.svc.from('admin_roles').select('user_id', { count: 'exact', head: true }).eq('is_active', true)
  return count ?? 0
}

describe.skipIf(!hasEnv)('checkout fix round A (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('listings').update({ status: 'active' }).eq('id', fx.listingId)
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
    const { data: allOrders } = await svc.from('orders').select('id').or(`buyer_id.in.(${users.join(',')}),seller_id.in.(${users.join(',')})`)
    const orderIds = Array.from(new Set([...(allOrders ?? []).map((o: any) => o.id), ...createdOrderIds]))
    for (const id of orderIds) {
      await del(`ledger_test_cleanup_by_order(${id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any))
      // Admin alerts go to EVERY active admin on the stack — remove by order link.
      await del('notifications(admin alerts)', svc.from('notifications').delete().like('link', `%${id}%`))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `fake_${id}:%`))
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`checkout-fix-a cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  // ── PAY-002 ────────────────────────────────────────────────────────────────
  describe('PAY-002 — automatic cancel is valid from pending only', () => {
    const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }

    it('CHARGE_FAILED on a PAID order: refused, nothing moves, one deduped alert per admin', async () => {
      await parkPendingOrders()
      const orderId = await insertOrder({ status: 'paid', escrow_status: 'held', order_number: `GT-P2-${tag()}` })
      const walletBefore = await walletMinor(fx!.buyer.id)
      const { handleWebhook } = await import('@/lib/payments/webhook-router')

      const body = (status: string) => JSON.stringify({ chargeId: `fake_${orderId}`, orderId, status, amountMinor: '100', currency: CUR })
      const first = await handleWebhook('fake', sig, body('failed'))
      expect(first.status, first.error).toBe(200) // processed, not a provider retry
      const row = await orderRow(orderId)
      expect(row.status).toBe('paid')
      expect(row.escrow_status).toBe('held')
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)

      // One alert per active admin; pinned on OUR fixture admin (other test
      // runs on the shared stack may add/remove their own admins mid-test).
      expect(await activeAdminCount()).toBeGreaterThan(0)
      const mine = (alerts: { user_id: string }[]) => alerts.filter((a) => a.user_id === fx!.admin.id).length
      expect(mine(await adminAlerts(orderId))).toBe(1)

      // A second stale failure (sweep, provider retry with a new event id) adds nothing.
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      const again = await cancelOrderReturnWallet(orderId, `${orderId}:expired-sweep`)
      expect(again.refused).toBe(true)
      expect(again.changed).toBe(false)
      expect((await orderRow(orderId)).status).toBe('paid')
      expect(mine(await adminAlerts(orderId))).toBe(1)
    }, 60_000)

    it('every non-pending status is refused for the automatic caller', async () => {
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      for (const status of ['delivering', 'delivered', 'disputed', 'completed', 'refunded']) {
        const orderId = await insertOrder({ status, escrow_status: 'held', order_number: `GT-P2-${status}-${tag()}` })
        const r = await cancelOrderReturnWallet(orderId, 'stale')
        expect(r.refused, status).toBe(true)
        expect((await orderRow(orderId)).status).toBe(status)
      }
    }, 60_000)

    it('pending stays cancellable and returns the wallet hold (unchanged behaviour)', async () => {
      await parkPendingOrders()
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P2-pend-${tag()}` })
      const { error: fund } = await fx!.svc.rpc('wallet_credit', {
        p_user_id: fx!.buyer.id, p_amount_minor: '100', p_currency: CUR, p_counterparty: 'refunds',
        p_idempotency_key: `test:ledger:fix-a:fund:${orderId}`, p_event_ref: 'TEST_FUND', p_order_id: null,
      } as any)
      if (fund) throw new Error(fund.message)
      const { error: spend } = await fx!.svc.rpc('wallet_spend', {
        p_user_id: fx!.buyer.id, p_amount_minor: '100', p_currency: CUR, p_target: 'escrow_held',
        p_idempotency_key: `checkout_wallet:${orderId}`, p_event_ref: 'CHECKOUT_WALLET_CREDIT', p_order_id: orderId,
      } as any)
      if (spend) throw new Error(spend.message)
      const before = await walletMinor(fx!.buyer.id)
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      const r = await cancelOrderReturnWallet(orderId, 'expired')
      expect(r.refused).toBe(false)
      expect(r.changed).toBe(true)
      expect(r.walletTxnId).not.toBeNull()
      expect((await orderRow(orderId)).status).toBe('cancelled')
      expect(await walletMinor(fx!.buyer.id)).toBe(before + 100n)
      expect((await adminAlerts(orderId)).length).toBe(0)
      await fx!.svc.rpc('ledger_test_cleanup', { p_prefix: `test:ledger:fix-a:fund:${orderId}` } as any)
    }, 60_000)

    it('buyer explicit cancel (allowPaid) cancels a paid order and credits the full total to the wallet', async () => {
      const orderId = await insertOrder({ status: 'paid', escrow_status: 'held', total_amount: 2.5, seller_payout: 2, order_number: `GT-P2-buyer-${tag()}` })
      const before = await walletMinor(fx!.buyer.id)
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      const r = await cancelOrderReturnWallet(orderId, undefined, { allowPaid: true })
      expect(r.refused).toBe(false)
      expect(r.changed).toBe(true)
      expect(r.walletTxnId).not.toBeNull()
      const row = await orderRow(orderId)
      expect(row.status).toBe('cancelled')
      expect(row.escrow_status).toBe('refunded')
      expect(await walletMinor(fx!.buyer.id)).toBe(before + 250n)
      // Replay: idempotent, no double credit.
      const again = await cancelOrderReturnWallet(orderId, undefined, { allowPaid: true })
      expect(again.changed).toBe(false)
      expect(await walletMinor(fx!.buyer.id)).toBe(before + 250n)
      // allowPaid never reaches past 'paid'.
      const delivering = await insertOrder({ status: 'delivering', escrow_status: 'held', order_number: `GT-P2-deliv-${tag()}` })
      const refused = await cancelOrderReturnWallet(delivering, undefined, { allowPaid: true })
      expect(refused.refused).toBe(true)
      expect((await orderRow(delivering)).status).toBe('delivering')
    }, 60_000)
  })

  // ── PAY-003 / PAY-015 ──────────────────────────────────────────────────────
  describe('PAY-003 — stock is claimed at payment confirmation, inside the confirm transaction', () => {
    const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }

    it('two paid orders for the last unit: the first claims it, the second is refunded to the wallet in the same transaction', async () => {
      await parkPendingOrders(fx!.buyer.id)
      await parkPendingOrders(fx!.admin.id)
      await setStock(1)
      const a = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P3-a-${tag()}` })
      const b = await insertOrder({ buyer_id: fx!.admin.id, status: 'pending', escrow_status: 'pending', order_number: `GT-P3-b-${tag()}` })
      const bWalletBefore = await walletMinor(fx!.admin.id)
      const { confirmOrderPayment } = await import('@/lib/wallet/order-money')

      const ra = await confirmOrderPayment(a, 'evt-a')
      expect(ra.outcome).toBe('paid')
      expect(ra.changed).toBe(true)
      const rowA = await orderRow(a)
      expect(rowA.status).toBe('paid')
      expect(rowA.paid_at).not.toBeNull()
      expect(rowA.stock_claimed_at).not.toBeNull()
      expect(await listingRow()).toMatchObject({ quantity: 0, status: 'sold' })

      // Replay of the same confirmation: no-op, stock untouched.
      const again = await confirmOrderPayment(a, 'evt-a')
      expect(again.outcome).toBe('noop')
      expect((await listingRow()).quantity).toBe(0)

      const rb = await confirmOrderPayment(b, 'evt-b')
      expect(rb.outcome).toBe('oversold_refunded')
      expect(rb.reason).toBe('insufficient_stock')
      const rowB = await orderRow(b)
      expect(rowB.status).toBe('refunded')
      expect(rowB.escrow_status).toBe('refunded')
      expect(rowB.stock_claimed_at).toBeNull()
      expect(await walletMinor(fx!.admin.id)).toBe(bWalletBefore + 100n)
      expect(await txnByKey(`order:${b}:CHARGE_CONFIRMED:evt-b`)).not.toBeNull()
      expect(await txnByKey(`order:${b}:REFUNDED:oversold`)).not.toBeNull()
      expect(await txnByKey(`wallet_refund:${b}`)).not.toBeNull()
      expect((await listingRow()).quantity).toBe(0)

      // Buyer cancels the paid, undelivered order → the unit is back on sale.
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      const cancelled = await cancelOrderReturnWallet(a, undefined, { allowPaid: true })
      expect(cancelled.changed).toBe(true)
      expect((await orderRow(a)).stock_returned_at).not.toBeNull()
      expect(await listingRow()).toMatchObject({ quantity: 1, status: 'active' })
      await setStock(5)
    }, 90_000)

    it('a refund AFTER delivery keeps the stock out; completion of a claimed order does not decrement twice', async () => {
      await parkPendingOrders(fx!.buyer.id)
      await setStock(3)
      const { confirmOrderPayment } = await import('@/lib/wallet/order-money')
      const delivered = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P3-d-${tag()}` })
      expect((await confirmOrderPayment(delivered, 'evt-d')).outcome).toBe('paid')
      expect((await listingRow()).quantity).toBe(2)
      await fx!.svc.from('orders').update({ status: 'delivering' }).eq('id', delivered)
      await fx!.svc.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', delivered)
      const { refundOrderToWallet } = await import('@/lib/wallet/order-money')
      await refundOrderToWallet(delivered, 'after-delivery')
      expect((await orderRow(delivered)).stock_returned_at).toBeNull()
      expect((await listingRow()).quantity).toBe(2)

      await parkPendingOrders(fx!.buyer.id)
      const done = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P3-c-${tag()}` })
      expect((await confirmOrderPayment(done, 'evt-c')).outcome).toBe('paid')
      expect((await listingRow()).quantity).toBe(1)
      await fx!.svc.from('orders').update({ status: 'delivering' }).eq('id', done)
      await fx!.svc.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', done)
      const { transition } = await import('@/lib/escrow/transition')
      await transition(done, 'BUYER_CONFIRMED', undefined, 'buyer_confirmed')
      expect((await orderRow(done)).status).toBe('completed')
      expect((await listingRow()).quantity).toBe(1) // claimed at payment — not decremented again
      await setStock(5)
    }, 90_000)

    it('the webhook path confirms through the claim', async () => {
      await parkPendingOrders(fx!.buyer.id)
      await setStock(2)
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P3-w-${tag()}` })
      const { handleWebhook } = await import('@/lib/payments/webhook-router')
      const res = await handleWebhook('fake', sig, JSON.stringify({ chargeId: `fake_${orderId}`, orderId, status: 'paid', amountMinor: '100', currency: CUR }))
      expect(res.status, res.error).toBe(200)
      const row = await orderRow(orderId)
      expect(row.status).toBe('paid')
      expect(row.stock_claimed_at).not.toBeNull()
      expect(row.paid_at).not.toBeNull()
      expect((await listingRow()).quantity).toBe(1)
      await setStock(5)
    }, 60_000)

    itFault('in-RPC fault after the stock claim rolls back the payment, the stamp and the stock', async () => {
      await parkPendingOrders(fx!.buyer.id)
      await setStock(2)
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P3-f-${tag()}` })
      const err = withFault('order_confirm_payment:after_stock', `SELECT public.order_confirm_payment('${orderId}'::uuid, 'fault')`)
      expect(err).toMatch(/injected fault at order_confirm_payment:after_stock/)
      const row = await orderRow(orderId)
      expect(row.status).toBe('pending')
      expect(row.paid_at).toBeNull()
      expect(row.stock_claimed_at).toBeNull()
      expect((await listingRow()).quantity).toBe(2)
      expect(await txnByKey(`order:${orderId}:CHARGE_CONFIRMED:fault`)).toBeNull()
      await setStock(5)
    }, 60_000)
  })

  describe('PAY-015 — inventory_claim_for_order releases codes to paid orders only', () => {
    it('refuses a new claim on a pending order; a paid order claims', async () => {
      const { encryptDeliveryData } = await import('@/lib/crypto/delivery-encryption')
      const { error: ie } = await fx!.svc.from('instant_delivery_inventory').insert([{
        listing_id: fx!.listingId, delivery_type: 'code', status: 'available',
        delivery_data: encryptDeliveryData('p15-code'), created_by: fx!.seller.id,
      }])
      if (ie) throw new Error(`inventory insert: ${ie.message}`)
      try {
        await parkPendingOrders(fx!.buyer.id)
        const pending = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P15-p-${tag()}` })
        const refused = await (fx!.svc.rpc as any)('inventory_claim_for_order', { p_order_id: pending })
        expect(refused.error, 'pending order must not receive a code').not.toBeNull()
        expect(refused.error.code).toBe('23514')
        const { count } = await fx!.svc.from('instant_delivery_inventory').select('id', { count: 'exact', head: true }).eq('listing_id', fx!.listingId).eq('status', 'sold')
        expect(count ?? 0).toBe(0)

        const paid = await insertOrder({ status: 'paid', escrow_status: 'held', order_number: `GT-P15-ok-${tag()}` })
        const ok = await (fx!.svc.rpc as any)('inventory_claim_for_order', { p_order_id: paid })
        expect(ok.error).toBeNull()
        expect(ok.data.inventory_id).not.toBeNull()
      } finally {
        await fx!.svc.from('orders').update({ instant_delivery_inventory_id: null }).eq('listing_id', fx!.listingId).not('instant_delivery_inventory_id', 'is', null)
        await fx!.svc.from('instant_delivery_inventory').delete().eq('listing_id', fx!.listingId)
      }
    }, 60_000)
  })

  // ── PAY-005 / PAY-006 / PAY-007 / PAY-014 (createCheckout) ────────────────
  describe('createCheckout — PAY-005/006/007/014', () => {
    const rlKey = () => `checkout:user:${fx!.buyer.id}`
    async function clearRateLimit() {
      await fx!.svc.from('rate_limits').delete().eq('key', rlKey())
    }
    async function cancelAllPendingFor(buyerId: string) {
      const { data } = await fx!.svc.from('orders').select('id').eq('buyer_id', buyerId).eq('status', 'pending')
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      for (const o of (data ?? []) as any[]) await cancelOrderReturnWallet(o.id, 'test-reset')
    }

    it('PAY-005: a racing pending order still creating its charge is neither superseded nor re-charged', async () => {
      await clearRateLimit()
      await cancelAllPendingFor(fx!.buyer.id)
      // The "winner": inserted seconds ago, no checkout_url yet (createCharge in flight).
      const inFlight = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-P5-${tag()}` })
      sessionClient = fx!.buyer.client
      const { createCheckout } = await import('@/lib/actions/checkout')
      const r = await createCheckout({ listingId: fx!.listingId, quantity: 1 })
      expect(r.success).toBe(false)
      expect(r.error).toMatch(/being prepared/)
      const row = await orderRow(inFlight)
      expect(row.status).toBe('pending')
      expect(row.provider_charge_id).toBeNull() // never charged by the loser
      expect(row.checkout_url).toBeNull()

      // A STALE url-less pending order (older than the in-flight window) is
      // superseded as before.
      await fx!.svc.from('orders').update({ created_at: new Date(Date.now() - 10 * 60_000).toISOString() }).eq('id', inFlight)
      const r2 = await createCheckout({ listingId: fx!.listingId, quantity: 1 })
      expect(r2.success, r2.error).toBe(true)
      expect(r2.orderId).not.toBe(inFlight)
      createdOrderIds.push(r2.orderId!)
      expect((await orderRow(inFlight)).status).toBe('cancelled')
      expect((await orderRow(r2.orderId!)).payment_expires_at).not.toBeNull()
    }, 90_000)
  })
})
