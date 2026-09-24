/**
 * Checkout B4 — EU Payssion methods, pinned to the RECORDED probes
 * (docs/payments/eu-methods-probe.md, ./probe-fixtures.ts).
 *
 *   · registry ⇒ probe 200: every selector pm_id has a recorded passing
 *     probe (docs/checkout.md §9.1, now executable). A pm_id added without a
 *     fixture fails here before it can 491/405 in front of a buyer.
 *   · never-wire list: skrill / payu_pl / multibanco_pt / bancomat_it.
 *   · per method: createCharge against the recorded answer shape → the
 *     recorded transaction id, an absolute checkout URL, USD sent as-is
 *     (no local-currency conversion), the docs signature, the per-kind expiry.
 *   · the recorded 417 (below the provider minimum) surfaces as a thrown
 *     `result_code 417` after ONE create call — never the 402 fallback.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'

import { makePayssionProvider } from './index'
import { PAYSSION_METHODS, payssionSelectorMethods, splitPayssionMethodsByCountry } from './methods'
import { NEVER_WIRE_PM_IDS, PAYSSION_PROBE_FIXTURES, fixtureCreateResponse, passingProbe } from './probe-fixtures'
import { providerNameForMethod } from '@/lib/payments/registry'
import { fromDecimal } from '@/lib/money'

process.env.PAYSSION_API_KEY ||= 'test-api-key'
process.env.PAYSSION_SECRET_KEY ||= 'test-secret'
process.env.PUBLIC_API_URL ||= 'https://app.test.local'
const API_KEY = process.env.PAYSSION_API_KEY!
const SECRET = process.env.PAYSSION_SECRET_KEY!
const md5 = (s: string) => createHash('md5').update(s).digest('hex')

const EU = ['trustly', 'blik_pl', 'p24_pl', 'eps_at', 'mbway_pt', 'bancomatpay_it', 'payu_cz', 'paysafecard'] as const
const ORDER_ID = '0f1e2d3c-1111-2222-3333-444444444444'

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

describe('B4: registry ⇒ recorded probe 200', () => {
  it('every selector pm_id has a recorded passing probe (transaction minted, redirect, cancelled)', () => {
    const missing = payssionSelectorMethods().map((m) => m.pmId).filter((pm) => !passingProbe(pm))
    expect(missing, 'registry pm_ids without a recorded 200 probe').toEqual([])
    for (const m of payssionSelectorMethods()) {
      const f = passingProbe(m.pmId)!
      expect(f.cancelState, `${m.pmId}: probe transaction must have been cancelled`).toBe('cancelled')
      // B4 probes carry the minted transaction id; pre-B4 ones cite their source.
      if (f.source) expect(f.probedAt < '2026-09-24', `${m.pmId}: a source-only fixture is pre-B4`).toBe(true)
      else expect(f.transactionId).toMatch(/^A\d{12,}$/)
    }
    for (const pm of EU) expect(passingProbe(pm)?.transactionId, `${pm}: recorded B4 transaction id`).toMatch(/^A\d{12,}$/)
  })

  it('the eight EU methods are in the registry, route to payssion and quote in USD like every other method', () => {
    for (const pm of EU) {
      expect(PAYSSION_METHODS[pm], pm).toBeTruthy()
      expect(providerNameForMethod(pm)).toBe('payssion')
      expect(passingProbe(pm)?.currency).toBe('USD')
    }
  })

  it('never-wire pm_ids are absent from the registry, and the control (bancontact_be) stays unwired', () => {
    for (const pm of [...NEVER_WIRE_PM_IDS, 'bancontact_be']) expect(PAYSSION_METHODS[pm as string], pm).toBeUndefined()
    expect(PAYSSION_PROBE_FIXTURES.bancomat_it[0].resultCode).toBe(405)
    expect(passingProbe('bancontact_be')).toBeTruthy()
  })

  it('EU country lists are ISO-3166 alpha-2 and the region filter pins the local rails', () => {
    for (const pm of EU) {
      const m = PAYSSION_METHODS[pm]
      expect(m.countries.length, pm).toBeGreaterThan(0)
      for (const c of m.countries) expect(c, `${pm}: ${c}`).toMatch(/^[A-Z]{2}$/)
      expect(new Set(m.countries).size, `${pm}: duplicate country`).toBe(m.countries.length)
    }
    const ids = (ms: Array<{ pmId: string }>) => ms.map((m) => m.pmId)
    expect(ids(splitPayssionMethodsByCountry('PL').matched)).toEqual(['trustly', 'blik_pl', 'p24_pl', 'paysafecard'])
    expect(ids(splitPayssionMethodsByCountry('AT').matched)).toEqual(['trustly', 'eps_at', 'paysafecard'])
    expect(ids(splitPayssionMethodsByCountry('PT').matched)).toEqual(['trustly', 'mbway_pt', 'paysafecard'])
    expect(ids(splitPayssionMethodsByCountry('IT').matched)).toEqual(['trustly', 'bancomatpay_it', 'paysafecard'])
    expect(ids(splitPayssionMethodsByCountry('CZ').matched)).toEqual(['trustly', 'payu_cz', 'paysafecard'])
    expect(ids(splitPayssionMethodsByCountry('CA').matched)).toEqual(['paysafecard'])
    // Existing regions are untouched by the additions.
    expect(ids(splitPayssionMethodsByCountry('BR').matched)).toEqual(['pix_br', 'boleto_br'])
  })
})

describe('B4: createCharge per EU method, against the recorded answer', () => {
  for (const pm of EU) {
    it(`${pm}: recorded transaction id + absolute checkout URL; USD sent verbatim with the docs signature`, async () => {
      const f = passingProbe(pm)!
      const { bodies, provider } = harness(fixtureCreateResponse(f))
      const r = await provider.createCharge({
        orderId: ORDER_ID, orderNumber: 'DM-TEST-0001',
        amount: fromDecimal('12.34', 'USD'),
        returnUrl: 'https://app.test.local/checkout/return/x',
        metadata: { pm_id: pm },
      })
      expect(r.providerChargeId).toBe(f.transactionId)
      expect(r.checkoutUrl).toMatch(/^https:\/\//)
      expect(r.rawStatus).toBe('pending')
      expect(bodies).toHaveLength(1)
      expect(bodies[0].pm_id).toBe(pm)
      expect(bodies[0].amount).toBe('12.34')
      expect(bodies[0].currency).toBe('USD')
      expect(bodies[0].api_sig).toBe(md5(`${API_KEY}|${pm}|12.34|USD|${ORDER_ID}|${SECRET}`))
      const window = new Date(r.expiresAt!).getTime() - Date.now()
      const expected = PAYSSION_METHODS[pm].kind === 'voucher' ? 48 * 60 : 60
      expect(Math.round(window / 60_000)).toBe(expected)
    })
  }

  for (const pm of ['eps_at', 'mbway_pt'] as const) {
    it(`${pm}: the recorded 417 (below the provider minimum) throws after ONE create call — no 402 fallback, nothing minted`, async () => {
      const f = PAYSSION_PROBE_FIXTURES[pm].find((x) => x.resultCode === 417)!
      expect(f.description).toMatch(/more than 1\.00 EUR/)
      const { bodies, provider } = harness(fixtureCreateResponse(f))
      await expect(provider.createCharge({
        orderId: ORDER_ID, orderNumber: null, amount: fromDecimal('0.90', 'USD'),
        returnUrl: 'https://app.test.local/checkout/return/x', metadata: { pm_id: pm },
      })).rejects.toThrow(/result_code 417/)
      expect(bodies).toHaveLength(1)
    })
  }
})
