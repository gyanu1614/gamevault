/**
 * Checkout B3 Parts 2–4 — ONE eligibility source, quote parity, refusals
 * (docs/handoff/checkout-b3.md).
 *
 * Drives the REAL createCheckout (buyer session through PostgREST, service
 * role for the RPC — the production path) against the local stack, the same
 * harness as checkout-fix-b.guard:
 *
 *   · PARITY: for EVERY selectable registry method (+ the crypto row + wallet)
 *     the order createCheckout writes carries exactly the quote
 *     eligibleMethods() gave for that method — fee, pct, method — and
 *     total_amount == subtotal + platform_fee + buyer_fee − promo to the cent;
 *     the attempt charges total − wallet. The page reads the same function
 *     (static check below), so page == eligibleMethods == order snapshot.
 *   · three currencies: the quote seam answers USD / EUR / GBP for the rows
 *     that accept them (orders stay USD — the ledger base).
 *   · cap refusal: a method over its provider cap is neither offered nor
 *     accepted; hidden (selectable=false) likewise; a missing row fails the
 *     checkout closed — no order, no wallet debit, never a TS default.
 *   · wallet: a fully wallet-paid order snapshots the 'wallet' row's quote.
 *   · an in-RPC fault right after the quote leaves nothing behind.
 *   · registry invariant: every method the registry can offer has a fee row.
 *
 * Every row this file causes is removed in afterAll (orders, attempts, ledger
 * journals under the fixture's users, notifications, audit_logs on the local
 * stack, the fixture users); seed rows it edits are restored.
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
/** Every provider name → the fake adapter, keeping the NAME the checkout picked. */
vi.mock('@/lib/payments/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/payments/registry')>()
  const { fakeProvider } = await import('@/lib/payments/providers/fake')
  return { ...real, getProvider: (name: string) => ({ ...fakeProvider, name }) }
})

let fx: Fixture | null = null
const CUR = 'USD'
const PRICE = 19.99 // own listing (a price UPDATE on the fixture's re-triggers listing moderation)
let listingId = ''
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itFault = it.skipIf(!TARGET_IS_LOCAL)
const tag = () => Math.random().toString(36).slice(2, 8)
const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

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
async function attempts(orderId: string) {
  const { data } = await fx!.svc.from('payment_attempts').select('*').eq('order_id', orderId)
  return (data ?? []) as any[]
}
async function pendingOrders() {
  const { data } = await fx!.svc.from('orders').select('id').eq('buyer_id', fx!.buyer.id).eq('listing_id', listingId).eq('status', 'pending')
  return (data ?? []) as any[]
}
async function parkPendingOrders() {
  const { cancelOrderReturnWallet } = await import('@/lib/wallet/order-money')
  for (const o of await pendingOrders()) await cancelOrderReturnWallet(o.id, 'test-reset')
}
async function walletMinor(userId: string): Promise<bigint> {
  const { data, error } = await fx!.svc.rpc('user_wallet_balance', { p_user_id: userId, p_currency: CUR } as any)
  if (error) throw new Error(`user_wallet_balance: ${error.message}`)
  return BigInt(data ?? 0)
}
async function fundWallet(userId: string, minor: bigint) {
  const { error } = await fx!.svc.rpc('wallet_credit', {
    p_user_id: userId, p_amount_minor: minor.toString(), p_currency: CUR, p_counterparty: 'refunds',
    p_idempotency_key: `test:ledger:b3:fund:${tag()}`, p_event_ref: 'TEST_FUND', p_order_id: null,
  } as any)
  if (error) throw new Error(`wallet_credit: ${error.message}`)
}
async function setFeeRow(method: string, patch: Record<string, unknown>) {
  const { error } = await fx!.svc.from('payment_method_fees').update(patch as any).eq('method', method)
  if (error) throw new Error(`payment_method_fees(${method}): ${error.message}`)
}
async function eligible(over: Partial<{ buyerId: string | null; currency: string; country: string | null; subtotalMinor: bigint }> = {}) {
  const { eligibleMethods } = await import('@/lib/payments/eligibility')
  return eligibleMethods({ buyerId: fx!.buyer.id, currency: CUR, country: null, subtotalMinor: BigInt(Math.round(PRICE * 100)), ...over })
}
const cents = (n: number) => Math.round(n * 100)

