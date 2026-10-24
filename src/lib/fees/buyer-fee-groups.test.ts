/**
 * /fees groups payment methods by region the way G2G and Stripe list local
 * methods (research 2026-10-23): one group per region, crypto and
 * multi-region wallets under Worldwide, never one flat 35-row table.
 */
import { describe, it, expect } from 'vitest'

import { feeGroupOf, groupByRegion, pickExampleMethods, publicMethodNames } from './buyer-fee-groups'

describe('feeGroupOf', () => {
  it('puts a local rail in its country’s region', () => {
    expect(feeGroupOf('pix_br')).toBe('latam')
    expect(feeGroupOf('blik_pl')).toBe('eu')
    expect(feeGroupOf('gcash_ph')).toBe('sea')
    expect(feeGroupOf('mada_sa')).toBe('mea')
    expect(feeGroupOf('kakaopay_kr')).toBe('eastasia')
  })
  it('crypto and rails that span regions are Worldwide', () => {
    expect(feeGroupOf('btcpay')).toBe('worldwide')
    expect(feeGroupOf('paysafecard')).toBe('worldwide') // Europe, UK, CA & AU
    expect(feeGroupOf('skrill')).toBe('eu') // Europe, UK & Switzerland only
  })
})

describe('groupByRegion', () => {
  it('Worldwide first, then the regions in order; empty regions are left out; input order kept', () => {
    const groups = groupByRegion([{ method: 'trustly' }, { method: 'pix_br' }, { method: 'btcpay' }, { method: 'blik_pl' }])
    expect(groups.map((g) => g.label)).toEqual(['Worldwide', 'Europe', 'Latin America'])
    expect(groups[1].methods.map((m) => m.method)).toEqual(['trustly', 'blik_pl'])
  })
})

describe('publicMethodNames', () => {
  it('a label shared by several methods carries each one’s country', () => {
    const names = publicMethodNames([
      { method: 'creditcard_br', label: 'Credit / Debit Card' },
      { method: 'creditcard_mx', label: 'Credit / Debit Card' },
      { method: 'pix_br', label: 'Pix' },
    ])
    expect(names.get('creditcard_br')).toBe('Credit / Debit Card (Brazil)')
    expect(names.get('creditcard_mx')).toBe('Credit / Debit Card (Mexico)')
    expect(names.get('pix_br')).toBe('Pix')
  })
})

describe('pickExampleMethods', () => {
  it('prefers crypto, Pix and Trustly, and fills up to three from the rest', () => {
    const all = [{ method: 'gcash_ph' }, { method: 'trustly' }, { method: 'btcpay' }, { method: 'blik_pl' }]
    expect(pickExampleMethods(all).map((m) => m.method)).toEqual(['btcpay', 'trustly', 'gcash_ph'])
  })
})
