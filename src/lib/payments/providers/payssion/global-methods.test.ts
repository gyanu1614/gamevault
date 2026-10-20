/**
 * The 17 Payssion methods enabled on 2026-10-15 (Liddo's 22-method request,
 * docs/payments/eu-methods-probe.md "2026-10-15"), pinned to the RECORDED
 * probes in ./probe-fixtures.ts:
 *
 *   · each pm_id is in the registry, routes to payssion, and has a passing
 *     2026-10-15 probe (USD 2.00, transaction minted, cancelled);
 *   · the 491s of the same run (naverpay_kr, alipay_cn, tenpay_cn, payid_au)
 *     and payu_pl (owner rule) stay out of the registry;
 *   · local card rails are named by country, so a buyer elsewhere doesn't
 *     expect them to take their card;
 *   · every method is an instant rail (60-minute window) except BCP, paid by
 *     reference code online or at an agent (voucher, 48 hours);
 *   · createCharge sends USD verbatim with the docs signature, per method.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'

import { makePayssionProvider } from './index'
import { PAYSSION_METHODS } from './methods'
import { NEVER_WIRE_PM_IDS, PAYSSION_PROBE_FIXTURES, fixtureCreateResponse, passingProbe } from './probe-fixtures'
import { providerNameForMethod } from '@/lib/payments/registry'
import { fromDecimal } from '@/lib/money'

process.env.PAYSSION_API_KEY ||= 'test-api-key'
process.env.PAYSSION_SECRET_KEY ||= 'test-secret'
process.env.PUBLIC_API_URL ||= 'https://app.test.local'
const API_KEY = process.env.PAYSSION_API_KEY!
const SECRET = process.env.PAYSSION_SECRET_KEY!
const md5 = (s: string) => createHash('md5').update(s).digest('hex')
const ORDER_ID = '0f1e2d3c-1111-2222-3333-444444444444'

/** pm_id → the transaction the 2026-10-15 probe minted (and cancelled). */
const PROBED_2026_10_15: Record<string, string> = {
  skrill: 'AA15068156779344',
  kakaopay_kr: 'AA15068163565886',
  paynow_sg: 'AA15068170085043',
  grabpay_sg: 'AA15068173125755',
  fpx_my: 'AA15068175625167',
  touchngo_my: 'AA15068178560795',
  vietqr_vn: 'AA15068183371959',
  mada_sa: 'AA15068185811826',
  applepay_sa: 'AA15068188797546',
  creditcard_za: 'AA15068191055065',
  creditcard_br: 'AA15068194165691',
  creditcard_mx: 'AA15068196487315',
  bcp_pe: 'AA15068199295849',
  twint_ch: 'AA15068203733889',
  bancontact_be: 'AA15068206059866',
  satispay: 'AA15068208896996',
  mybank: 'AA15068211614474',
}
const NEW = Object.keys(PROBED_2026_10_15)
const NOT_ENABLED_2026_10_15 = ['naverpay_kr', 'alipay_cn', 'tenpay_cn', 'payid_au'] as const

function harness(answer: Record<string, unknown>) {
  const bodies: Record<string, string>[] = []
  const fetchImpl = (async (url: any, init: any) => {
    if (String(url).includes('/payment/create')) {
      bodies.push(Object.fromEntries(new URLSearchParams(String(init?.body ?? ''))))
      return { ok: true, json: async () => answer } as any
    }
    return { ok: false, status: 404, text: async () => 'nope' } as any
  }) as any
  return { bodies, provider: makePayssionProvider({ fetchImpl }) }
}

describe('2026-10-15 methods: registry ⇒ recorded probe 200', () => {
  it('all 17 are in the registry and route to payssion', () => {
    expect(NEW).toHaveLength(17)
    for (const pm of NEW) {
      expect(PAYSSION_METHODS[pm], pm).toBeTruthy()
      expect(providerNameForMethod(pm), pm).toBe('payssion')
    }
  })

  it('each has its recorded 2026-10-15 probe: USD 2.00, the minted transaction id, cancelled', () => {
    for (const pm of NEW) {
      const f = passingProbe(pm)
      expect(f, `${pm}: passing probe`).toBeTruthy()
      expect(f!.probedAt).toBe('2026-10-15')
      expect(f!.currency).toBe('USD')
      expect(f!.amount).toBe('2.00')
      expect(f!.transactionId).toBe(PROBED_2026_10_15[pm])
      expect(f!.cancelState).toBe('cancelled')
    }
  })

  it('the run\'s 491s are recorded as not enabled and stay out of the registry; payu_pl is never wired', () => {
    for (const pm of NOT_ENABLED_2026_10_15) {
      expect(PAYSSION_METHODS[pm], pm).toBeUndefined()
      expect(passingProbe(pm), pm).toBeNull()
      expect(PAYSSION_PROBE_FIXTURES[pm]?.[0]?.resultCode, `${pm}: recorded 491`).toBe(491)
    }
    expect(NEVER_WIRE_PM_IDS).toContain('payu_pl')
    expect(NEVER_WIRE_PM_IDS).not.toContain('skrill')
    for (const pm of NEVER_WIRE_PM_IDS) expect(PAYSSION_METHODS[pm as string], pm).toBeUndefined()
  })
})