describe.skipIf(!hasEnv)('checkout B3 — buyer method fees (integration)', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_PURCHASES_ENABLED = 'true'
    process.env.PAYMENT_PROVIDER = 'fake'
    process.env.CHECKOUT_MAX_OPEN_PENDING_ORDERS = '500'
    fx = await makeFixture()
    sessionClient = fx.buyer.client
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    const { data: base } = await fx.svc.from('listings').select('game_id, game_category_id').eq('id', fx.listingId).single()
    const { data: l, error: lErr } = await fx.svc.from('listings').insert({
      seller_id: fx.seller.id, game_id: (base as any).game_id, game_category_id: (base as any).game_category_id,
      title: `GUARD-TEST-b3-${tag()}`, description: 'buyer method fee throwaway', price: PRICE, quantity: 500, status: 'active',
    }).select('id, status').single()
    if (lErr || (l as any)?.status !== 'active') throw new Error(`listing insert: ${lErr?.message ?? (l as any)?.status}`)
    listingId = (l as any).id
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
    await del('restore qris_id', svc.from('payment_method_fees').update({ max_total_minor: null } as any).eq('method', 'qris_id'))
    await del('restore fake', svc.from('payment_method_fees').update({ selectable: true } as any).eq('method', 'fake'))
    const { data: allOrders } = await svc.from('orders').select('id').or(`buyer_id.in.(${users.join(',')}),seller_id.in.(${users.join(',')})`)
    for (const o of (allOrders ?? []) as any[]) {
      await del(`ledger_test_cleanup_by_order(${o.id})`, svc.rpc('ledger_test_cleanup_by_order', { p_order_id: o.id } as any))
      await del('notifications(by link)', svc.from('notifications').delete().like('link', `%${o.id}%`))
      await del('webhook_events', svc.from('webhook_events').delete().eq('provider', 'fake').like('provider_event_id', `%${o.id}%`))
      await del('provider_cancel_outbox', svc.from('provider_cancel_outbox').delete().eq('order_id', o.id))
      await del('payment_attempts', svc.from('payment_attempts').delete().eq('order_id', o.id))
    }
    await del('ledger_test_cleanup(fund)', svc.rpc('ledger_test_cleanup', { p_prefix: 'test:ledger:b3:%' } as any))
    if (TARGET_IS_LOCAL) {
      try {
        execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c',
          `BEGIN; ALTER TABLE public.audit_logs DISABLE TRIGGER trg_prevent_audit_log_delete; ` +
          `DELETE FROM public.audit_logs WHERE user_id IN ('${users.join("','")}'); ` +
          `ALTER TABLE public.audit_logs ENABLE TRIGGER trg_prevent_audit_log_delete; COMMIT;`], { stdio: 'pipe' })
      } catch (e: any) { failures.push(`audit_logs purge: ${e?.stderr?.toString() ?? e}`) }
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    // after the fixture's orders are gone (cleanup deletes the users' orders first)
    if (listingId) await del('listing', svc.from('listings').delete().eq('id', listingId))
    if (failures.length) throw new Error(`buyer-method-fees cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  // ── Part 3: one eligibility source ─────────────────────────────────────────
  it('eligibleMethods offers the crypto row (active provider), every selectable local method and wallet — with a quote each; hidden rows are refused by reason', async () => {
    const { methods, refused } = await eligible()
    const crypto = methods.find((m) => m.kind === 'crypto')
    expect(crypto?.method).toBe('fake')
    expect(crypto?.quote.feeMinor).toBe(100) // 5% floor on 19.99 → 99.95 → 100
    expect(methods.find((m) => m.kind === 'wallet')?.method).toBe('wallet')
    const locals = methods.filter((m) => m.kind === 'local').map((m) => m.method)
    expect(locals).toEqual(expect.arrayContaining(['pix_br', 'gcash_ph', 'qr_ph', 'qris_id', 'spei_mx', 'pse_co', 'webpay_cl']))
    expect(locals).not.toContain('maya_ph')
    expect(locals).not.toContain('oxxo_mx')
    expect(locals).not.toContain('boleto_br')
    expect(refused.map((r) => [r.method, r.reason])).toEqual(expect.arrayContaining([['maya_ph', 'not_selectable'], ['oxxo_mx', 'not_selectable'], ['boleto_br', 'not_selectable']]))
    for (const m of methods) {
      expect(m.quote.feeMinor).toBeGreaterThan(0)
      expect(m.quote.totalMinor).toBe(cents(PRICE) + m.quote.feeMinor)
    }
  })

  it('no wallet row is offered to a signed-out visitor; the country only orders the list (countryMatch), never hides a method', async () => {
    const out = await eligible({ buyerId: null, country: 'PH' })
    expect(out.methods.some((m) => m.kind === 'wallet')).toBe(false)
    const ph = out.methods.filter((m) => m.kind === 'local' && m.countryMatch).map((m) => m.method)
    expect(ph.sort()).toEqual(['gcash_ph', 'qr_ph'])
    expect(out.methods.some((m) => m.method === 'pix_br' && !m.countryMatch)).toBe(true)
  })

  it('the quote seam answers three currencies for the rows that accept them (crypto: USD / EUR / GBP)', async () => {
    for (const currency of ['USD', 'EUR', 'GBP']) {
      const { methods } = await eligible({ currency, subtotalMinor: 10000n })
      const crypto = methods.find((m) => m.kind === 'crypto')
      expect(crypto?.quote.feeMinor, currency).toBe(500)
      // LATAM/PH rails are USD-only → refused in EUR/GBP, offered in USD
      const pix = methods.find((m) => m.method === 'pix_br')
      if (currency === 'USD') expect(pix?.quote.feeMinor).toBe(1396) // 10000/0.8775 − 10000 = 1396.01
      else expect(pix).toBeUndefined()
    }
  })

  // ── Part 2 + 3: parity page == eligibleMethods == order snapshot ───────────
  it('every selectable method: the order snapshot equals the eligibleMethods quote, total to the cent, attempt = total − wallet', async () => {
    const { methods } = await eligible()
    const candidates = methods.filter((m) => m.kind !== 'wallet')
    expect(candidates.length).toBeGreaterThanOrEqual(8)
    for (const m of candidates) {
      await parkPendingOrders()
      const r = await checkout({ paymentMethodId: m.kind === 'local' ? m.pmId : undefined })
      expect(r.success, `${m.method}: ${r.error}`).toBe(true)
      const o = await orderRow(r.orderId!)
      expect(o.buyer_fee_method, m.method).toBe(m.method)
      expect(cents(Number(o.buyer_fee_amount)), m.method).toBe(m.quote.feeMinor)
      expect(Number(o.buyer_fee_pct), m.method).toBe(m.quote.pctEffective)
      // mirror columns the display surfaces read
      expect(cents(Number(o.payment_processing_fee))).toBe(m.quote.feeMinor)
      expect(Number(o.payment_processing_fee_rate)).toBe(m.quote.pctEffective)
      // fee-row totals: subtotal + marketplace + method fee − promo
      expect(cents(Number(o.total_amount))).toBe(cents(Number(o.subtotal)) + cents(Number(o.platform_fee)) + m.quote.feeMinor - cents(Number(o.promo_discount)))
      const [a] = await attempts(r.orderId!)
      expect(a.provider).toBe(m.provider)
      expect(a.pm_id).toBe(m.pmId)
      expect(Number(a.amount_minor)).toBe(cents(Number(o.total_amount)))
    }
  }, 120_000)

  it('a fully wallet-paid order snapshots the wallet row and mints no attempt', async () => {
    await parkPendingOrders()
    const { methods } = await eligible()
    const wallet = methods.find((m) => m.kind === 'wallet')!
    const total = cents(PRICE) + cents(PRICE * 0.02) + wallet.quote.feeMinor
    await fundWallet(fx!.buyer.id, BigInt(total))
    const r = await checkout({ walletAmount: total / 100 })
    expect(r.success, r.error).toBe(true)
    expect(r.fullyPaidByWallet).toBe(true)
    const o = await orderRow(r.orderId!)
    expect(o.buyer_fee_method).toBe('wallet')
    expect(cents(Number(o.buyer_fee_amount))).toBe(wallet.quote.feeMinor)
    expect(cents(Number(o.total_amount))).toBe(total)
    expect(o.status).toBe('paid')
    expect((await attempts(r.orderId!)).length).toBe(0)
  }, 60_000)

  // ── refusals: page and createCheckout agree ────────────────────────────────
  it('a hidden method (selectable=false) is refused by createCheckout — no order, no wallet debit', async () => {
    await parkPendingOrders()
    const before = await walletMinor(fx!.buyer.id)
    const r = await checkout({ paymentMethodId: 'maya_ph', walletAmount: 1 })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/isn’t available/)
    expect(await pendingOrders()).toEqual([])
    expect(await walletMinor(fx!.buyer.id)).toBe(before)
  })

  it('a method over its provider cap disappears from eligibleMethods and is refused by createCheckout with the cap reason', async () => {
    await parkPendingOrders()
    await setFeeRow('qris_id', { max_total_minor: 1000 }) // $10 cap, order is $19.99+
    try {
      const { methods, refused } = await eligible()
      expect(methods.some((m) => m.method === 'qris_id')).toBe(false)
      expect(refused).toContainEqual(expect.objectContaining({ method: 'qris_id', reason: 'over_cap' }))
      const r = await checkout({ paymentMethodId: 'qris_id' })
      expect(r.success).toBe(false)
      expect(r.error).toMatch(/limit/i)
      expect(await pendingOrders()).toEqual([])
    } finally {
      await setFeeRow('qris_id', { max_total_minor: null })
    }
  })

  it('the checkout fails CLOSED when the active provider has no usable fee row — never a TypeScript default fee', async () => {
    await parkPendingOrders()
    await setFeeRow('fake', { selectable: false })
    try {
      const { methods } = await eligible()
      expect(methods.some((m) => m.kind === 'crypto')).toBe(false)
      const r = await checkout({})
      expect(r.success).toBe(false)
      expect(await pendingOrders()).toEqual([])
    } finally {
      await setFeeRow('fake', { selectable: true })
    }
  })

  itFault('an in-RPC fault right after the quote leaves no order behind', async () => {
    await parkPendingOrders()
    const err = withFault('order_create_pending:after_quote', `SELECT public.order_create_pending(
      '${fx!.buyer.id}'::uuid, '${fx!.seller.id}'::uuid, '${listingId}'::uuid, 1,
      ${PRICE}, ${PRICE}, 2, 0.40, ${PRICE}, 0, '{}'::jsonb, 'USD', NULL, 0, 0, 'fake', NULL, now() + interval '30 minutes', 'fake')`)
    expect(err).toMatch(/injected fault at order_create_pending:after_quote/)
    expect(await pendingOrders()).toEqual([])
  })

  itFault('the RPC itself refuses an unknown method before writing anything', async () => {
    await parkPendingOrders()
    const err = withFault('none', `SELECT public.order_create_pending(
      '${fx!.buyer.id}'::uuid, '${fx!.seller.id}'::uuid, '${listingId}'::uuid, 1,
      ${PRICE}, ${PRICE}, 2, 0.40, ${PRICE}, 0, '{}'::jsonb, 'USD', NULL, 0, 0, 'fake', NULL, now() + interval '30 minutes', 'no_such_method')`)
    expect(err).toMatch(/buyer_fee_quote: no_fee_row/)
    expect(await pendingOrders()).toEqual([])
  })

  it('the buyer cannot rewrite the quoted fee on their own order (guarded columns → 42501)', async () => {
    await parkPendingOrders()
    const r = await checkout({})
    expect(r.success, r.error).toBe(true)
    for (const patch of [{ buyer_fee_amount: 0 }, { buyer_fee_pct: 0 }, { buyer_fee_method: 'wallet' }]) {
      const res = await fx!.buyer.client.from('orders').update(patch as any).eq('id', r.orderId!)
      expect(res.error?.code, JSON.stringify(patch)).toBe('42501')
    }
  })

  // ── registry invariant ─────────────────────────────────────────────────────
  it('every method the registry can offer has a payment_method_fees row', async () => {
    const { registeredProviders } = await import('@/lib/payments/registry')
    const { PAYSSION_METHODS } = await import('@/lib/payments/providers/payssion/methods')
    const expected = [...registeredProviders().filter((p) => p !== 'payssion'), ...Object.keys(PAYSSION_METHODS), 'wallet']
    const { data, error } = await fx!.svc.from('payment_method_fees').select('method')
    expect(error).toBeNull()
    const have = new Set((data as any[]).map((r) => r.method))
    const missing = expected.filter((m) => !have.has(m))
    expect(missing, 'registry methods without a fee row').toEqual([])
  })

  // ── Part 4 static: the page and the form read the one source ───────────────
  it('the checkout page reads eligibleMethods and the form never computes or imports a processing fee', () => {
    const page = read('src/app/checkout/[id]/page.tsx')
    expect(page).toMatch(/eligibleMethods\(/)
    const form = read('src/app/checkout/[id]/CheckoutForm.tsx')
    expect(form).not.toMatch(/payssionSelectorMethods/)
    expect(form).not.toMatch(/BUYER_PROCESSING_FEE_PCT|processingPct|processingAmount/)
    const fees = read('src/lib/fees/index.ts')
    expect(fees).not.toMatch(/BUYER_PROCESSING_FEE_PCT|BUYER_FEE_USE_PSP_MAX/)
    const methods = read('src/lib/payments/providers/payssion/methods.ts')
    expect(methods, 'PAY-023: no fee number ships in the client-reachable registry').not.toMatch(/feePercent/)
  })
})
