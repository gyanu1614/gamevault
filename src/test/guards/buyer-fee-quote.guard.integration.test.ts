/**
 * Checkout B3 Part 1/2 — buyer method fees are DATA, quoted by ONE SQL
 * function (docs/handoff/checkout-b3.md).
 *
 *   payment_method_fees  one row per registry method (+ the EU rows pre-seeded
 *                        from the Payssion rate sheet, inert until the registry
 *                        carries them); admin-editable, audited.
 *   currency_rates       usd_per_unit for every currency a fee row prices in.
 *   buyer_fee_quote(method, subtotal_minor, currency) → jsonb
 *       provider charges its % on the TOTAL the buyer pays, so
 *         gross = (subtotal + fixed) / (1 − provider_pct − fx_markup − buffer)
 *         fee   = max(floor_pct × subtotal, gross − subtotal), then min_fee,
 *                 refused above max_total (the provider cap, in fee_currency).
 *       Rounded ONCE, through fee_round_cents (fee PR 7's one rounding helper;
 *       half away from zero, the rule order_create_pending uses everywhere).
 *
 * Every number below is a hand-computed worked example against the seeded
 * rows — if a seed value or the formula drifts, this fails with the figure.
 * Service-role only: the browser never quotes; eligibleMethods (server) does.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { ANON, URL, hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
const anon = () => createClient(URL!, ANON!)

type Quote = {
  ok: boolean
  reason: string | null
  method: string
  fee_minor: number | null
  total_minor: number | null
  pct_effective: number | null
  fee_currency: string | null
  refundable: boolean | null
  instant_clearing: boolean | null
}

async function quote(method: string, subtotalMinor: number, currency = 'USD'): Promise<Quote> {
  const { data, error } = await fx!.svc.rpc('buyer_fee_quote', {
    p_method: method, p_subtotal_minor: subtotalMinor, p_currency: currency,
  } as any)
  if (error) throw new Error(`buyer_fee_quote(${method}): ${error.message}`)
  return data as Quote
}

describe.skipIf(!hasEnv)('buyer_fee_quote — method fees as data (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 90_000)
  afterAll(async () => {
    await fx?.svc.from('payment_method_fees').delete().like('method', 'guardtest_%')
    await fx?.cleanup()
  }, 60_000)

  // ── worked examples ────────────────────────────────────────────────────────
  it('Pix $20: 3.75% + 7.5% FX + 1% buffer grossed up on the total → $2.79 (13.95%)', async () => {
    const q = await quote('pix_br', 2000)
    expect(q.ok).toBe(true)
    // 2000 / (1 − 0.0375 − 0.075 − 0.01) = 2279.20 → fee 279 > floor 100 > min 35
    expect(q.fee_minor).toBe(279)
    expect(q.total_minor).toBe(2279)
    expect(q.pct_effective).toBe(13.95)
    expect(q.fee_currency).toBe('USD')
    expect(q.refundable).toBe(true)
  })

  it('GCash $20: 10 PHP fixed converted through currency_rates before the gross-up → $2.27', async () => {
    const q = await quote('gcash_ph', 2000)
    expect(q.ok).toBe(true)
    // fixed 10 PHP × 0.0176 = 17.6¢; (2000 + 17.6) / (1 − 0.05 − 0.034 − 0.01) = 2226.93
    expect(q.fee_minor).toBe(227)
    expect(q.total_minor).toBe(2227)
    expect(q.pct_effective).toBe(11.35)
  })

  it('Pix $1: the $0.35 minimum wins over both the gross-up (14¢) and the 5% floor (5¢)', async () => {
    const q = await quote('pix_br', 100)
    expect(q.ok).toBe(true)
    expect(q.fee_minor).toBe(35)
    expect(q.total_minor).toBe(135)
    expect(q.pct_effective).toBe(35)
  })

  it('crypto (btcpay) keeps today’s buyer fee: the 5% floor, no provider %, no FX', async () => {
    const q = await quote('btcpay', 10000)
    expect(q.ok).toBe(true)
    // 10000 / 0.99 = 10101.01 → 101 < floor 500
    expect(q.fee_minor).toBe(500)
    expect(q.total_minor).toBe(10500)
    expect(q.pct_effective).toBe(5)
  })

  it('wallet quotes like crypto (today’s 5%), so a fully wallet-paid order snapshots the same fee', async () => {
    const q = await quote('wallet', 10000)
    expect(q.ok).toBe(true)
    expect(q.fee_minor).toBe(500)
  })

  it('QR Ph is quoted with refundable=false and Maya (hidden) is refused as not_selectable', async () => {
    const qr = await quote('qr_ph', 2000)
    expect(qr.ok).toBe(true)
    expect(qr.refundable).toBe(false)
    const maya = await quote('maya_ph', 2000)
    expect(maya.ok).toBe(false)
    expect(maya.reason).toBe('not_selectable')
    expect(maya.fee_minor).toBeNull()
  })

  // ── refusals ───────────────────────────────────────────────────────────────
  it('an unknown method is refused: no_fee_row (fail closed, never a default fee)', async () => {
    const q = await quote('does_not_exist', 2000)
    expect(q.ok).toBe(false)
    expect(q.reason).toBe('no_fee_row')
    expect(q.fee_minor).toBeNull()
    expect(q.total_minor).toBeNull()
  })

  it('a method that does not accept the order currency is refused: currency_unsupported', async () => {
    const q = await quote('pix_br', 2000, 'EUR')
    expect(q.ok).toBe(false)
    expect(q.reason).toBe('currency_unsupported')
  })

  it('paysafecard above its €250 provider cap is refused: over_cap; below it quotes', async () => {
    // $300 / 0.865 = $346.82 = €296.43 > €250
    const over = await quote('paysafecard', 30000)
    expect(over.ok).toBe(false)
    expect(over.reason).toBe('over_cap')
    // $200 / 0.865 = $231.21 = €197.62 < €250 → fee 3121
    const under = await quote('paysafecard', 20000)
    expect(under.ok).toBe(true)
    expect(under.fee_minor).toBe(3121)
    expect(under.refundable).toBe(false)
  })

  it('a quote currency with no rate is refused: fx_rate_missing (fee_currency itself is FK-bound to currency_rates)', async () => {
    const bad = await fx!.svc.from('payment_method_fees').insert({
      method: 'guardtest_jpy', label: 'Guard JPY', provider: 'payssion', fee_currency: 'JPY',
      provider_pct: 1, provider_fixed_minor: 100, currencies: ['USD'],
    } as any)
    expect(bad.error?.code).toBe('23503')
    const { error } = await fx!.svc.from('payment_method_fees').insert({
      method: 'guardtest_chf', label: 'Guard CHF', provider: 'payssion', fee_currency: 'USD',
      provider_pct: 1, provider_fixed_minor: 100, currencies: ['USD', 'CHF'],
    } as any)
    expect(error).toBeNull()
    const q = await quote('guardtest_chf', 2000, 'CHF')
    expect(q.ok).toBe(false)
    expect(q.reason).toBe('fx_rate_missing')
  })

  // ── three currencies ───────────────────────────────────────────────────────
  it('Trustly €0.35 fixed converts into the quote currency: EUR 109, GBP 104, USD 115 on 20.00', async () => {
    // EUR: (2000 + 35) / 0.965 = 2108.81 → 109
    expect((await quote('trustly', 2000, 'EUR')).fee_minor).toBe(109)
    // GBP: 35 × 1.17 / 1.35 = 30.33; (2000 + 30.33) / 0.965 = 2103.97 → 104
    expect((await quote('trustly', 2000, 'GBP')).fee_minor).toBe(104)
    // USD: 35 × 1.17 = 40.95; (2000 + 40.95) / 0.965 = 2114.97 → 115
    expect((await quote('trustly', 2000, 'USD')).fee_minor).toBe(115)
  })

  it('a zero subtotal yields the minimum/fixed only and no effective percentage', async () => {
    const q = await quote('pix_br', 0)
    expect(q.ok).toBe(true)
    expect(q.fee_minor).toBe(35)
    expect(q.pct_effective).toBeNull()
  })

  // ── rounding + batch ───────────────────────────────────────────────────────
  it('the fee is rounded once, through fee_round_cents (the one SQL rounding helper), half away from zero', async () => {
    for (const [input, expected] of [['0.015', 0.02], ['0.025', 0.03], ['0.014999', 0.01], ['0.005', 0.01], ['2.792023', 2.79]] as const) {
      const { data, error } = await fx!.svc.rpc('fee_round_cents', { p_amount: input } as any)
      expect(error).toBeNull()
      expect(Number(data)).toBe(expected)
    }
    // no second helper: money_round_minor must not exist
    const gone = await fx!.svc.rpc('money_round_minor' as never, { p_amount: '1.5' } as never)
    expect(gone.error?.code).toBe('PGRST202')
  })

  it('buyer_fee_quote_many returns one quote per requested method, refusals included, in order', async () => {
    const { data, error } = await fx!.svc.rpc('buyer_fee_quote_many', {
      p_methods: ['pix_br', 'maya_ph', 'nope'], p_subtotal_minor: 2000, p_currency: 'USD',
    } as any)
    expect(error).toBeNull()
    const rows = data as Quote[]
    expect(rows.map((r) => r.method)).toEqual(['pix_br', 'maya_ph', 'nope'])
    expect(rows.map((r) => r.ok)).toEqual([true, false, false])
    expect(rows[0].fee_minor).toBe(279)
  })

  // ── posture ────────────────────────────────────────────────────────────────
  it('the quote functions are service-role only (42501 for anon and a signed-in buyer)', async () => {
    for (const client of [anon(), fx!.buyer.client]) {
      for (const fn of ['buyer_fee_quote', 'buyer_fee_quote_many'] as const) {
        const args = fn === 'buyer_fee_quote'
          ? { p_method: 'pix_br', p_subtotal_minor: 100, p_currency: 'USD' }
          : { p_methods: ['pix_br'], p_subtotal_minor: 100, p_currency: 'USD' }
        const res = await client.rpc(fn, args as any)
        expect(res.error?.code, `${fn} must be revoked`).toBe('42501')
      }
    }
  })

  it('the fee tables are readable by anyone (public fee information) but writable by nobody but the service role', async () => {
    const read = await anon().from('payment_method_fees').select('method').eq('method', 'pix_br').maybeSingle()
    expect(read.error).toBeNull()
    expect(read.data).toEqual({ method: 'pix_br' })
    const rates = await anon().from('currency_rates').select('currency').eq('currency', 'PHP').maybeSingle()
    expect(rates.error).toBeNull()
    for (const client of [anon(), fx!.buyer.client]) {
      const w = await client.from('payment_method_fees').update({ provider_pct: 0 } as any).eq('method', 'pix_br').select('method')
      // RLS: no write policy → zero rows touched (PostgREST answers 200 with [])
      expect(w.data ?? []).toEqual([])
      const r = await client.from('currency_rates').update({ usd_per_unit: 1 } as any).eq('currency', 'PHP').select('currency')
      expect(r.data ?? []).toEqual([])
    }
    const still = await fx!.svc.from('payment_method_fees').select('provider_pct').eq('method', 'pix_br').single()
    expect(Number((still.data as any).provider_pct)).toBe(3.75)
  })
})
