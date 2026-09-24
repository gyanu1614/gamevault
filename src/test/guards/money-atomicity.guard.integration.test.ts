/**
 * DB-015 / DB-016 / DB-017 — fix/money-atomicity (audit 2026-09-11).
 *
 * Every money path below used to compose 2+ atomic RPCs / statements in app
 * code with nothing in between that compensated or retried. The RED commit
 * ("DB-015/016/017 RED") drove the REAL app functions against the local
 * stack with one fault injected between the steps and asserted the bad end
 * state the audit describes. Since 20260914100000_money_atomicity.sql each
 * seam is ONE SQL function; this file keeps the same drivers and faults and
 * now asserts the balances stay consistent:
 *
 *   · app-level faults (a thrown seam module, a failing UPDATE, a hold that
 *     was already paid out, N concurrent callers);
 *   · in-RPC faults through money_fault_hook: a psql transaction sets the
 *     GUC app.money_fault to an interior point, calls the atomic function and
 *     proves nothing partial survives the rollback (PostgREST callers cannot
 *     set that GUC, so on prod the hook is inert).
 *
 * Money invariants asserted throughout (minor units, from the ledger):
 *   buyer wallet = user_wallet_balance(buyer)            (derived, never stored)
 *   seller avail = seller_available_balance(seller)
 *   hold(order)  = checkout_wallet_hold_minor(order)     (escrow_held credit at checkout)
 *
 * All rows are fixture-owned and removed in afterAll — including the rows the
 * driven code writes as side effects (notifications, loyalty_credits, ledger
 * journals, webhook_events, promo usages, inventory, withdrawals).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

// ── fault switches (set by each test, read by the mocks) ──────────────────
let sessionClient: SupabaseClient | null = null
/** Throw from the order↔wallet seam module once (simulates the RPC being unreachable). */
let failOrderMoneyOnce = false

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('server-only', () => ({}))
// Every test that touches email must mock the transport (CLAUDE.md). Stub
// every real export by name (a Proxy that answers `then` makes the module a
// thenable and hangs `await import()`).
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/wallet/order-money', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/wallet/order-money')>()
  const gate = () => {
    if (failOrderMoneyOnce) { failOrderMoneyOnce = false; throw new Error('injected: order-money RPC unreachable') }
  }
  return {
    ...real,
    cancelOrderReturnWallet: async (...a: Parameters<typeof real.cancelOrderReturnWallet>) => { gate(); return real.cancelOrderReturnWallet(...a) },
    refundOrderToWallet: async (...a: Parameters<typeof real.refundOrderToWallet>) => { gate(); return real.refundOrderToWallet(...a) },
  }
})

let fx: Fixture | null = null
let ready = false
const CUR = 'USD'
const tag = () => Math.random().toString(36).slice(2, 8)
const RUN = `test:ledger:money-atomicity:${tag()}`
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * The in-RPC fault tests need a direct psql session on the target database
 * (SET LOCAL app.money_fault), which only the local stack offers. Against a
 * remote target (ALLOW_REMOTE_GUARD_TESTS=1) they self-skip with this reason;
 * every app-level fault test still runs there.
 */
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const FAULT_SKIP_REASON = `in-RPC fault tests skipped: psql fault injection (app.money_fault) needs a direct DB session, only available on the local stack — target is ${targetHost || 'unset'}`
const itFault = it.skipIf(!TARGET_IS_LOCAL)
// eslint-disable-next-line no-console
if (hasEnv && !TARGET_IS_LOCAL) console.warn(`[money-atomicity] ${FAULT_SKIP_REASON}`)

