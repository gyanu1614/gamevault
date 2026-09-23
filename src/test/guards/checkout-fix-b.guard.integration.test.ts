/**
 * Checkout fix round B — audit pass 6 (docs/audit/pass-6-checkout.md),
 * branch fix/checkout-round-b. One describe per part; each block was RED
 * before its commit and drives the REAL RPCs / app functions against the
 * local stack.
 *
 *   Part 1  payment_attempts (PAY-004/013/018): one OPEN attempt per order
 *           and one charge id per provider, enforced by the DB; checkout
 *           inserts the order, the wallet hold and the attempt in ONE RPC
 *           (order_create_pending) with the amounts + pm_id snapshotted;
 *           the backfill is idempotent; retry supersedes the old attempt
 *           and keeps the history; a webhook charge id is bound to its
 *           order; a failure on a superseded attempt never cancels the
 *           order; the sweep, the pay page and the return path read the
 *           OPEN attempt, not the order's mirror columns.
 *
 * Every row this file causes is removed in afterAll — orders, attempts,
 * ledger journals, webhook_events and the notifications the RPCs insert
 * (for EVERY active admin on the stack, not just the fixture's).
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
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
/** Route every provider name to the fake adapter (createCharge/getCharge/void
 *  need no network) while keeping the NAME the checkout picked, so the attempt
 *  row records the real routing decision (payssion for a pm_id). */
vi.mock('@/lib/payments/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/payments/registry')>()
  const { fakeProvider } = await import('@/lib/payments/providers/fake')
  return {
    ...real,
    getProvider: (name: string) => ({ ...fakeProvider, name }),
  }
})
const btcpayCalls: string[] = []
vi.mock('@/lib/payments/providers/btcpay', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/payments/providers/btcpay')>()
  return {
    ...real,
    btcpayFetchInvoice: async (id: string) => {
      btcpayCalls.push(id)
      return { id, status: 'New', amount: '1.07', currency: 'USD', createdTime: Math.floor(Date.now() / 1000) }
    },
    btcpayFetchPaymentMethods: async () => [],
  }
})

let fx: Fixture | null = null
const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itFault = it.skipIf(!TARGET_IS_LOCAL)
const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }
const tag = () => Math.random().toString(36).slice(2, 8)
const createdOrderIds: string[] = []

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
async function walletMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', { p_user_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function fundWallet(userId: string, minor: bigint) {
  const { error } = await fx!.svc.rpc('wallet_credit', {
    p_user_id: userId, p_amount_minor: minor.toString(), p_currency: CUR, p_counterparty: 'refunds',
    p_idempotency_key: `test:ledger:fix-b:fund:${tag()}`, p_event_ref: 'TEST_FUND', p_order_id: null,
  } as any)
  if (error) throw new Error(`wallet_credit: ${error.message}`)
}
async function orderRow(orderId: string) {
  const { data } = await fx!.svc.from('orders').select('*').eq('id', orderId).single()
  return data as any
}
async function attempts(orderId: string) {
  const { data, error } = await fx!.svc.from('payment_attempts').select('*').eq('order_id', orderId).order('created_at', { ascending: true })
  if (error) throw new Error(`payment_attempts: ${error.message}`)
  return (data ?? []) as any[]
}
async function txnByKey(key: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()
  return data as { id: string } | null
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
async function insertAttempt(over: Record<string, unknown>) {
  const { data, error } = await fx!.svc.from('payment_attempts').insert({
    provider: 'fake', status: 'active', amount_minor: 100, currency: CUR, order_total_minor: 100, wallet_minor: 0,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), checkout_url: 'https://fake.test/x',
    ...over,
  }).select('id').single()
  if (error) throw error
  return (data as any).id as string
}
async function parkPendingOrders(buyerId = fx!.buyer.id) {
  const { data } = await fx!.svc.from('orders').select('id').eq('buyer_id', buyerId).eq('status', 'pending')
  const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
  for (const o of (data ?? []) as any[]) await cancelOrderReturnWallet(o.id, 'test-reset')
}
async function clearRateLimit() {
  await fx!.svc.from('rate_limits').delete().eq('key', `checkout:user:${fx!.buyer.id}`)
}
function cronRequest(path: string) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
}