describe('2026-10-15 methods: labels, kind, countries', () => {
  it('local card rails are named by country', () => {
    expect(PAYSSION_METHODS.creditcard_br.label).toBe('Brazilian Cards')
    expect(PAYSSION_METHODS.creditcard_mx.label).toBe('Mexican Cards')
    expect(PAYSSION_METHODS.creditcard_za.label).toBe('South African Cards')
    expect(PAYSSION_METHODS.mada_sa.label).toBe('Saudi Cards (mada)')
    expect(PAYSSION_METHODS.applepay_sa.label).toBe('Apple Pay (Saudi Arabia)')
  })

  it('every one is an instant rail with the 60-minute window, except BCP (reference code, 48 hours)', () => {
    for (const pm of NEW.filter((x) => x !== 'bcp_pe')) {
      expect(PAYSSION_METHODS[pm].kind, pm).toBe('instant')
      expect(PAYSSION_METHODS[pm].expiryMinutes, pm).toBe(60)
    }
    expect(PAYSSION_METHODS.bcp_pe.kind).toBe('voucher')
    expect(PAYSSION_METHODS.bcp_pe.expiryMinutes).toBe(48 * 60)
  })

  it("Skrill is offered only where Payssion's Skrill works: EU/EEA, UK and Switzerland", () => {
    const sk = PAYSSION_METHODS.skrill.countries
    for (const cc of ['GB', 'DE', 'BE', 'IT', 'CH', 'NO', 'IS', 'LI', 'PL', 'IE']) expect(sk, cc).toContain(cc)
    // 2026-10-16: Payssion's page answered "network location not supported" outside Europe.
    for (const cc of ['US', 'AR', 'BR', 'SA', 'ZA', 'KR', 'SG', 'MY', 'VN', 'PE', 'JP', 'TR', 'UA']) expect(sk, cc).not.toContain(cc)
    expect(sk).toHaveLength(32)
  })

  it('country lists are ISO-3166 alpha-2, non-empty, without duplicates', () => {
    for (const pm of NEW) {
      const m = PAYSSION_METHODS[pm]
      expect(m.countries.length, pm).toBeGreaterThan(0)
      for (const c of m.countries) expect(c, `${pm}: ${c}`).toMatch(/^[A-Z]{2}$/)
      expect(new Set(m.countries).size, `${pm}: duplicate country`).toBe(m.countries.length)
    }
  })

  it('single-country rails list exactly their country', () => {
    const exact: Record<string, string[]> = {
      kakaopay_kr: ['KR'], paynow_sg: ['SG'], grabpay_sg: ['SG'], fpx_my: ['MY'], touchngo_my: ['MY'],
      vietqr_vn: ['VN'], mada_sa: ['SA'], applepay_sa: ['SA'], creditcard_za: ['ZA'], creditcard_br: ['BR'],
      creditcard_mx: ['MX'], bcp_pe: ['PE'], twint_ch: ['CH'], bancontact_be: ['BE'],
    }
    for (const [pm, cc] of Object.entries(exact)) expect(PAYSSION_METHODS[pm].countries, pm).toEqual(cc)
  })
})

describe('2026-10-15 methods: createCharge against the recorded answer', () => {
  for (const pm of NEW) {
    it(`${pm}: recorded transaction id, absolute checkout URL, USD sent verbatim with the docs signature`, async () => {
      const f = passingProbe(pm)!
      const { bodies, provider } = harness(fixtureCreateResponse(f))
      const r = await provider.createCharge({
        orderId: ORDER_ID, orderNumber: 'DM-TEST-0001',
        amount: fromDecimal('12.34', 'USD'),
        returnUrl: 'https://app.test.local/checkout/return/x',
        metadata: { pm_id: pm },
      })
      expect(r.providerChargeId).toBe(PROBED_2026_10_15[pm])
      expect(r.checkoutUrl).toMatch(/^https:\/\//)
      expect(bodies).toHaveLength(1)
      expect(bodies[0].pm_id).toBe(pm)
      expect(bodies[0].currency).toBe('USD')
      expect(bodies[0].api_sig).toBe(md5(`${API_KEY}|${pm}|12.34|USD|${ORDER_ID}|${SECRET}`))
      expect(Math.round((new Date(r.expiresAt!).getTime() - Date.now()) / 60_000)).toBe(pm === 'bcp_pe' ? 48 * 60 : 60)
    })
  }
})