/**
 * Run `sql` inside one psql transaction with app.money_fault = point. Returns
 * the error text psql printed (the transaction rolled back) or '' on commit.
 * Direct DB session on purpose: that is the only way to set the GUC.
 */
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
async function sellerAvailMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('seller_available_balance', { p_seller_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`seller_available_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function platformMinor(kind: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('ledger_balance', {
    p_owner_type: 'platform', p_owner_id: null, p_kind: kind, p_currency: CUR,
  } as any)
  if (error) throw new Error(`ledger_balance(${kind}): ${error.message}`)
  return BigInt(data ?? 0)
}
async function holdMinor(orderId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('checkout_wallet_hold_minor', { p_order_id: orderId } as any)
  if (error) throw new Error(`checkout_wallet_hold_minor: ${error.message}`)
  return BigInt(data ?? 0)
}
async function txnByKey(key: string) {
  const { data } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', key).maybeSingle()
  return data as { id: string } | null
}
/** owner.kind:direction:amount of every entry on a journal, sorted. */
async function entriesOf(txnId: string) {
  const { data } = await fx!.svc.from('ledger_entries')
    .select('direction, amount_minor, account:account_id ( kind, owner_type )').eq('transaction_id', txnId)
  return ((data ?? []) as any[])
    .map((e) => `${e.account.owner_type}.${e.account.kind}:${e.direction}:${e.amount_minor}`)
    .sort()
}
async function orderRow(orderId: string) {
  const { data } = await fx!.svc.from('orders').select('*').eq('id', orderId).single()
  return data as any
}
async function fundWallet(userId: string, minor: bigint, suffix: string) {
  const { error } = await fx!.svc.rpc('post_journal', {
    p_idempotency_key: `${RUN}:fund:${suffix}`,
    p_entries: [
      { owner_type: 'platform', owner_id: null, kind: 'refunds', direction: 'debit', amount_minor: Number(minor), currency: CUR },
      { owner_type: 'buyer', owner_id: userId, kind: 'user_wallet', direction: 'credit', amount_minor: Number(minor), currency: CUR },
    ],
    p_event_ref: 'TEST_FUND',
  } as any)
  if (error) throw new Error(`fundWallet: ${error.message}`)
}
async function fundSeller(userId: string, minor: bigint, suffix: string) {
  const { error } = await fx!.svc.rpc('post_journal', {
    p_idempotency_key: `${RUN}:fundseller:${suffix}`,
    p_entries: [
      { owner_type: 'platform', owner_id: null, kind: 'escrow_held', direction: 'debit', amount_minor: Number(minor), currency: CUR },
      { owner_type: 'seller', owner_id: userId, kind: 'seller_available', direction: 'credit', amount_minor: Number(minor), currency: CUR },
    ],
    p_event_ref: 'TEST_FUND_SELLER',
  } as any)
  if (error) throw new Error(`fundSeller: ${error.message}`)
}
const createdOrderIds: string[] = []
const createdWithdrawalIds: string[] = []
const createdPromoIds: string[] = []
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
async function parkPendingOrders() {
  await fx!.svc.from('orders').update({ status: 'cancelled' })
    .eq('buyer_id', fx!.buyer.id).eq('listing_id', fx!.listingId).eq('status', 'pending')
}

let methodId = ''
let methodCreated = false

describe.skipIf(!hasEnv)('DB-015/016/017 — money-path seams are atomic (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('money_atomicity_version')).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('listings').update({ status: 'active' }).eq('id', fx.listingId)
    const { data: m } = await fx.svc.from('withdrawal_methods').select('id').limit(1).maybeSingle()
    if (m) methodId = (m as any).id
    else {
      const { data: nm, error } = await fx.svc.from('withdrawal_methods')
        .insert({ method_name: `guardtest-${tag()}`, display_name: 'Guard Test Method', method_type: 'crypto' })
        .select('id').single()
      if (error) throw new Error(`withdrawal_methods insert: ${error.message}`)
      methodId = (nm as any).id
      methodCreated = true
    }
  }, 60_000)

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
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `fake_${id}:%`))
    }
    await del('ledger_test_cleanup(run)', svc.rpc('ledger_test_cleanup', { p_prefix: `${RUN}%` } as any))
    for (const wid of createdWithdrawalIds) {
      await del(`ledger_test_cleanup_by_withdrawal(${wid})`, svc.rpc('ledger_test_cleanup_by_withdrawal', { p_request_id: wid } as any))
    }
    await del('loyalty_credits', svc.from('loyalty_credits').delete().in('user_id', users))
    await del('promo_code_usages', svc.from('promo_code_usages').delete().in('user_id', users))
    if (createdPromoIds.length) {
      await del('promo_code_usages(by code)', svc.from('promo_code_usages').delete().in('promo_code_id', createdPromoIds))
      await del('promo_codes', svc.from('promo_codes').delete().in('id', createdPromoIds))
    }
    await del('instant_delivery_inventory', svc.from('instant_delivery_inventory').delete().eq('listing_id', fx.listingId))
    await del('withdrawal_requests', svc.from('withdrawal_requests').delete().in('user_id', users))
    if (methodCreated) await del('withdrawal_methods', svc.from('withdrawal_methods').delete().eq('id', methodId))
    await del('audit_logs', svc.from('audit_logs').delete().in('user_id', users))
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`money-atomicity cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  it('20260914100000_money_atomicity.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  // ── DB-015a: checkout supersede ───────────────────────────────────────────
  describe('DB-015a — createCheckout supersede runs CANCELLED + hold return as one RPC', () => {
    it('supersede returns the exact hold (escrow_held → user_wallet) under wallet_refund:<id>', async () => {
      sessionClient = fx!.buyer.client
      // PAY-005: the fixture's raw pending order (no charge, seconds old) reads
      // as a racing checkout still creating its charge and would be refused
      // with "payment is being prepared" rather than superseded — park it.
      await parkPendingOrders()
      await fundWallet(fx!.buyer.id, 10_00n, 'supersede')
      const { createCheckout } = await import('@/lib/actions/checkout')

      const first = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 0.5 })
      expect(first.success, first.error).toBe(true)
      const firstId = first.orderId!
      createdOrderIds.push(firstId)
      expect(await holdMinor(firstId)).toBe(50n)
      expect(await walletMinor(fx!.buyer.id)).toBe(950n)

      const second = await createCheckout({ listingId: fx!.listingId, quantity: 2 })
      expect(second.success, second.error).toBe(true)
      expect(second.orderId).not.toBe(firstId)
      createdOrderIds.push(second.orderId!)

      expect((await orderRow(firstId)).status).toBe('cancelled')
      const returned = await txnByKey(`wallet_refund:${firstId}`)
      expect(returned).not.toBeNull()
      // Exact mirror of checkout_wallet:<id> (user_wallet debit 50 / escrow_held credit 50).
      expect(await entriesOf(returned!.id)).toEqual(['buyer.user_wallet:credit:50', 'platform.escrow_held:debit:50'])
      expect(await walletMinor(fx!.buyer.id)).toBe(1000n)
    }, 60_000)

    it('seam module unreachable → nothing changes and the buyer gets the SAME pending order back', async () => {
      sessionClient = fx!.buyer.client
      await parkPendingOrders() // PAY-005, as above
      const { createCheckout } = await import('@/lib/actions/checkout')
      const a = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 0.5 })
      expect(a.success, a.error).toBe(true)
      createdOrderIds.push(a.orderId!)
      const walletBefore = await walletMinor(fx!.buyer.id)

      failOrderMoneyOnce = true
      const b = await createCheckout({ listingId: fx!.listingId, quantity: 3 })
      failOrderMoneyOnce = false

      // The stale order stayed pending (nothing was cancelled), so the unique
      // index handed the buyer that order instead of minting a second one.
      expect(b.success, b.error).toBe(true)
      expect(b.orderId).toBe(a.orderId)
      expect((await orderRow(a.orderId!)).status).toBe('pending')
      expect(await holdMinor(a.orderId!)).toBe(50n)
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)
    }, 60_000)

    itFault('in-RPC fault after the transition rolls back the cancel too; the retry converges', async () => {
      sessionClient = fx!.buyer.client
      const { createCheckout } = await import('@/lib/actions/checkout')
      const { data: pend } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id)
        .eq('listing_id', fx!.listingId).eq('status', 'pending').maybeSingle()
      let orderId = (pend as any)?.id as string | undefined
      if (!orderId) {
        const r = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 0.5 })
        expect(r.success, r.error).toBe(true)
        orderId = r.orderId!
        createdOrderIds.push(orderId)
      }
      expect(await holdMinor(orderId)).toBe(50n)
      const walletBefore = await walletMinor(fx!.buyer.id)

      const err = withFault('order_cancel_return_wallet:after_transition',
        `SELECT public.order_cancel_return_wallet('${orderId}'::uuid, 'fault-test')`)
      expect(err).toMatch(/injected fault at order_cancel_return_wallet:after_transition/)

      expect((await orderRow(orderId)).status).toBe('pending')
      expect(await txnByKey(`order:${orderId}:CANCELLED:fault-test`)).toBeNull()
      expect(await txnByKey(`wallet_refund:${orderId}`)).toBeNull()
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)

      const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
      const ok = await cancelOrderReturnWallet(orderId, 'fault-test')
      expect(ok.changed).toBe(true)
      expect(ok.walletTxnId).not.toBeNull()
      expect((await orderRow(orderId)).status).toBe('cancelled')
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore + 50n)
      // Idempotent replay: same journals, no double credit.
      const again = await cancelOrderReturnWallet(orderId, 'fault-test')
      expect(again.changed).toBe(false)
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore + 50n)
    }, 60_000)
  })

  // ── DB-015b: webhook refund credit ───────────────────────────────────────
  describe('DB-015b — REFUND_COMPLETED runs REFUNDED + wallet credit as one RPC; a failure is retried by the provider', () => {
    const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }

    it('seam failure → event failed + 500, order still paid; the provider replay is re-claimed and converges', async () => {
      const { handleWebhook } = await import('@/lib/payments/webhook-router')
      await parkPendingOrders()
      const orderId = await insertOrder({
        unit_price: 50, subtotal: 50, platform_fee_rate: 8, platform_fee: 4, total_amount: 50, seller_payout: 46,
        status: 'pending', escrow_status: 'pending',
      })
      const chargeId = `fake_${orderId}`
      const body = (status: string) => JSON.stringify({ chargeId, orderId, status, amountMinor: '5000', currency: CUR })
      const eventStatus = async () => (await fx!.svc.from('webhook_events').select('status')
        .eq('provider', 'fake').eq('provider_event_id', `${chargeId}:refunded`).single()).data as any

      const paid = await handleWebhook('fake', sig, body('paid'))
      expect(paid.ok, JSON.stringify(paid)).toBe(true)
      const walletBefore = await walletMinor(fx!.buyer.id)

      failOrderMoneyOnce = true
      const failed = await handleWebhook('fake', sig, body('refunded'))
      failOrderMoneyOnce = false
      expect(failed.ok).toBe(false)
      expect(failed.status).toBe(500)
      expect((await eventStatus()).status).toBe('failed')
      expect((await orderRow(orderId)).status).toBe('paid')
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)

      // The provider retries on 500. A failed event is claimed again (DB-015d).
      const replay = await handleWebhook('fake', sig, body('refunded'))
      expect(replay.ok, JSON.stringify(replay)).toBe(true)
      expect((replay as any).deduped).toBeUndefined()
      expect((await eventStatus()).status).toBe('processed')
      expect((await orderRow(orderId)).status).toBe('refunded')
      expect(await txnByKey(`wallet_refund:${orderId}`)).not.toBeNull()
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore + 5000n)

      // A processed event still dedupes.
      const dup = await handleWebhook('fake', sig, body('refunded'))
      expect((dup as any).deduped).toBe(true)
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore + 5000n)
    }, 60_000)

    itFault('in-RPC fault after the REFUNDED transition leaves the order paid, escrow untouched, no credit', async () => {
      const { handleWebhook } = await import('@/lib/payments/webhook-router')
      await parkPendingOrders()
      const orderId = await insertOrder({
        unit_price: 30, subtotal: 30, platform_fee_rate: 8, platform_fee: 2.4, total_amount: 30, seller_payout: 27.6,
        status: 'pending', escrow_status: 'pending',
      })
      const chargeId = `fake_${orderId}`
      const paid = await handleWebhook('fake', sig, JSON.stringify({ chargeId, orderId, status: 'paid', amountMinor: '3000', currency: CUR }))
      expect(paid.ok).toBe(true)
      const walletBefore = await walletMinor(fx!.buyer.id)
      const refundsBefore = await platformMinor('refunds')

      const err = withFault('order_refund_to_wallet:after_transition',
        `SELECT public.order_refund_to_wallet('${orderId}'::uuid, 'fault', 3000)`)
      expect(err).toMatch(/injected fault at order_refund_to_wallet:after_transition/)

      const o = await orderRow(orderId)
      expect(o.status).toBe('paid')
      expect(o.escrow_status).toBe('held')
      expect(await txnByKey(`order:${orderId}:REFUNDED:fault`)).toBeNull()
      expect(await txnByKey(`wallet_refund:${orderId}`)).toBeNull()
      expect(await platformMinor('refunds')).toBe(refundsBefore)
      expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)
    }, 60_000)
  })

  // ── DB-015c: withdrawal cancel / reject ──────────────────────────────────
  describe('DB-015c — withdrawal cancel/reject reverse the hold FIRST, in the same transaction', () => {
    async function makeHeldRequest(amountMinor: bigint, suffix: string) {
      await fundSeller(fx!.seller.id, amountMinor, suffix)
      // PR 7: one OPEN withdrawal per seller is a partial unique index. Each
      // case here needs a fresh pending row, so park whatever the previous
      // case left open (status only — its hold journal is cleaned up by id).
      await fx!.svc.from('withdrawal_requests').update({ status: 'failed' })
        .eq('user_id', fx!.seller.id).in('status', ['pending', 'approved', 'processing'])
      const { data: req, error } = await fx!.svc.from('withdrawal_requests').insert({
        user_id: fx!.seller.id, amount: Number(amountMinor) / 100, method_id: methodId, method_name: 'Guard Test Method',
        status: 'pending', fee_amount: 0, net_amount: Number(amountMinor) / 100, payment_details: {},
      }).select('id').single()
      if (error) throw new Error(`withdrawal_requests insert: ${error.message}`)
      const id = (req as any).id as string
      createdWithdrawalIds.push(id)
      const { error: he } = await fx!.svc.rpc('withdrawal_debit', {
        p_user_id: fx!.seller.id, p_amount_minor: Number(amountMinor), p_idempotency_key: `withdrawal:${id}`,
      } as any)
      if (he) throw new Error(`withdrawal_debit: ${he.message}`)
      return id
    }
    async function requestStatus(id: string) {
      const { data } = await fx!.svc.from('withdrawal_requests').select('status').eq('id', id).single()
      return (data as any).status as string
    }

    it('cancel: hold already paid out → refused, row stays pending, balance untouched', async () => {
      const id = await makeHeldRequest(30_00n, 'cancel-refused')
      const { error: pe } = await fx!.svc.rpc('withdrawal_payout', { p_request_id: id } as any)
      if (pe) throw new Error(`withdrawal_payout: ${pe.message}`)
      const availBefore = await sellerAvailMinor(fx!.seller.id)

      sessionClient = fx!.seller.client
      const { cancelWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await cancelWithdrawalRequest(id)

      expect(res.success).toBe(false)
      expect(res.error).toMatch(/already paid out/)
      expect(await requestStatus(id)).toBe('pending')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore)
    }, 60_000)

    it('cancel: normal path returns the hold and flips to cancelled; a replay is a no-op', async () => {
      const id = await makeHeldRequest(25_00n, 'cancel-ok')
      const availBefore = await sellerAvailMinor(fx!.seller.id)
      sessionClient = fx!.seller.client
      const { cancelWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await cancelWithdrawalRequest(id)
      expect(res.success, res.error).toBe(true)
      expect(await requestStatus(id)).toBe('cancelled')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).not.toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore + 2500n)
      const again = await cancelWithdrawalRequest(id)
      expect(again.success).toBe(true)
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore + 2500n)
    }, 60_000)

    it('cancel: a stranger cannot cancel someone else\'s request through the RPC', async () => {
      const id = await makeHeldRequest(10_00n, 'cancel-stranger')
      sessionClient = fx!.buyer.client
      const { cancelWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await cancelWithdrawalRequest(id)
      expect(res.success).toBe(false)
      expect(await requestStatus(id)).toBe('pending')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
    }, 60_000)

    it('reject: hold already paid out → refused, no "Funds stay in your wallet" notification', async () => {
      const id = await makeHeldRequest(20_00n, 'reject-refused')
      const { error: pe } = await fx!.svc.rpc('withdrawal_payout', { p_request_id: id } as any)
      if (pe) throw new Error(`withdrawal_payout: ${pe.message}`)
      const availBefore = await sellerAvailMinor(fx!.seller.id)
      const { count: notifBefore } = await fx!.svc.from('notifications').select('id', { count: 'exact' })
        .eq('user_id', fx!.seller.id).eq('type', 'withdrawal_rejected').limit(1)

      sessionClient = fx!.admin.client
      const { rejectWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await rejectWithdrawalRequest({ requestId: id, reason: 'guard test' })

      const { count: notifAfter } = await fx!.svc.from('notifications').select('id', { count: 'exact' })
        .eq('user_id', fx!.seller.id).eq('type', 'withdrawal_rejected').limit(1)
      expect(res.success).toBe(false)
      expect(await requestStatus(id)).toBe('pending')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore)
      expect(notifAfter).toBe(notifBefore)
    }, 60_000)

    it('reject: normal path returns the hold, flips to rejected and notifies truthfully', async () => {
      const id = await makeHeldRequest(15_00n, 'reject-ok')
      const availBefore = await sellerAvailMinor(fx!.seller.id)
      sessionClient = fx!.admin.client
      const { rejectWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await rejectWithdrawalRequest({ requestId: id, reason: 'guard test ok' })
      expect(res.success, res.error).toBe(true)
      expect(await requestStatus(id)).toBe('rejected')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).not.toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore + 1500n)
      const { data: notif } = await fx!.svc.from('notifications').select('message').eq('user_id', fx!.seller.id)
        .eq('type', 'withdrawal_rejected').order('created_at', { ascending: false }).limit(1).maybeSingle()
      expect((notif as any)?.message ?? '').toMatch(/guard test ok\. Funds stay in your wallet/)
    }, 60_000)

    itFault('in-RPC fault after the reversal rolls the reversal back with the flip', async () => {
      const id = await makeHeldRequest(12_00n, 'cancel-fault')
      const availBefore = await sellerAvailMinor(fx!.seller.id)
      const err = withFault('withdrawal_cancel:after_reversal',
        `SELECT public.withdrawal_cancel('${id}'::uuid, '${fx!.seller.id}'::uuid)`)
      expect(err).toMatch(/injected fault at withdrawal_cancel:after_reversal/)
      expect(await requestStatus(id)).toBe('pending')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore)

      const err2 = withFault('withdrawal_reject:after_reversal',
        `SELECT public.withdrawal_reject('${id}'::uuid, '${fx!.admin.id}'::uuid, 'x')`)
      expect(err2).toMatch(/injected fault at withdrawal_reject:after_reversal/)
      expect(await requestStatus(id)).toBe('pending')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore)
    }, 60_000)
  })

  // ── DB-016a: instant-delivery inventory ──────────────────────────────────
  describe('DB-016a — deliverCodeToBuyer claims one code atomically (FOR UPDATE SKIP LOCKED)', () => {
    async function addCodes(n: number, prefix: string) {
      const { encryptDeliveryData } = await import('@/lib/crypto/delivery-encryption')
      const rows = Array.from({ length: n }, (_, i) => ({
        listing_id: fx!.listingId, delivery_type: 'code', status: 'available',
        delivery_data: encryptDeliveryData(`${prefix}-${i}`), created_by: fx!.seller.id,
      }))
      const { error } = await fx!.svc.from('instant_delivery_inventory').insert(rows)
      if (error) throw new Error(`inventory insert: ${error.message}`)
    }
    async function resetInventory() {
      await fx!.svc.from('orders').update({ instant_delivery_inventory_id: null, instant_delivery_code: null })
        .eq('listing_id', fx!.listingId).not('instant_delivery_inventory_id', 'is', null)
      await fx!.svc.from('instant_delivery_inventory').delete().eq('listing_id', fx!.listingId)
    }
    const paidOrder = (suffix: string) => insertOrder({ status: 'paid', escrow_status: 'held', order_number: `GT-ID-${suffix}-${tag()}` })
    async function soldCount() {
      const { count } = await fx!.svc.from('instant_delivery_inventory').select('id', { count: 'exact' })
        .eq('listing_id', fx!.listingId).eq('status', 'sold').limit(1)
      return count ?? 0
    }
    /** Session client whose orders UPDATE fails once (the plaintext stamp). */
    function failingOrdersUpdateOnce() {
      const svc = fx!.svc
      const realFrom = svc.from.bind(svc)
      let failOnce = true
      return new Proxy(svc, {
        get(target, prop, recv) {
          if (prop !== 'from') return Reflect.get(target, prop, recv)
          return (table: string) => {
            const q = realFrom(table as any)
            if (table !== 'orders' || !failOnce) return q
            return new Proxy(q, {
              get(qt, qp, qr) {
                if (qp !== 'update') return Reflect.get(qt, qp, qr)
                return () => { failOnce = false; return { eq: () => ({ is: async () => ({ error: { message: 'injected: orders update failed' } }) }) } }
              },
            })
          }
        },
      }) as any
    }

    it('a failed order UPDATE after the claim no longer burns a code; the retry returns the same code', async () => {
      await resetInventory()
      await addCodes(2, 'burn')
      const orderId = await paidOrder('burn')
      sessionClient = failingOrdersUpdateOnce()
      const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')

      const first = await deliverCodeToBuyer(orderId, fx!.buyer.id)
      const afterFirst = await orderRow(orderId)
      const second = await deliverCodeToBuyer(orderId, fx!.buyer.id)

      expect(first.success, first.error).toBe(true)
      expect(afterFirst.instant_delivery_inventory_id).not.toBeNull() // stamped inside the claim
      expect(second.success).toBe(true)
      expect(second.code).toBe(first.code)
      expect(await soldCount()).toBe(1)
    }, 60_000)

    it('two concurrent orders receive DIFFERENT codes', async () => {
      await resetInventory()
      await addCodes(2, 'race')
      const a = await paidOrder('race-a')
      const b = await paidOrder('race-b')
      sessionClient = fx!.svc
      const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')
      const [ra, rb] = await Promise.all([deliverCodeToBuyer(a, fx!.buyer.id), deliverCodeToBuyer(b, fx!.buyer.id)])
      expect(ra.success && rb.success, `${ra.error} / ${rb.error}`).toBe(true)
      expect(ra.code).not.toBe(rb.code)
      expect(await soldCount()).toBe(2)
      const { data: inv } = await fx!.svc.from('instant_delivery_inventory').select('sold_to_order_id').eq('listing_id', fx!.listingId).eq('status', 'sold')
      expect((inv ?? []).map((r: any) => r.sold_to_order_id).sort()).toEqual([a, b].sort())
    }, 60_000)

    itFault('in-RPC fault after the inventory UPDATE leaves the code available and the order unstamped', async () => {
      await resetInventory()
      await addCodes(1, 'fault')
      const orderId = await paidOrder('fault')
      const err = withFault('inventory_claim_for_order:after_inventory',
        `SELECT public.inventory_claim_for_order('${orderId}'::uuid)`)
      expect(err).toMatch(/injected fault at inventory_claim_for_order:after_inventory/)
      expect(await soldCount()).toBe(0)
      expect((await orderRow(orderId)).instant_delivery_inventory_id).toBeNull()

      sessionClient = fx!.svc
      const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')
      const ok = await deliverCodeToBuyer(orderId, fx!.buyer.id)
      expect(ok.success).toBe(true)
      expect(ok.code).toBe('fault-0')
      const other = await paidOrder('fault-none')
      const none = await deliverCodeToBuyer(other, fx!.buyer.id)
      expect(none.success).toBe(false)
      expect(none.error).toMatch(/No codes available/)
      expect(await soldCount()).toBe(1)
    }, 60_000)
  })

  // ── DB-016b: promo usage counter ─────────────────────────────────────────
  describe('DB-016b — recordPromoUsage is one RPC under the promo row lock', () => {
    async function makePromo() {
      const { data: promo, error } = await fx!.svc.from('promo_codes').insert({
        code: `GT${tag().toUpperCase()}`, type: 'flat', value: 1, usage_limit: 100, per_user_limit: 100, is_active: true,
      }).select('id').single()
      if (error) throw new Error(`promo insert: ${error.message}`)
      createdPromoIds.push((promo as any).id)
      return (promo as any).id as string
    }
    const totalUsed = async (id: string) => ((await fx!.svc.from('promo_codes').select('total_used').eq('id', id).single()).data as any).total_used as number
    const usages = async (id: string) => (await fx!.svc.from('promo_code_usages').select('id', { count: 'exact' }).eq('promo_code_id', id).limit(1)).count ?? 0

    it('N concurrent redemptions on N orders → N usage rows and total_used = N; a replay does not double-count', async () => {
      const promoId = await makePromo()
      sessionClient = fx!.buyer.client // the write no longer runs on the session client
      const { recordPromoUsage } = await import('@/lib/actions/promo')
      const N = 12
      await parkPendingOrders()
      const orderIds: string[] = []
      for (let i = 0; i < N; i++) orderIds.push(await insertOrder({ status: 'paid', escrow_status: 'held', order_number: `GT-PR-${i}-${tag()}` }))
      await Promise.all(orderIds.map((orderId) =>
        recordPromoUsage({ promoCodeId: promoId, orderId, discountAmount: 1, userId: fx!.buyer.id })))
      expect(await usages(promoId)).toBe(N)
      expect(await totalUsed(promoId)).toBe(N)
      await recordPromoUsage({ promoCodeId: promoId, orderId: orderIds[0], discountAmount: 1, userId: fx!.buyer.id })
      expect(await usages(promoId)).toBe(N)
      expect(await totalUsed(promoId)).toBe(N)
    }, 60_000)

    itFault('in-RPC fault after the usage insert leaves no row and no increment', async () => {
      const promoId = await makePromo()
      const err = withFault('promo_usage_record:after_usage',
        `SELECT public.promo_usage_record('${promoId}'::uuid, '${fx!.completedOrderId}'::uuid, '${fx!.buyer.id}'::uuid, 1)`)
      expect(err).toMatch(/injected fault at promo_usage_record:after_usage/)
      expect(await usages(promoId)).toBe(0)
      expect(await totalUsed(promoId)).toBe(0)
    }, 60_000)
  })

  // ── DB-017: referral commission ──────────────────────────────────────────
  describe('DB-017 — confirmOrderReceipt records the referrer\'s commission next to cashback', () => {
    it('a referred buyer completing an order writes one purchase_commission row (10% of platform_fee)', async () => {
      const { error: re } = await fx!.svc.from('profiles').update({ referred_by: fx!.admin.id }).eq('id', fx!.buyer.id)
      if (re) throw new Error(`profiles.referred_by: ${re.message}`)
      const orderId = await insertOrder({
        unit_price: 100, subtotal: 100, platform_fee_rate: 2, payment_processing_fee_rate: 5,
        platform_fee: 2, payment_processing_fee: 5, total_amount: 107, seller_payout: 92,
        status: 'delivered', escrow_status: 'held', delivered_at: new Date().toISOString(),
      })
      sessionClient = fx!.buyer.client
      const { confirmOrderReceipt } = await import('@/lib/actions/orders')
      const res = await confirmOrderReceipt(orderId)
      expect(res.success, res.error).toBe(true)
      expect((await orderRow(orderId)).status).toBe('completed')
      await new Promise((r) => setTimeout(r, 1500)) // fire-and-forget cashback + commission

      const { data: cashback } = await fx!.svc.from('loyalty_credits').select('id').eq('order_id', orderId)
      const { data: commission } = await fx!.svc.from('referral_earnings')
        .select('referrer_id, referred_user_id, amount, status, type').eq('order_id', orderId)
      expect((cashback ?? []).length).toBe(1)
      expect(commission).toHaveLength(1)
      expect((commission as any)[0]).toMatchObject({
        referrer_id: fx!.admin.id, referred_user_id: fx!.buyer.id, type: 'purchase_commission', status: 'pending',
      })
      expect(Number((commission as any)[0].amount)).toBe(0.2)

      // Once per order: a second recorder run (replayed confirm / auto-release) is a no-op.
      const { recordReferralCommission } = await import('@/lib/referral/commission')
      await recordReferralCommission(orderId)
      const { count } = await fx!.svc.from('referral_earnings').select('id', { count: 'exact' }).eq('order_id', orderId).limit(1)
      expect(count).toBe(1)
    }, 60_000)
  })
})
