/**
 * The 17 Payssion methods enabled 2026-10-15 — the DB side. Fee rows are
 * what Payssion charges us (rate sheet of 2025-12-11), quoted by the ONE
 * buyer_fee_quote exactly like every other method; nothing new in the
 * formula, only rows + the currency rates they price in.
 *
 *   · one selectable payssion row per pm_id: provider %, fixed fee, fee
 *     currency, minimum / maximum charge and refundability as on the sheet;
 *     no FX markup (owner 2026-10-15), buffer 1% and floor 5% like the rest;
 *   · currency_rates for every new fee currency (KRW, SGD, MYR, VND, SAR,
 *     ZAR, MXN, PEN, CHF). KRW and VND have no minor unit: their "minor"
 *     amounts are stored ×100 like every other currency, so the quote's
 *     2-dp conversion stays exact;
 *   · worked $20 quotes, and the min (under_min) / max (over_cap) edges;
 *   · eligibleMethods offers all 17 for a $19.99 order, with a quote each.
 *
 * Service role reads only; no row is written, so nothing to clean up beyond
 * the fixture.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

import { hasEnv, makeFixture, type Fixture } from './throwaway'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))

let fx: Fixture | null = null

type Row = [cur: string, pct: number, fixed: number, minTotal: number | null, maxTotal: number, refundable: boolean]
/** pm_id → sheet terms, in minor units of the fee currency. */
const SHEET: Record<string, Row> = {
  skrill: ['EUR', 3.5, 30, 100, 200000, true], // $0.35 stored as €0.30 (EUR 1.17); €1–€2,000
  kakaopay_kr: ['KRW', 3.9, 0, 20000, 100000000, true], // 200–1,000,000 KRW
  paynow_sg: ['SGD', 3, 0, 1, 100000, true],
  grabpay_sg: ['SGD', 3, 0, 1, 100000, true],
  fpx_my: ['MYR', 3.5, 180, 200, 500000, true], // 2 MYR = the corporate-banking minimum
  touchngo_my: ['MYR', 3.5, 0, 100, 150000, false], // no provider refunds
  vietqr_vn: ['VND', 5, 0, 200000, 5000000000, true], // 2,000–50,000,000 VND
  mada_sa: ['SAR', 5.5, 0, 10, 200000, true],
  applepay_sa: ['SAR', 5.5, 0, 10, 200000, true],
  creditcard_za: ['ZAR', 4.5, 0, 100, 1000000, true],
  creditcard_br: ['USD', 4.25, 0, null, 50000, true], // 1 BRL min is under the $1 order minimum
  creditcard_mx: ['MXN', 4.25, 0, 100, 1000000, true],
  bcp_pe: ['PEN', 4.25, 0, 500, 750000, true],
  twint_ch: ['CHF', 3.5, 15, 10, 500000, true],
  bancontact_be: ['EUR', 4.25, 45, 100, 200000, true],
  mybank: ['EUR', 2.25, 35, null, 200000, true],
  satispay: ['EUR', 3.75, 35, null, 200000, true],
}
const NEW = Object.keys(SHEET)

async function quote(method: string, subtotalMinor: number) {
  const { data, error } = await fx!.svc.rpc('buyer_fee_quote', { p_method: method, p_subtotal_minor: subtotalMinor, p_currency: 'USD' } as any)
  if (error) throw new Error(`buyer_fee_quote(${method}): ${error.message}`)
  return data as { ok: boolean; reason: string | null; fee_minor: number | null; marketplace_minor: number | null; total_minor: number | null; refundable: boolean | null }
}

