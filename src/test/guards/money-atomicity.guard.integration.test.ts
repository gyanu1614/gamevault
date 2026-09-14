/**
 * DB-015 / DB-016 / DB-017 — fix/money-atomicity (audit 2026-09-11).
 *
 * Every money path below composes 2+ atomic RPCs / statements in app code
 * with nothing in between that compensates or retries. These tests drive the
 * REAL app functions against the local stack and inject one fault between
 * the steps (a thrown wallet RPC, a failing UPDATE, a hold that was already
 * paid out, N concurrent callers). Each RED case asserts the BAD end state
 * the audit describes; after the fix the same fault must leave balances
 * consistent (the GREEN assertions replace the RED ones in the same file).
 *
 * Money invariants asserted throughout (all in minor units, from the ledger):
 *   buyer wallet = user_wallet_balance(buyer)            (derived, never stored)
 *   seller avail = seller_available_balance(seller)
 *   hold(order)  = checkout_wallet_hold_minor(order)     (escrow_held credit at checkout)
 *
 * All rows are fixture-owned and removed in afterAll — including the rows the
 * driven code writes as side effects (notifications, loyalty_credits,
 * ledger journals, webhook_events, promo usages, inventory).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

// ── fault switches (set by each test, read by the mocks) ──────────────────
let sessionClient: SupabaseClient | null = null
let failRefundToWallet = false

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('server-only', () => ({}))
// Every test that touches email must mock the transport (CLAUDE.md).
vi.mock('@/lib/email', async (importOriginal) => {
  // Stub every real export by name (a Proxy that answers `then` makes the
  // module a thenable and hangs `await import()`).
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/wallet/wallet', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/wallet/wallet')>()
  return {
    ...real,
    refundToWallet: async (args: Parameters<typeof real.refundToWallet>[0]) => {
      if (failRefundToWallet) throw new Error('injected: wallet RPC unreachable')
      return real.refundToWallet(args)
    },
  }
})

let fx: Fixture | null = null
const CUR = 'USD'
const tag = () => Math.random().toString(36).slice(2, 8)
const RUN = `test:ledger:money-atomicity:${tag()}`

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
    p_owner_type: kind === 'external_payout' ? 'external' : 'platform', p_owner_id: null, p_kind: kind, p_currency: CUR,
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
async function orderRow(orderId: string) {
  const { data } = await fx!.svc.from('orders').select('*').eq('id', orderId).single()
  return data as any
}
/** Fund a buyer wallet from the platform refunds account (test journal, RUN-prefixed key). */
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
/** Give a seller an available balance (test journal). */
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

/**
 * Remove the three journals a withdrawal request can own. Uses the RPC from
 * 20260914100000_money_atomicity.sql when present; before that migration is
 * applied (RED phase) falls back to psql against the local stack.
 */
async function cleanupWithdrawalLedger(svc: SupabaseClient, requestId: string): Promise<{ error: { message: string } | null }> {
  const rpc = await svc.rpc('ledger_test_cleanup_by_withdrawal', { p_request_id: requestId } as any)
  if (!rpc.error) return { error: null }
  if (!/Could not find the function/.test(rpc.error.message)) return { error: rpc.error }
  const { execFileSync } = await import('node:child_process')
  const db = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  const keys = ['withdrawal', 'withdrawal_reversal', 'payout'].map((k) => `'${k}:${requestId}'`).join(',')
  const sql = `ALTER TABLE ledger_entries DISABLE TRIGGER trg_ledger_entries_immutable; ALTER TABLE ledger_transactions DISABLE TRIGGER trg_ledger_transactions_immutable;
DELETE FROM ledger_entries WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE idempotency_key IN (${keys}));
DELETE FROM ledger_transactions WHERE idempotency_key IN (${keys});
ALTER TABLE ledger_entries ENABLE TRIGGER trg_ledger_entries_immutable; ALTER TABLE ledger_transactions ENABLE TRIGGER trg_ledger_transactions_immutable;`
  try { execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: 'pipe' }); return { error: null } }
  catch (e: any) { return { error: { message: `psql fallback: ${e?.stderr?.toString() ?? e}` } } }
}