describe.skipIf(!hasEnv)('checkout fix round B (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('listings').update({ status: 'active', quantity: 50 }).eq('id', fx.listingId)
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
      await del('notifications(by link)', svc.from('notifications').delete().like('link', `%${id}%`))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `%${id}%`))
      await del('payment_attempts', svc.from('payment_attempts').delete().eq('order_id', id))
    }
    await del('ledger_test_cleanup(fund)', svc.rpc('ledger_test_cleanup', { p_prefix: 'test:ledger:fix-b:%' } as any))
    if (TARGET_IS_LOCAL) {
      try {
        execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c',
          `BEGIN; ALTER TABLE public.audit_logs DISABLE TRIGGER trg_prevent_audit_log_delete; ` +
          `DELETE FROM public.audit_logs WHERE user_id IN ('${users.join("','")}'); ` +
          `ALTER TABLE public.audit_logs ENABLE TRIGGER trg_prevent_audit_log_delete; COMMIT;`], { stdio: 'pipe' })
      } catch (e: any) { failures.push(`audit_logs purge: ${e?.stderr?.toString() ?? e}`) }
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`checkout-fix-b cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  // ── Part 1 ─────────────────────────────────────────────────────────────────
  describe('Part 1 — payment_attempts model (PAY-004/013/018)', () => {
    it('the DB allows one OPEN attempt per order and one charge id per provider', async () => {
      await parkPendingOrders()
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-B1-${tag()}` })
      await insertAttempt({ order_id: orderId, provider_charge_id: `ch-${orderId}-1` })
      // second open attempt (created OR active) → 23505 on the partial unique index
      for (const status of ['created', 'active']) {
        const err = await insertAttempt({ order_id: orderId, status, provider_charge_id: `ch-${orderId}-${status}` }).then(() => null, (e) => e)
        expect(err?.code, `second ${status} attempt must be refused`).toBe('23505')
        expect(String(err?.message)).toMatch(/payment_attempts_one_open_per_order/)
      }
      // a closed attempt beside the open one is fine (history)
      await insertAttempt({ order_id: orderId, status: 'superseded', provider_charge_id: `ch-${orderId}-old` })
      // same (provider, charge id) on ANOTHER order → 23505
      const other = await insertOrder({ buyer_id: fx!.admin.id, status: 'pending', escrow_status: 'pending', order_number: `GT-B1o-${tag()}` })
      const dup = await insertAttempt({ order_id: other, provider_charge_id: `ch-${orderId}-1` }).then(() => null, (e) => e)
      expect(dup?.code).toBe('23505')
      expect(String(dup?.message)).toMatch(/payment_attempts_provider_charge_key/)
      // a different provider may reuse the string
      await insertAttempt({ order_id: other, provider: 'other', provider_charge_id: `ch-${orderId}-1` })
      expect((await attempts(orderId)).length).toBe(2)
    }, 60_000)

    it('createCheckout inserts the order, the wallet hold and the attempt in ONE RPC; activation stores the charge; pm_id is persisted', async () => {
      await clearRateLimit()
      await parkPendingOrders()
      await fundWallet(fx!.buyer.id, 50n)
      const walletBefore = await walletMinor(fx!.buyer.id)
      sessionClient = fx!.buyer.client
      const { createCheckout } = await import('@/lib/actions/checkout')
      // price 1 → buyer fee 7% → total 1.07; wallet 0.50 → charge 0.57
      const r = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 0.5, paymentMethodId: 'gcash_ph' })
      expect(r.success, r.error).toBe(true)
      createdOrderIds.push(r.orderId!)
      const row = await orderRow(r.orderId!)
      expect(row.status).toBe('pending')
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore - 50n)
      expect(await txnByKey(`checkout_wallet:${r.orderId}`)).not.toBeNull()
      const [a] = await attempts(r.orderId!)
      expect(a).toBeTruthy()
      expect(a.status).toBe('active')
      expect(a.provider).toBe('payssion') // the routing decision, from the pm_id
      expect(a.pm_id).toBe('gcash_ph')
      expect(Number(a.order_total_minor)).toBe(107)
      expect(Number(a.wallet_minor)).toBe(50)
      expect(Number(a.amount_minor)).toBe(57)
      expect(a.currency).toBe(CUR)
      expect(a.provider_charge_id).toBe(`fake_${r.orderId}`)
      expect(a.checkout_url).toBe(r.checkoutUrl)
      expect(a.expires_at).not.toBeNull()
      expect(a.activated_at).not.toBeNull()
      // the order's mirror columns agree with the open attempt
      expect(row.payment_provider).toBe('payssion')
      expect(row.provider_charge_id).toBe(a.provider_charge_id)
      expect(row.checkout_url).toBe(a.checkout_url)
      expect(row.payment_expires_at).toBe(a.expires_at)
      // re-entering checkout reuses the same order + attempt (no second row)
      const again = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 0.5, paymentMethodId: 'gcash_ph' })
      expect(again.orderId).toBe(r.orderId)
      expect((await attempts(r.orderId!)).length).toBe(1)
    }, 90_000)

    it('a fully wallet-paid checkout opens no provider attempt and is confirmed inside the same flow', async () => {
      await clearRateLimit()
      await parkPendingOrders()
      await fundWallet(fx!.buyer.id, 200n)
      sessionClient = fx!.buyer.client
      const { createCheckout } = await import('@/lib/actions/checkout')
      const r = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 5 })
      expect(r.success, r.error).toBe(true)
      expect(r.fullyPaidByWallet).toBe(true)
      createdOrderIds.push(r.orderId!)
      expect((await orderRow(r.orderId!)).status).toBe('paid')
      expect((await attempts(r.orderId!)).length).toBe(0)
    }, 60_000)

    itFault('an in-RPC fault after the wallet spend rolls back the order, the hold and the attempt', async () => {
      await parkPendingOrders()
      await fundWallet(fx!.buyer.id, 100n)
      const before = await walletMinor(fx!.buyer.id)
      const { data: listing } = await fx!.svc.from('listings').select('id').eq('id', fx!.listingId).single()
      const err = withFault('order_create_pending:after_wallet', `SELECT public.order_create_pending(
        '${fx!.buyer.id}'::uuid, '${fx!.seller.id}'::uuid, '${(listing as any).id}'::uuid, 1,
        1, 1, 0, 0, 0, 0, 1.00, 1.00, 0, '{}'::jsonb, 'USD', NULL, 0, 40, 'fake', NULL, now() + interval '30 minutes')`)
      expect(err).toMatch(/injected fault at order_create_pending:after_wallet/)
      const { data: rows } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id).eq('listing_id', fx!.listingId).eq('status', 'pending')
      expect(rows ?? []).toEqual([])
      expect(await walletMinor(fx!.buyer.id)).toBe(before)
      const { data: la } = await fx!.svc.from('ledger_transactions').select('id').like('idempotency_key', 'checkout_wallet:%').gt('created_at', new Date(Date.now() - 10_000).toISOString())
      // nothing posted in the last seconds under our key prefix for a rolled-back order
      for (const t of (la ?? []) as any[]) {
        const { data: o } = await fx!.svc.from('ledger_transactions').select('order_id').eq('id', t.id).single()
        if ((o as any)?.order_id) expect((await orderRow((o as any).order_id))?.status).not.toBeUndefined()
      }
    }, 60_000)

    it('the backfill turns legacy charge columns into one attempt per order and is idempotent', async () => {
      await parkPendingOrders()
      const t = tag()
      const pending = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-BF-p-${t}`,
        payment_provider: 'btcpay', provider_charge_id: `legacy-p-${t}`, checkout_url: `/checkout/pay/x`, payment_expires_at: new Date(Date.now() + 600_000).toISOString() })
      const paid = await insertOrder({ status: 'paid', escrow_status: 'held', order_number: `GT-BF-paid-${t}`, paid_at: new Date().toISOString(),
        payment_provider: 'payssion', provider_charge_id: `legacy-paid-${t}`, checkout_url: `https://pay.test/${t}` })
      const cancelled = await insertOrder({ status: 'cancelled', escrow_status: 'pending', order_number: `GT-BF-c-${t}`,
        payment_provider: 'coingate', provider_charge_id: `legacy-c-${t}` })
      const none = await insertOrder({ status: 'cancelled', escrow_status: 'pending', order_number: `GT-BF-n-${t}` })
      // the raw inserts above bypass the RPC, so no attempt exists yet
      for (const id of [pending, paid, cancelled, none]) expect((await attempts(id)).length).toBe(0)
      const first = await (fx!.svc.rpc as any)('payment_attempts_backfill')
      expect(first.error).toBeNull()
      expect(Number(first.data)).toBeGreaterThanOrEqual(3)
      expect((await attempts(pending))[0]).toMatchObject({ provider: 'btcpay', provider_charge_id: `legacy-p-${t}`, status: 'active', checkout_url: '/checkout/pay/x' })
      expect((await attempts(paid))[0]).toMatchObject({ provider: 'payssion', provider_charge_id: `legacy-paid-${t}`, status: 'paid' })
      expect((await attempts(cancelled))[0]).toMatchObject({ provider: 'coingate', status: 'void' })
      expect(Number((await attempts(paid))[0].order_total_minor)).toBe(100)
      expect((await attempts(none)).length).toBe(0)
      const second = await (fx!.svc.rpc as any)('payment_attempts_backfill')
      expect(second.error).toBeNull()
      for (const id of [pending, paid, cancelled]) expect((await attempts(id)).length).toBe(1)
    }, 60_000)

    it('retry past expiry supersedes the old attempt and activates a new one; the history is kept', async () => {
      await parkPendingOrders()
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', total_amount: 1, order_number: `GT-RT-${tag()}`,
        payment_provider: 'fake', provider_charge_id: `old-${tag()}`, checkout_url: 'https://fake.test/old', payment_expires_at: new Date(Date.now() - 60_000).toISOString() })
      const oldAttempt = await insertAttempt({ order_id: orderId, provider_charge_id: (await orderRow(orderId)).provider_charge_id, checkout_url: 'https://fake.test/old', expires_at: new Date(Date.now() - 60_000).toISOString() })
      sessionClient = fx!.buyer.client
      const { retryOrderPayment } = await import('@/lib/actions/checkout')
      const r = await retryOrderPayment(orderId)
      expect(r.success, r.error).toBe(true)
      const rows = await attempts(orderId)
      expect(rows.length).toBe(2)
      const old = rows.find((a) => a.id === oldAttempt)!
      const fresh = rows.find((a) => a.id !== oldAttempt)!
      expect(old.status).toBe('superseded')
      expect(old.closed_at).not.toBeNull()
      expect(fresh.status).toBe('active')
      expect(fresh.provider_charge_id).toBe(`fake_${orderId}`)
      expect(fresh.provider_charge_id).not.toBe(old.provider_charge_id)
      expect((await orderRow(orderId)).provider_charge_id).toBe(fresh.provider_charge_id)
      // a second retry while the fresh attempt is valid reuses it
      const r2 = await retryOrderPayment(orderId)
      expect(r2.success).toBe(true)
      expect((await attempts(orderId)).length).toBe(2)
    }, 60_000)

    it('a CHARGE_CONFIRMED whose charge id is bound to ANOTHER order is refused and moves nothing', async () => {
      await parkPendingOrders(fx!.buyer.id)
      await parkPendingOrders(fx!.admin.id)
      const a = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-BIND-a-${tag()}` })
      const b = await insertOrder({ buyer_id: fx!.admin.id, status: 'pending', escrow_status: 'pending', order_number: `GT-BIND-b-${tag()}` })
      await insertAttempt({ order_id: a, provider_charge_id: `fake_${a}` })
      await insertAttempt({ order_id: b, provider_charge_id: `fake_${b}` })
      const { handleWebhook } = await import('@/lib/payments/webhook-router')
      // charge of A, claiming order B
      const res = await handleWebhook('fake', sig, JSON.stringify({ chargeId: `fake_${a}`, orderId: b, status: 'paid', amountMinor: '100', currency: CUR }))
      expect(res.ok).toBe(false)
      expect(res.status).toBe(500)
      expect((await orderRow(a)).status).toBe('pending')
      expect((await orderRow(b)).status).toBe('pending')
      expect((await attempts(a))[0].status).toBe('active')
      // the honest event pays A and closes its attempt as paid
      const ok = await handleWebhook('fake', sig, JSON.stringify({ chargeId: `fake_${a}`, orderId: a, status: 'paid', amountMinor: '100', currency: CUR }))
      expect(ok.status, ok.error).toBe(200)
      expect((await orderRow(a)).status).toBe('paid')
      expect((await attempts(a))[0]).toMatchObject({ status: 'paid', paid_event_id: `fake_${a}:paid` })
    }, 60_000)

    it('a CHARGE_FAILED for a superseded attempt does not cancel the order that has a live attempt', async () => {
      await parkPendingOrders()
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-STALE-${tag()}` })
      await insertAttempt({ order_id: orderId, status: 'superseded', provider_charge_id: `stale_${orderId}`, closed_at: new Date().toISOString() })
      await insertAttempt({ order_id: orderId, provider_charge_id: `fake_${orderId}` })
      const { handleWebhook } = await import('@/lib/payments/webhook-router')
      const res = await handleWebhook('fake', sig, JSON.stringify({ chargeId: `stale_${orderId}`, orderId, status: 'failed', amountMinor: '100', currency: CUR }))
      expect(res.status, res.error).toBe(200) // processed, not a provider retry
      expect((await orderRow(orderId)).status).toBe('pending')
      const rows = await attempts(orderId)
      expect(rows.find((a) => a.provider_charge_id === `stale_${orderId}`)?.status).toBe('superseded')
      expect(rows.find((a) => a.provider_charge_id === `fake_${orderId}`)?.status).toBe('active')
      // the live attempt's failure DOES cancel, and closes the attempt as failed
      const live = await handleWebhook('fake', sig, JSON.stringify({ chargeId: `fake_${orderId}`, orderId, status: 'failed', amountMinor: '100', currency: CUR }))
      expect(live.status, live.error).toBe(200)
      expect((await orderRow(orderId)).status).toBe('cancelled')
      expect((await attempts(orderId)).find((a) => a.provider_charge_id === `fake_${orderId}`)?.status).toBe('failed')
    }, 60_000)

    it('the expiry sweep reads attempts: an expired open attempt and a provider-less order past its fallback are both cancelled', async () => {
      await parkPendingOrders(fx!.buyer.id)
      await parkPendingOrders(fx!.admin.id)
      const past = new Date(Date.now() - 10 * 60_000).toISOString()
      const withAttempt = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-SW-a-${tag()}`, payment_expires_at: new Date(Date.now() + 3_600_000).toISOString() })
      await insertAttempt({ order_id: withAttempt, provider_charge_id: `sweep_${withAttempt}`, expires_at: past })
      const bare = await insertOrder({ buyer_id: fx!.admin.id, status: 'pending', escrow_status: 'pending', order_number: `GT-SW-b-${tag()}`, payment_expires_at: past })
      const { GET } = await import('@/app/api/cron/expire-pending-payments/route')
      const res = await GET(cronRequest('/api/cron/expire-pending-payments'))
      expect(res.status).toBe(200)
      expect((await orderRow(withAttempt)).status).toBe('cancelled')
      expect((await attempts(withAttempt))[0].status).toBe('void')
      expect((await orderRow(bare)).status).toBe('cancelled')
    }, 60_000)

    it('the pay-page status poll reads the OPEN attempt, not the order mirror columns', async () => {
      await parkPendingOrders()
      const orderId = await insertOrder({ status: 'pending', escrow_status: 'pending', order_number: `GT-PP-${tag()}`,
        payment_provider: 'btcpay', provider_charge_id: 'stale-mirror', checkout_url: `/checkout/pay/x` })
      await insertAttempt({ order_id: orderId, provider: 'btcpay', provider_charge_id: `inv-${orderId}`, checkout_url: `/checkout/pay/${orderId}` })
      sessionClient = fx!.buyer.client
      btcpayCalls.length = 0
      const { getPaymentPageStatus } = await import('@/lib/actions/payment-page')
      const s = await getPaymentPageStatus(orderId)
      expect(s.success, s.error).toBe(true)
      expect(s.invoiceStatus).toBe('New')
      expect(btcpayCalls).toEqual([`inv-${orderId}`])
    }, 60_000)
  })
})
