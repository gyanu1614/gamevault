/**
 * Checkout B3 Part 4 — /fees lists per-method buyer fees FROM THE TABLE.
 * The legal document stays a constant (rules + the marketplace fee); the
 * per-method numbers are a table block built from payment_method_fees rows
 * at render time. Pure shaping is pinned here; the read is an anon-client
 * unstable_cache under BUYER_FEES_TAG (revalidated by the admin action).
 */
import { describe, it, expect } from 'vitest'

import { buyerFeeTableBlock, describeMethodFee, type PublicMethodFee } from './buyer-public-rates'

const row = (over: Partial<PublicMethodFee>): PublicMethodFee => ({
  method: 'pix_br', label: 'Pix', provider: 'payssion', feeCurrency: 'USD', providerPct: 3.75, providerFixedMinor: 0,
  fxMarkupPct: 7.5, bufferPct: 1, floorPct: 5, minFeeMinor: 35, maxTotalMinor: null, refundable: true, instantClearing: true,
  selectable: true, ...over,
})

describe('describeMethodFee — one honest line per method', () => {
  it('states the provider rate, FX markup, buffer and the floor', () => {
    expect(describeMethodFee(row({}))).toBe('3.75% + 7.5% currency conversion + 1% buffer, at least 5% of the item price, minimum $0.35')
  })
  it('includes a fixed amount in the fee currency and a cap when present', () => {
    expect(describeMethodFee(row({ method: 'gcash_ph', label: 'GCash', feeCurrency: 'PHP', providerPct: 5, providerFixedMinor: 1000, fxMarkupPct: 3.4, minFeeMinor: 0 })))
      .toBe('5% + PHP 10.00 + 3.4% currency conversion + 1% buffer, at least 5% of the item price')
    expect(describeMethodFee(row({ method: 'paysafecard', label: 'paysafecard', feeCurrency: 'EUR', providerPct: 12.5, fxMarkupPct: 0, minFeeMinor: 0, maxTotalMinor: 25000 })))
      .toBe('12.5% + 1% buffer, at least 5% of the item price, orders up to EUR 250.00')
  })
  it('crypto / wallet read as the floor only', () => {
    expect(describeMethodFee(row({ method: 'btcpay', label: 'Crypto', providerPct: 0, fxMarkupPct: 0, minFeeMinor: 0 })))
      .toBe('1% buffer, at least 5% of the item price')
  })
})

describe('buyerFeeTableBlock — the legal table block', () => {
  it('lists only selectable rows, in the given order, with refund / clearing flags', () => {
    const block = buyerFeeTableBlock([
      row({}),
      row({ method: 'maya_ph', label: 'Maya', selectable: false }),
      row({ method: 'qr_ph', label: 'QR Ph', feeCurrency: 'PHP', providerPct: 2.5, providerFixedMinor: 1500, fxMarkupPct: 3.4, minFeeMinor: 0, refundable: false }),
    ])
    expect(block.t).toBe('table')
    expect(block.head).toEqual(['Payment method', 'Processing fee', 'Refunds', 'Clears'])
    expect(block.rows.map((r) => r[0])).toEqual(['Pix', 'QR Ph'])
    expect(block.rows[1][2]).toBe('Store credit only')
    expect(block.rows[0][2]).toBe('Yes')
    expect(block.rows[0][3]).toBe('Instantly')
  })
  it('an empty table still renders a row that says so (never a blank section)', () => {
    const block = buyerFeeTableBlock([])
    expect(block.rows).toEqual([['No payment methods are currently enabled.', '', '', '']])
  })
})
