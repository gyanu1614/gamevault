/**
 * Checkout fix round A — audit pass 6 (docs/audit/pass-6-checkout.md),
 * branch fix/checkout-p0. One describe per finding; each was RED before its
 * commit and drives the REAL RPCs / app functions against the local stack.
 *
 *   PAY-002  order_cancel_return_wallet cancels from `pending` only; paid /
 *            terminal → no-op + ONE deduped admin alert; buyer's explicit
 *            cancel (p_allow_paid) still cancels a paid order + credits wallet.
 *
 * Every row this file causes is removed in afterAll — orders, ledger
 * journals, and the admin notifications the RPC inserts (for EVERY active
 * admin on the stack, not just the fixture's).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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
    await del('audit_logs', svc.from('audit_logs').delete().in('user_id', users))
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

      const admins = await activeAdminCount()
      expect(admins).toBeGreaterThan(0) // the fixture admin at least
      expect((await adminAlerts(orderId)).length).toBe(admins)

      // A second stale failure (sweep, provider retry with a new event id) adds nothing.
      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      const again = await cancelOrderReturnWallet(orderId, `${orderId}:expired-sweep`)
      expect(again.refused).toBe(true)
      expect(again.changed).toBe(false)
      expect((await orderRow(orderId)).status).toBe('paid')
      expect((await adminAlerts(orderId)).length).toBe(admins)
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
})
