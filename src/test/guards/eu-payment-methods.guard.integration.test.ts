/**
 * Checkout B4 — EU Payssion methods, the DB side (docs/handoff/checkout-b4.md,
 * docs/payments/eu-methods-probe.md). Same harness as buyer-method-fees.guard:
 * the real createCheckout through a buyer session, service role for the RPC,
 * providers stubbed by name, against this worktree's local stack.
 *
 *   · every wired EU method is offered by eligibleMethods for a $19.99 order
 *     with a quote, and the order createCheckout writes snapshots that quote;
 *   · the fee-row key matches the probed pm_id (bancomatpay_it; bancomat_it gone);
 *   · min_total_minor: EPS / MB Way are refused `under_min` below €1.00 (×1.05
 *     headroom) by the quote (tile hidden) AND by order_create_pending on the
 *     ACTUAL charge (wallet credit shrinks it under the minimum) — no order,
 *     no wallet debit, no attempt; the B3 "€1 min fee" misread is gone;
 *   · paysafecard: refundable=false is what /fees promises ("Store credit
 *     only"); no app code calls a provider refund() for ANY method;
 *   · an in-RPC fault at the new check point leaves nothing behind.
 *
 * Every row this file causes is removed in afterAll; seed rows it edits are
 * restored.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/security/rate-limit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/security/rate-limit')>()
  return { ...real, checkRateLimit: async (name: string, id: string) => ({ limited: false, retryAfter: 60, key: `${name}:${id}` }) }
})
vi.mock('@/lib/payments/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/payments/registry')>()
  const { fakeProvider } = await import('@/lib/payments/providers/fake')
  return { ...real, getProvider: (name: string) => ({ ...fakeProvider, name }) }
})

const EU = ['trustly', 'blik_pl', 'p24_pl', 'eps_at', 'mbway_pt', 'bancomatpay_it', 'payu_cz', 'paysafecard'] as const
let fx: Fixture | null = null
const CUR = 'USD'
const PRICE = 19.99
const CHEAP = 0.50 // subtotal + fee stays under €1.00 × 1.05 at EUR 1.17 ($1.2285) for EPS and MB Way
let listingId = ''
let cheapListingId = ''
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itFault = it.skipIf(!TARGET_IS_LOCAL)
const tag = () => Math.random().toString(36).slice(2, 8)
const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const cents = (n: number) => Math.round(n * 100)

function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}
async function checkout(extra: Record<string, unknown> = {}) {
  const { createCheckout } = await import('@/lib/actions/checkout')
  return createCheckout({ listingId, quantity: 1, ...extra })
}
async function orderRow(orderId: string) {
  const { data, error } = await fx!.svc.from('orders').select('*').eq('id', orderId).single()
  if (error) throw new Error(`order ${orderId}: ${error.message}`)
  return data as any
}
async function pendingOrders(lid = listingId) {
  const { data } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id).eq('listing_id', lid).eq('status', 'pending')
  return (data ?? []) as any[]
}
async function parkPendingOrders() {
  const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
  for (const lid of [listingId, cheapListingId]) for (const o of await pendingOrders(lid)) await cancelOrderReturnWallet(o.id, 'test-reset')
}
async function walletMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', { p_user_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function fundWallet(userId: string, minor: bigint) {
  const { error } = await fx!.svc.rpc('wallet_credit', {
    p_user_id: userId, p_amount_minor: minor.toString(), p_currency: CUR, p_counterparty: 'refunds',
    p_idempotency_key: `test:ledger:b4:fund:${tag()}`, p_event_ref: 'TEST_FUND', p_order_id: null,
  } as any)
  if (error) throw new Error(`wallet_credit: ${error.message}`)
}
async function quote(method: string, subtotalMinor: number) {
  const { data, error } = await fx!.svc.rpc('buyer_fee_quote', { p_method: method, p_subtotal_minor: subtotalMinor, p_currency: CUR } as any)
  if (error) throw new Error(`buyer_fee_quote(${method}): ${error.message}`)
  return data as any
}
async function eligible(subtotalMinor = cents(PRICE)) {
  const { eligibleMethods } = await import('@/lib/payments/eligibility')
  return eligibleMethods({ buyerId: fx!.buyer.id, currency: CUR, country: null, subtotalMinor: BigInt(subtotalMinor) })
}
async function insertListing(price: number) {
  const { data: base } = await fx!.svc.from('listings').select('game_id, game_category_id').eq('id', fx!.listingId).single()
  const { data: l, error } = await fx!.svc.from('listings').insert({
    seller_id: fx!.seller.id, game_id: (base as any).game_id, game_category_id: (base as any).game_category_id,
    title: `GUARD-TEST-b4-${tag()}`, description: 'EU method throwaway', price, quantity: 500, status: 'active',
  }).select('id, status').single()
  if (error || (l as any)?.status !== 'active') throw new Error(`listing insert: ${error?.message ?? (l as any)?.status}`)
  return (l as any).id as string
}

describe.skipIf(!hasEnv)('checkout B4 — EU Payssion methods (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    process.env.CHECKOUT_MAX_OPEN_PENDING_ORDERS = '500'
    fx = await makeFixture()
    sessionClient = fx.buyer.client
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    listingId = await insertListing(PRICE)
    cheapListingId = await insertListing(CHEAP)
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
    await parkPendingOrders().catch(() => undefined)
    const { data: allOrders } = await svc.from('orders').select('id').or(`buyer_id.in.(${users.join(',')}),seller_id.in.(${users.join(',')})`)
    for (const o of (allOrders ?? []) as any[]) {
      await del(`ledger_test_cleanup_by_order(${o.id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: o.id } as any))
      await del('notifications(by link)', svc.from('notifications').delete().like('link', `%${o.id}%`))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `%${o.id}%`))
      await del('provider_cancel_outbox', svc.from('provider_cancel_outbox').delete().eq('order_id', o.id))
      await del('payment_attempts', svc.from('payment_attempts').delete().eq('order_id', o.id))
    }
    await del('ledger_test_cleanup(fund)', svc.rpc('ledger_test_cleanup', { p_prefix: 'test:ledger:b4:%' } as any))
    if (TARGET_IS_LOCAL) {
      try {
        execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c',
          `BEGIN; ALTER TABLE public.audit_logs DISABLE TRIGGER trg_prevent_audit_log_delete; ` +
          `DELETE FROM public.audit_logs WHERE user_id IN ('${users.join("','")}'); ` +
          `ALTER TABLE public.audit_logs ENABLE TRIGGER trg_prevent_audit_log_delete; COMMIT;`], { stdio: 'pipe' })
      } catch (e: any) { failures.push(`audit_logs purge: ${e?.stderr?.toString() ?? e}`) }
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    for (const lid of [listingId, cheapListingId]) if (lid) await del('listing', svc.from('listings').delete().eq('id', lid))
    if (failures.length) throw new Error(`eu-payment-methods cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  it('the fee-row keys match the probed pm_ids: bancomatpay_it present, bancomat_it gone, all eight selectable', async () => {
    const { data } = await fx!.svc.from('payment_method_fees').select('method, selectable, min_fee_minor, min_total_minor, refundable, max_total_minor')
    const rows = Object.fromEntries((data as any[]).map((r) => [r.method, r]))
    expect(rows.bancomat_it).toBeUndefined()
    for (const pm of EU) expect(rows[pm]?.selectable, pm).toBe(true)
    // The B3 "€1 min" misread is gone: EPS / MB Way carry a minimum CHARGE, not a minimum fee.
    for (const pm of ['eps_at', 'mbway_pt']) {
      expect(Number(rows[pm].min_fee_minor)).toBe(0)
      expect(Number(rows[pm].min_total_minor)).toBe(100)
    }
    expect(rows.paysafecard.refundable).toBe(false)
    expect(Number(rows.paysafecard.max_total_minor)).toBe(25000)
  })

  it('eligibleMethods offers every EU method for a $19.99 order, with a quote, pinned to its country list', async () => {
    const { PAYSSION_METHODS } = await import('@/lib/payments/providers/payssion/methods')
    const { methods, refused } = await eligible()
    for (const pm of EU) {
      const m = methods.find((x) => x.method === pm)
      expect(m, `${pm} offered (refused: ${JSON.stringify(refused)})`).toBeTruthy()
      expect(m!.provider).toBe('payssion')
      expect(m!.pmId).toBe(pm)
      expect(m!.quote.feeMinor).toBeGreaterThan(0)
      expect(m!.quote.totalMinor).toBe(cents(PRICE) + m!.quote.feeMinor)
      expect(m!.countries).toEqual(PAYSSION_METHODS[pm].countries)
    }
    expect(methods.find((x) => x.method === 'paysafecard')!.refundable).toBe(false)
  })

  it('every EU method: the order createCheckout writes snapshots exactly the eligibleMethods quote', async () => {
    const { methods } = await eligible()
    for (const pm of EU) {
      await parkPendingOrders()
      const m = methods.find((x) => x.method === pm)!
      const r = await checkout({ paymentMethodId: pm })
      expect(r.success, `${pm}: ${r.error}`).toBe(true)
      const o = await orderRow(r.orderId!)
      expect(o.buyer_fee_method).toBe(pm)
      expect(cents(Number(o.buyer_fee_amount))).toBe(m.quote.feeMinor)
      expect(Number(o.buyer_fee_pct)).toBe(m.quote.pctEffective)
      expect(cents(Number(o.total_amount))).toBe(cents(Number(o.subtotal)) + cents(Number(o.platform_fee)) + m.quote.feeMinor)
      const { data: att } = await fx!.svc.from('payment_attempts').select('provider, pm_id, amount_minor, currency').eq('order_id', r.orderId!).single()
      expect((att as any).provider).toBe('payssion')
      expect((att as any).pm_id).toBe(pm)
      expect((att as any).currency).toBe('USD') // charged in USD; Payssion converts on its page
      expect(Number((att as any).amount_minor)).toBe(cents(Number(o.total_amount)))
    }
    await parkPendingOrders()
  })

  it('EPS / MB Way under €1.00 (+5% headroom): the quote refuses under_min, the tile is not offered, createCheckout refuses with the reason', async () => {
    for (const pm of ['eps_at', 'mbway_pt']) {
      const q = await quote(pm, cents(CHEAP))
      expect(q.ok, pm).toBe(false)
      expect(q.reason, pm).toBe('under_min')
    }
    // Threshold: subtotal + fee ≥ €1.00 × 1.05 × 1.17 = $1.2285.
    // EPS  (3.75% + €0.45, buffer 1%): $0.60 → (60 + 52.65) / 0.9525 = 118.3¢ refused; $0.70 → 128.8¢ quotes.
    // MB Way (2.75% + €0.25, buffer 1%): $0.85 → (85 + 29.25) / 0.9625 = 118.7¢ refused; $0.95 → 129.1¢ quotes.
    expect((await quote('eps_at', 60)).reason).toBe('under_min')
    expect((await quote('eps_at', 70)).ok).toBe(true)
    expect((await quote('mbway_pt', 85)).reason).toBe('under_min')
    expect((await quote('mbway_pt', 95)).ok).toBe(true)
    const { methods, refused } = await eligible(cents(CHEAP))
    expect(methods.map((m) => m.method)).not.toContain('eps_at')
    expect(refused.find((r) => r.method === 'eps_at')?.reason).toBe('under_min')
    // Trustly has no minimum: still offered at $0.99.
    expect(methods.map((m) => m.method)).toContain('trustly')

    const { createCheckout } = await import('@/lib/actions/checkout')
    const before = await pendingOrders(cheapListingId)
    const r = await createCheckout({ listingId: cheapListingId, quantity: 1, paymentMethodId: 'eps_at' })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/under the minimum amount for EPS/)
    expect((await pendingOrders(cheapListingId)).length).toBe(before.length)
  })

  it('order_create_pending re-checks the ACTUAL charge: wallet credit that pulls an EPS charge under €1.00 rolls the order back — no order, no wallet debit, no attempt', async () => {
    await parkPendingOrders()
    // $19.99 EPS quotes (≈ $22.2 total); apply wallet credit so the provider
    // charge left is ~$0.50 — under the minimum. The page-side quote says ok
    // (it sees the subtotal), the RPC must refuse on the charge.
    // Wallet credit one cent short of covering the order at the WALLET row's
    // quote (so createCheckout keeps the picked method), which leaves the EPS
    // charge = epsFee − walletFee + 1 ≈ 56¢ ≈ €0.48 — under the minimum.
    const { methods } = await eligible()
    const eps = methods.find((m) => m.method === 'eps_at')!
    const wallet = methods.find((m) => m.kind === 'wallet')!
    const marketplaceMinor = cents(PRICE * 0.02) // BUYER_MARKETPLACE_FEE_PCT
    const walletApply = cents(PRICE) + marketplaceMinor + wallet.quote.feeMinor - 1
    const epsChargeLeft = cents(PRICE) + marketplaceMinor + eps.quote.feeMinor - walletApply
    expect(epsChargeLeft).toBeLessThan(123) // < €1.05 at 1.17
    await fundWallet(fx!.buyer.id, BigInt(walletApply))
    const walletBefore = await walletMinor(fx!.buyer.id)
    const ordersBefore = (await pendingOrders()).length
    const r = await checkout({ paymentMethodId: 'eps_at', walletAmount: walletApply / 100 })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/under the minimum amount for EPS/)
    expect((await pendingOrders()).length).toBe(ordersBefore)
    expect(await walletMinor(fx!.buyer.id)).toBe(walletBefore)
    // Same order on Trustly (no minimum) goes through with the wallet applied.
    const ok = await checkout({ paymentMethodId: 'trustly', walletAmount: walletApply / 100 })
    expect(ok.success, ok.error).toBe(true)
    const { data: att } = await fx!.svc.from('payment_attempts').select('amount_minor, wallet_minor').eq('order_id', ok.orderId!).single()
    expect(Number((att as any).wallet_minor)).toBeGreaterThan(0)
    await parkPendingOrders()
  })

  itFault('an in-RPC fault at the new minimum check leaves no order, no wallet hold and no attempt', async () => {
    await parkPendingOrders()
    const { data: listing } = await fx!.svc.from('listings').select('seller_id, price').eq('id', listingId).single()
    const { count: ordersBefore } = await fx!.svc.from('orders').select('id', { count: 'exact' }).eq('buyer_id', fx!.buyer.id).limit(1)
    const { count: attemptsBefore } = await fx!.svc.from('payment_attempts').select('id', { count: 'exact' }).limit(1)
    const err = withFault('order_create_pending:after_min_check', `SELECT order_create_pending(
      '${fx!.buyer.id}'::uuid, '${(listing as any).seller_id}'::uuid, '${listingId}'::uuid, 1,
      ${PRICE}, ${PRICE}, 2, ${(PRICE * 0.02).toFixed(2)}, ${(PRICE * 0.9).toFixed(2)}, 10, '{}'::jsonb,
      'USD', NULL, 0, 0, 'payssion', 'eps_at', now() + interval '30 min', 'eps_at')`)
    expect(err).toMatch(/money_fault_hook|order_create_pending:after_min_check/)
    const { count: ordersAfter } = await fx!.svc.from('orders').select('id', { count: 'exact' }).eq('buyer_id', fx!.buyer.id).limit(1)
    const { count: attemptsAfter } = await fx!.svc.from('payment_attempts').select('id', { count: 'exact' }).limit(1)
    expect(ordersAfter).toBe(ordersBefore)
    expect(attemptsAfter).toBe(attemptsBefore)
  })

  // ── paysafecard: refunds are wallet credit, and that is true for every method ──
  it('no app code calls a provider refund(); paysafecard (refundable=false) is promised "Store credit only" on /fees', () => {
    const files = ['src/lib/payments/dispatch.ts', 'src/lib/actions/orders.ts', 'src/lib/actions/admin-disputes.ts', 'src/lib/wallet/order-money.ts']
    for (const f of files) expect(read(f), `${f} must not call provider.refund()`).not.toMatch(/\.refund\(/)
    const rates = read('src/lib/fees/buyer-public-rates.ts')
    expect(rates).toMatch(/r\.refundable \? 'Yes' : 'Store credit only'/)
    // The checkout tile tells a paysafecard buyer the same thing.
    expect(read('src/app/checkout/[id]/CheckoutForm.tsx')).toMatch(/paysafecard: \{[\s\S]*?Refunds go to your DropMarket wallet/)
  })
})
