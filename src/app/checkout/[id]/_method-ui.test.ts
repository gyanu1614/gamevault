import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { MARK_SLOT, METHOD_UI_IDS, TILE_SLOT, markSize, methodIdForRow, toRow, walletRows } from './_method-ui'
import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { PAYMENT_METHOD_LOGOS, PAYMENT_METHOD_MULTI_MARKS, PAYMENT_METHOD_ONDARK } from '@/lib/payments/method-marks'

describe('checkout method rows', () => {
  it('every selectable registry method has its own icon + notes line (none falls back)', () => {
    const missing = payssionSelectorMethods().map((m) => m.pmId).filter((pm) => !METHOD_UI_IDS.includes(pm))
    expect(missing).toEqual([])
  })

  it('a row carries the label, logo and flag; multi-country methods get the globe', () => {
    const quote = { serviceFeeMinor: 100 } as any
    const br = toRow({ method: 'creditcard_br', label: 'Credit / Debit Card', countries: ['BR'], coverage: 'Brazil', quote } as any)
    expect(br).toMatchObject({ id: 'creditcard_br', label: 'Credit / Debit Card', flag: '🇧🇷' })
    expect(br.points[0]).toBe('Pay with a card issued in Brazil')
    const sk = toRow({ method: 'skrill', label: 'Skrill', countries: ['GB', 'DE'], coverage: 'Worldwide', quote } as any)
    expect(sk.flag).toBe('🌍')
    expect(sk.marks).toEqual([{ logo: '/payments/ondark/skrill.svg', aspect: 2.85 }])
    // Card rails show the schemes they take (owner 2026-10-22).
    expect(br.marks.map((m) => m.logo)).toEqual(['/payments/ondark/visa.svg', '/payments/ondark/mastercard.svg'])
    const sa = toRow({ method: 'mada_sa', label: 'Credit / Debit Card', countries: ['SA'], coverage: 'Saudi Arabia', quote } as any)
    expect(sa.marks.map((m) => m.logo)).toEqual(['/payments/ondark/visa.svg', '/payments/ondark/mastercard.svg', '/payments/ondark/mada_sa.svg'])
    const pn = toRow({ method: 'paynow_sg', label: 'PayNow', countries: ['SG'], coverage: 'Singapore', quote } as any)
    expect(pn.marks).toEqual([]) // no clean PayNow vector → the row's icon
    expect(pn.qrPay).toBe(true)
    expect(sk.qrPay).toBe(false)
  })

  it('the Stripe card row: worldwide, Visa + Mastercard marks, card notes', () => {
    const quote = { serviceFeeMinor: 100 } as any
    const card = toRow({ method: 'stripe', label: 'Credit / Debit Card', countries: [], coverage: 'Worldwide', quote } as any)
    expect(card).toMatchObject({ id: 'stripe', label: 'Credit / Debit Card', flag: '🌍', qrPay: false })
    expect(card.marks.map((m) => m.logo)).toEqual(['/payments/ondark/visa.svg', '/payments/ondark/mastercard.svg'])
    expect(card.points).toEqual(['Pay with a Visa or Mastercard, credit or debit', 'Payment confirms instantly'])
  })

  it('Apple Pay / Google Pay rows ride on the card row: same quote, Stripe method, one per device', () => {
    const quote = { serviceFeeMinor: 123 } as any
    const card = toRow({ method: 'stripe', label: 'Credit / Debit Card', countries: [], coverage: 'Worldwide', quote } as any)
    const apple = walletRows(card, { applePay: true, googlePay: false })
    expect(apple.map((r) => r.id)).toEqual(['applepay'])
    expect(apple[0]).toMatchObject({ label: 'Apple Pay', quote, flag: '🌍' })
    expect(apple[0].marks.map((m) => m.logo)).toEqual(['/payments/ondark/applepay_sa.svg'])
    const google = walletRows(card, { applePay: false, googlePay: true })
    expect(google.map((r) => r.id)).toEqual(['googlepay'])
    expect(google[0].marks.map((m) => m.logo)).toEqual(['/payments/ondark/googlepay.svg'])
    expect(walletRows(null, { applePay: true, googlePay: true })).toEqual([])
    // Every wallet row pays through the Stripe card method.
    expect(methodIdForRow('applepay')).toBe('stripe')
    expect(methodIdForRow('googlepay')).toBe('stripe')
    expect(methodIdForRow('stripe')).toBe('stripe')
    expect(methodIdForRow('pix_br')).toBe('pix_br')
    expect(existsSync(join(process.cwd(), 'public/payments/ondark/googlepay.svg'))).toBe(true)
  })

  it('every method with a brand mark has its on-dark version, and the file exists', () => {
    for (const pm of Object.keys(PAYMENT_METHOD_LOGOS)) {
      const mark = PAYMENT_METHOD_ONDARK[pm]
      expect(mark, pm).toBeDefined()
      expect(existsSync(join(process.cwd(), 'public', mark.logo)), mark.logo).toBe(true)
      expect(mark.aspect, pm).toBeGreaterThan(0)
    }
    for (const [pm, marks] of Object.entries(PAYMENT_METHOD_MULTI_MARKS)) {
      for (const mark of marks) {
        expect(existsSync(join(process.cwd(), 'public', mark.logo)), `${pm} ${mark.logo}`).toBe(true)
        expect(mark.aspect, pm).toBeGreaterThan(0)
      }
    }
  })

  it('markSize: every mark fits the slot; a square tile stands taller than a wide wordmark', () => {
    for (const { aspect } of Object.values(PAYMENT_METHOD_ONDARK)) {
      const s = markSize(aspect)
      expect(s.width).toBeLessThanOrEqual(MARK_SLOT.width)
      expect(s.height).toBeLessThanOrEqual(MARK_SLOT.height)
    }
    expect(markSize(1)).toEqual({ width: 30, height: 30 })
    expect(markSize(4).height).toBeLessThan(markSize(1).height)
    expect(markSize(4).width).toBeGreaterThan(markSize(1).width)
    expect(markSize(Number.NaN)).toEqual({ width: 30, height: 30 })
  })

  it('markSize in the row logo tile: every mark fits the tile slot', () => {
    for (const { aspect } of Object.values(PAYMENT_METHOD_ONDARK)) {
      const s = markSize(aspect, TILE_SLOT)
      expect(s.width).toBeLessThanOrEqual(TILE_SLOT.width)
      expect(s.height).toBeLessThanOrEqual(TILE_SLOT.height)
    }
    expect(markSize(1, TILE_SLOT)).toEqual({ width: 22, height: 22 })
  })
})