const createdOrderIds: string[] = []
const createdWithdrawalIds: string[] = []
const createdPromoIds: string[] = []
let methodId = ''
let methodCreated = false

describe.skipIf(!hasEnv)('DB-015/016/017 — money-path seams (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('listings').update({ status: 'active' }).eq('id', fx.listingId)
    // A withdrawal method row for withdrawal_requests.method_id (FK).
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
    // Side-effect rows first (they reference orders / users).
    const { data: allOrders } = await svc.from('orders').select('id').or(`buyer_id.in.(${users.join(',')}),seller_id.in.(${users.join(',')})`)
    const orderIds = Array.from(new Set([...(allOrders ?? []).map((o: any) => o.id), ...createdOrderIds]))
    for (const id of orderIds) {
      await del(`ledger_test_cleanup_by_order(${id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: id } as any))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `fake_${id}:%`))
    }
    await del('ledger_test_cleanup(run)', svc.rpc('ledger_test_cleanup', { p_prefix: `${RUN}%` } as any))
    for (const wid of createdWithdrawalIds) {
      // withdrawal_* journals carry fixed keys (withdrawal:<id>, payout:<id>,
      // withdrawal_reversal:<id>) that ledger_test_cleanup's prefix rail refuses.
      await del(`ledger_test_cleanup_by_withdrawal(${wid})`, cleanupWithdrawalLedger(svc, wid))
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
    // makeFixture's cleanup removes orders, notifications, referral_earnings, users; it throws on residue.
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`money-atomicity cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  // ── DB-015 (a): checkout supersede ───────────────────────────────────────
  describe('DB-015a — createCheckout supersede: transition(CANCELLED) then a separate wallet return', () => {
    it('a wallet RPC failure after the transition strands the buyer\'s wallet credit on a terminal order', async () => {
      sessionClient = fx!.buyer.client
      await fundWallet(fx!.buyer.id, 10_00n, 'supersede')
      const { createCheckout } = await import('@/lib/actions/checkout')

      // 1. First checkout: 1 unit ($1.07 total), $0.50 of wallet applied →
      //    pending order holding 50 minor; the rest goes to the fake provider.
      const first = await createCheckout({ listingId: fx!.listingId, quantity: 1, walletAmount: 0.5 })
      expect(first.success, first.error).toBe(true)
      const firstId = first.orderId!
      createdOrderIds.push(firstId)
      expect(await holdMinor(firstId)).toBe(50n)
      expect(await walletMinor(fx!.buyer.id)).toBe(950n)

      // 2. Re-checkout with a different quantity → amounts drift → supersede path.
      //    FAULT: the wallet return RPC throws after the CANCELLED transition.
      failRefundToWallet = true
      const second = await createCheckout({ listingId: fx!.listingId, quantity: 2 })
      failRefundToWallet = false
      expect(second.success, second.error).toBe(true)
      if (second.orderId && second.orderId !== firstId) createdOrderIds.push(second.orderId)

      const superseded = await orderRow(firstId)
      const wallet = await walletMinor(fx!.buyer.id)
      const returned = await txnByKey(`wallet_refund:${firstId}`)

      // Bad end state (audit): the order is terminal, the return never posted,
      // and no later path will — the buyer is $2 short forever.
      expect(superseded.status).toBe('cancelled')
      expect(returned).toBeNull()
      expect(wallet).toBe(950n) // should be 1000n — the 50 hold is stranded
    }, 60_000)
  })

  // ── DB-015 (b): webhook refund credit ────────────────────────────────────
  describe('DB-015b — REFUND_COMPLETED webhook: transition(REFUNDED) then a swallowed wallet credit', () => {
    it('a wallet RPC failure loses the buyer credit while the event is marked processed (provider never retries)', async () => {
      const { handleWebhook } = await import('@/lib/payments/webhook-router')
      const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }
      // one_pending_order_per_buyer_listing: park the pending order DB-015a left behind.
      await fx!.svc.from('orders').update({ status: 'cancelled' }).eq('buyer_id', fx!.buyer.id).eq('listing_id', fx!.listingId).eq('status', 'pending')
      const { data: o, error } = await fx!.svc.from('orders').insert({
        buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
        unit_price: 50, subtotal: 50, platform_fee_rate: 8, payment_processing_fee_rate: 0,
        platform_fee: 4, payment_processing_fee: 0, total_amount: 50, seller_payout: 46, currency: CUR,
        status: 'pending', escrow_status: 'pending',
      }).select('id').single()
      if (error) throw new Error(`order insert: ${error.message}`)
      const orderId = (o as any).id as string
      createdOrderIds.push(orderId)
      const chargeId = `fake_${orderId}`
      const body = (status: string) => JSON.stringify({ chargeId, orderId, status, amountMinor: '5000', currency: CUR })

      const paid = await handleWebhook('fake', sig, body('paid'))
      expect(paid.ok, JSON.stringify(paid)).toBe(true)
      expect((await orderRow(orderId)).status).toBe('paid')
      const walletBefore = await walletMinor(fx!.buyer.id)

      failRefundToWallet = true
      const refunded = await handleWebhook('fake', sig, body('refunded'))
      failRefundToWallet = false

      const { data: ev } = await fx!.svc.from('webhook_events').select('status')
        .eq('provider', 'fake').eq('provider_event_id', `${chargeId}:refunded`).single()
      const order = await orderRow(orderId)
      const credit = await txnByKey(`wallet_refund:${orderId}`)
      const walletAfter = await walletMinor(fx!.buyer.id)

      // Provider retry is deduped, so the lost credit is permanent.
      const replay = await handleWebhook('fake', sig, body('refunded'))

      expect(refunded.ok).toBe(true)
      expect((ev as any).status).toBe('processed')
      expect(order.status).toBe('refunded')
      expect(credit).toBeNull()
      expect(walletAfter).toBe(walletBefore) // buyer never got the 5000 back
      expect((replay as any).deduped).toBe(true)
      expect(await txnByKey(`wallet_refund:${orderId}`)).toBeNull()
    }, 60_000)
  })

  // ── DB-015 (c): withdrawal cancel / reject ───────────────────────────────
  describe('DB-015c — withdrawal cancel/reject flip status BEFORE the ledger reversal', () => {
    async function makeHeldRequest(amountMinor: bigint, suffix: string) {
      await fundSeller(fx!.seller.id, amountMinor, suffix)
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

    it('cancelWithdrawalRequest: reversal refused (hold already paid out) but the row still flips to cancelled', async () => {
      const id = await makeHeldRequest(30_00n, 'cancel')
      // FAULT: the hold was settled out of band (ops paid it) — the ledger
      // refuses the reversal. The app flips status first and only then asks.
      const { error: pe } = await fx!.svc.rpc('withdrawal_payout', { p_request_id: id } as any)
      if (pe) throw new Error(`withdrawal_payout: ${pe.message}`)
      const availBefore = await sellerAvailMinor(fx!.seller.id)

      sessionClient = fx!.seller.client
      const { cancelWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await cancelWithdrawalRequest(id)

      // Bad end state: "cancelled" (UI: funds stay in your wallet) while the
      // money is in external_payout and nothing came back.
      expect(res.success).toBe(true)
      expect(await requestStatus(id)).toBe('cancelled')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore)
    }, 60_000)

    it('rejectWithdrawalRequest: same ordering — rejected + "Funds stay in your wallet" with nothing returned', async () => {
      const id = await makeHeldRequest(20_00n, 'reject')
      const { error: pe } = await fx!.svc.rpc('withdrawal_payout', { p_request_id: id } as any)
      if (pe) throw new Error(`withdrawal_payout: ${pe.message}`)
      const availBefore = await sellerAvailMinor(fx!.seller.id)

      sessionClient = fx!.admin.client
      const { rejectWithdrawalRequest } = await import('@/lib/actions/withdrawals')
      const res = await rejectWithdrawalRequest({ requestId: id, reason: 'guard test' })

      const { data: notif } = await fx!.svc.from('notifications').select('message')
        .eq('user_id', fx!.seller.id).eq('type', 'withdrawal_rejected').order('created_at', { ascending: false }).limit(1).maybeSingle()

      expect(res.success).toBe(true)
      expect(await requestStatus(id)).toBe('rejected')
      expect(await txnByKey(`withdrawal_reversal:${id}`)).toBeNull()
      expect(await sellerAvailMinor(fx!.seller.id)).toBe(availBefore)
      expect((notif as any)?.message ?? '').toMatch(/Funds stay in your wallet/)
    }, 60_000)
  })

  // ── DB-016 (a): instant-delivery inventory ───────────────────────────────
  describe('DB-016a — deliverCodeToBuyer: unlocked select, then two separate UPDATEs', () => {
    async function addCodes(n: number, prefix: string) {
      const { encryptDeliveryData } = await import('@/lib/crypto/delivery-encryption')
      const rows = Array.from({ length: n }, (_, i) => ({
        listing_id: fx!.listingId, delivery_type: 'code', status: 'available',
        delivery_data: encryptDeliveryData(`${prefix}-${i}`), created_by: fx!.seller.id,
      }))
      const { error } = await fx!.svc.from('instant_delivery_inventory').insert(rows)
      if (error) throw new Error(`inventory insert: ${error.message}`)
    }
    async function paidOrder(suffix: string) {
      const { data, error } = await fx!.svc.from('orders').insert({
        buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
        unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
        platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: CUR,
        status: 'paid', escrow_status: 'held', order_number: `GT-ID-${suffix}-${tag()}`,
      }).select('id').single()
      if (error) throw new Error(`paid order insert: ${error.message}`)
      createdOrderIds.push((data as any).id)
      return (data as any).id as string
    }
    async function soldCount() {
      const { count } = await fx!.svc.from('instant_delivery_inventory').select('id', { count: 'exact', head: true })
        .eq('listing_id', fx!.listingId).eq('status', 'sold')
      return count ?? 0
    }

    it('a failed order UPDATE after the inventory UPDATE burns the code, and the retry consumes a second one', async () => {
      await addCodes(2, 'burn')
      const orderId = await paidOrder('burn')
      // The action runs on the session client; give it the service client so
      // RLS is not what we are measuring, then FAULT the orders UPDATE once.
      const svc = fx!.svc
      const realFrom = svc.from.bind(svc)
      let failOnce = true
      sessionClient = new Proxy(svc, {
        get(target, prop, recv) {
          if (prop !== 'from') return Reflect.get(target, prop, recv)
          return (table: string) => {
            const q = realFrom(table as any)
            if (table !== 'orders' || !failOnce) return q
            return new Proxy(q, {
              get(qt, qp, qr) {
                if (qp !== 'update') return Reflect.get(qt, qp, qr)
                return () => { failOnce = false; return { eq: async () => ({ error: { message: 'injected: orders update failed' } }) } }
              },
            })
          }
        },
      }) as any
      const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')

      const first = await deliverCodeToBuyer(orderId, fx!.buyer.id)
      const afterFirst = await orderRow(orderId)
      const second = await deliverCodeToBuyer(orderId, fx!.buyer.id)

      // Bad end state: two codes sold for one order; the first is orphaned.
      expect(first.success).toBe(true)
      expect(afterFirst.instant_delivery_inventory_id).toBeNull()
      expect(second.success).toBe(true)
      expect(second.code).not.toBe(first.code)
      expect(await soldCount()).toBe(2)
    }, 60_000)

    it('two concurrent orders can be handed the SAME code (no row lock between select and update)', async () => {
      await fx!.svc.from('instant_delivery_inventory').delete().eq('listing_id', fx!.listingId)
      await addCodes(2, 'race')
      const a = await paidOrder('race-a')
      const b = await paidOrder('race-b')
      // Deterministic interleaving: both callers finish their unlocked
      // `select … limit(1).single()` before either issues its UPDATE (a
      // barrier on the inventory read). Any real two-request race is this.
      const svc = fx!.svc
      const realFrom = svc.from.bind(svc)
      let arrived = 0
      let release!: () => void
      const gate = new Promise<void>((r) => { release = r })
      sessionClient = new Proxy(svc, {
        get(target, prop, recv) {
          if (prop !== 'from') return Reflect.get(target, prop, recv)
          return (table: string) => {
            const q = realFrom(table as any)
            if (table !== 'instant_delivery_inventory') return q
            return new Proxy(q, {
              get(qt, qp, qr) {
                const v = Reflect.get(qt, qp, qr)
                if (qp !== 'select') return typeof v === 'function' ? v.bind(qt) : v
                return (...a: any[]) => {
                  const sel = v.apply(qt, a)
                  const realSingle = sel.single.bind(sel)
                  sel.single = async () => {
                    const row = await realSingle()
                    if (++arrived >= 2) release()
                    await Promise.race([gate, new Promise((r) => setTimeout(r, 3000))])
                    return row
                  }
                  return sel
                }
              },
            })
          }
        },
      }) as any
      const { deliverCodeToBuyer } = await import('@/lib/actions/instant-delivery')
      const [ra, rb] = await Promise.all([deliverCodeToBuyer(a, fx!.buyer.id), deliverCodeToBuyer(b, fx!.buyer.id)])
      expect(ra.success && rb.success, `${ra.error} / ${rb.error}`).toBe(true)
      // RED: the two buyers received the same code.
      expect(ra.code).toBe(rb.code)
    }, 60_000)
  })

  // ── DB-016 (b): promo usage counter ──────────────────────────────────────
  describe('DB-016b — recordPromoUsage: SELECT total_used then UPDATE n+1', () => {
    it('N concurrent redemptions undercount total_used while N usage rows exist', async () => {
      const { data: promo, error } = await fx!.svc.from('promo_codes').insert({
        code: `GT${tag().toUpperCase()}`, type: 'flat', value: 1, usage_limit: 100, per_user_limit: 100, is_active: true,
      }).select('id').single()
      if (error) throw new Error(`promo insert: ${error.message}`)
      const promoId = (promo as any).id as string
      createdPromoIds.push(promoId)
      sessionClient = fx!.svc
      const { recordPromoUsage } = await import('@/lib/actions/promo')
      const N = 12
      await Promise.all(Array.from({ length: N }, () =>
        recordPromoUsage({ promoCodeId: promoId, orderId: fx!.completedOrderId, discountAmount: 1, userId: fx!.buyer.id })))
      const { count } = await fx!.svc.from('promo_code_usages').select('id', { count: 'exact', head: true }).eq('promo_code_id', promoId)
      const { data: after } = await fx!.svc.from('promo_codes').select('total_used').eq('id', promoId).single()
      expect(count).toBe(N)
      // RED: lost updates — the counter is below the number of usages.
      expect((after as any).total_used).toBeLessThan(N)
    }, 60_000)
  })

  // ── DB-017: referral commission never recorded ───────────────────────────
  describe('DB-017 — confirmOrderReceipt records cashback but no referral commission', () => {
    it('a referred buyer completing an order leaves referral_earnings empty', async () => {
      // admin referred the buyer.
      const { error: re } = await fx!.svc.from('profiles').update({ referred_by: fx!.admin.id }).eq('id', fx!.buyer.id)
      if (re) throw new Error(`profiles.referred_by: ${re.message}`)
      const { data: o, error } = await fx!.svc.from('orders').insert({
        buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, listing_id: fx!.listingId, quantity: 1,
        unit_price: 100, subtotal: 100, platform_fee_rate: 2, payment_processing_fee_rate: 5,
        platform_fee: 2, payment_processing_fee: 5, total_amount: 107, seller_payout: 92, currency: CUR,
        status: 'delivered', escrow_status: 'held', delivered_at: new Date().toISOString(),
      }).select('id').single()
      if (error) throw new Error(`order insert: ${error.message}`)
      const orderId = (o as any).id as string
      createdOrderIds.push(orderId)

      sessionClient = fx!.buyer.client
      const { confirmOrderReceipt } = await import('@/lib/actions/orders')
      const res = await confirmOrderReceipt(orderId)
      expect(res.success, res.error).toBe(true)
      expect((await orderRow(orderId)).status).toBe('completed')
      // fire-and-forget cashback needs a tick
      await new Promise((r) => setTimeout(r, 1500))

      const { data: cashback } = await fx!.svc.from('loyalty_credits').select('id').eq('order_id', orderId)
      const { data: commission } = await fx!.svc.from('referral_earnings').select('id, amount').eq('order_id', orderId)
      expect((cashback ?? []).length).toBe(1)
      // RED: no commission row for the referrer.
      expect((commission ?? []).length).toBe(0)
    }, 60_000)
  })
})