describe.skipIf(!hasEnv)('2026-10-15 Payssion methods — fee rows + quotes (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 90_000)
  afterAll(async () => {
    await fx?.cleanup()
  }, 60_000)

  it('one selectable payssion row per pm_id, with the sheet terms and the shared defaults', async () => {
    const { data, error } = await fx!.svc.from('payment_method_fees').select('*').in('method', NEW)
    expect(error).toBeNull()
    const rows = Object.fromEntries((data as any[]).map((r) => [r.method, r]))
    for (const [pm, [cur, pct, fixed, minTotal, maxTotal, refundable]] of Object.entries(SHEET)) {
      const r = rows[pm]
      expect(r, `${pm}: fee row`).toBeTruthy()
      expect(r.provider, pm).toBe('payssion')
      expect(r.selectable, pm).toBe(true)
      expect(r.fee_currency, pm).toBe(cur)
      expect(Number(r.provider_pct), pm).toBe(pct)
      expect(Number(r.provider_fixed_minor), pm).toBe(fixed)
      expect(r.min_total_minor == null ? null : Number(r.min_total_minor), pm).toBe(minTotal)
      expect(Number(r.max_total_minor), pm).toBe(maxTotal)
      expect(r.refundable, pm).toBe(refundable)
      expect(Number(r.fx_markup_pct), `${pm}: no FX markup`).toBe(0)
      expect(Number(r.buffer_pct), pm).toBe(1)
      expect(Number(r.floor_pct), pm).toBe(5)
      expect(Number(r.min_fee_minor), pm).toBe(0)
      expect(r.currencies, pm).toContain('USD')
    }
  })

  it('labels match the checkout (country-named card rails)', async () => {
    const { PAYSSION_METHODS } = await import('@/lib/payments/providers/payssion/methods')
    const { data } = await fx!.svc.from('payment_method_fees').select('method, label').in('method', NEW)
    for (const r of data as any[]) expect(r.label, r.method).toBe(PAYSSION_METHODS[r.method].label)
  })

  it('every new fee currency has a rate', async () => {
    const { data } = await fx!.svc.from('currency_rates').select('currency, usd_per_unit')
    const have = new Map((data as any[]).map((r) => [r.currency, Number(r.usd_per_unit)]))
    for (const c of ['KRW', 'SGD', 'MYR', 'VND', 'SAR', 'ZAR', 'MXN', 'PEN', 'CHF']) expect(have.get(c), c).toBeGreaterThan(0)
    expect(have.get('SAR')).toBeCloseTo(1 / 3.75, 4) // pegged
  })

  // $20 item: marketplace $0.40 (2%), processing grossed up on $20.40.
  it('worked $20 quotes', async () => {
    const expected: Record<string, number> = {
      skrill: 133, // (2040 + 30×1.17) / (1 − 0.035 − 0.01) − 2040 = 132.9
      kakaopay_kr: 105, // 2040 / 0.951 − 2040 = 105.1
      paynow_sg: 102, grabpay_sg: 102, touchngo_my: 102, // the 5% floor (2040 × 5% = 102) wins
      fpx_my: 142, // (2040 + 180×0.245) / 0.955 − 2040 = 142.3
      vietqr_vn: 130, // 2040 / 0.94 − 2040 = 130.2
      mada_sa: 142, applepay_sa: 142, // 2040 / 0.935 − 2040 = 141.8
      creditcard_za: 119, // 2040 / 0.945 − 2040 = 118.7
      creditcard_br: 113, creditcard_mx: 113, bcp_pe: 113, // 2040 / 0.9475 − 2040 = 113.0
      twint_ch: 115, // (2040 + 15×1.1996) / 0.955 − 2040 = 114.9
      bancontact_be: 169, // (2040 + 45×1.17) / 0.9475 − 2040 = 168.7
      mybank: 111, // (2040 + 35×1.17) / 0.9675 − 2040 = 110.8
      satispay: 145, // (2040 + 35×1.17) / 0.9525 − 2040 = 144.9
    }
    for (const [pm, fee] of Object.entries(expected)) {
      const q = await quote(pm, 2000)
      expect(q.ok, `${pm}: ${q.reason}`).toBe(true)
      expect(q.marketplace_minor, pm).toBe(40)
      expect(q.fee_minor, pm).toBe(fee)
      expect(q.total_minor, pm).toBe(2040 + fee)
      expect(q.refundable, pm).toBe(SHEET[pm][5])
    }
  })

  it('minimum charge: Skrill / Bancontact under €1.00, BCP under 5 PEN (+5% headroom) → under_min', async () => {
    expect((await quote('skrill', 40)).reason).toBe('under_min') // total $1.01 < €1.05 ($1.2285)
    expect((await quote('skrill', 60)).ok).toBe(true)
    expect((await quote('bancontact_be', 25)).reason).toBe('under_min')
    expect((await quote('bancontact_be', 45)).ok).toBe(true)
    expect((await quote('bcp_pe', 100)).reason).toBe('under_min') // total $1.37 < 5.25 PEN ($1.526)
    expect((await quote('bcp_pe', 130)).ok).toBe(true)
  })

  it('maximum charge → over_cap, in each fee currency (KRW and VND stored ×100)', async () => {
    const edges: Array<[string, number, number]> = [
      // pm, an ok subtotal, an over-cap subtotal (cents)
      ['creditcard_br', 46000, 47000], // $500 cap
      ['kakaopay_kr', 69000, 70000], // 1,000,000 KRW ≈ $746
      ['vietqr_vn', 177000, 179000], // 50,000,000 VND ≈ $1,930
      ['mada_sa', 48500, 49500], // 2,000 SAR ≈ $533
      ['touchngo_my', 34000, 35000], // 1,500 MYR ≈ $368
      ['skrill', 218000, 219000], // €2,000 ≈ $2,340
      ['twint_ch', 559000, 561000], // 5,000 CHF ≈ $5,998
    ]
    for (const [pm, ok, over] of edges) {
      expect((await quote(pm, ok)).ok, `${pm} at ${ok}`).toBe(true)
      expect((await quote(pm, over)).reason, `${pm} at ${over}`).toBe('over_cap')
    }
  })

  it('eligibleMethods offers all 17 for a $19.99 order, each with a quote and its registry countries', async () => {
    const { eligibleMethods } = await import('@/lib/payments/eligibility')
    const { PAYSSION_METHODS } = await import('@/lib/payments/providers/payssion/methods')
    const { methods, refused } = await eligibleMethods({ buyerId: fx!.buyer.id, currency: 'USD', country: null, subtotalMinor: 1999n })
    for (const pm of NEW) {
      const m = methods.find((x) => x.method === pm)
      expect(m, `${pm} offered (refused: ${JSON.stringify(refused.filter((r) => r.method === pm))})`).toBeTruthy()
      expect(m!.provider).toBe('payssion')
      expect(m!.quote.feeMinor).toBeGreaterThan(0)
      expect(m!.countries).toEqual(PAYSSION_METHODS[pm].countries)
    }
  })
})
