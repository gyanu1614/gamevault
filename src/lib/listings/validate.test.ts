/**
 * The shared listing validator — audit ACC-03/05/06/11 (BUG-02/13 server halves).
 * Every seller write path normalises through these functions; the rules are
 * pinned here so a path cannot drift by re-implementing "its own" check.
 */
import { describe, it, expect } from 'vitest'
import {
  validateListingWrite,
  validateListingPatch,
  resolveDeliveryTime,
  roundPrice,
  INSERT_STATUSES,
  SELLER_PATCH_STATUSES,
} from './validate'

const ITEMS = { categoryType: 'items' as const, currencyConfig: null }

const base = {
  title: 'Dragon Sword +5',
  description: 'sharp',
  price: 4.99,
  quantity: 3,
  min_quantity: 1,
  delivery_method: 'manual' as const,
  delivery_time: '1hr',
  images: ['https://cdn.example.com/a.png'],
  template_data: {},
  status: 'active' as const,
}

const existing = { quantity: 5, min_quantity: 1, is_unlimited: false, delivery_method: 'manual' }

describe('ACC-03 — delivery method / window are closed sets', () => {
  it('a manual listing must promise one of the offered windows (no free text)', () => {
    expect(validateListingWrite({ ...base, delivery_time: '5min' }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, delivery_time: 'whenever' }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, delivery_time: null }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, delivery_time: '24hr' }, ITEMS)).toMatchObject({ ok: true, value: { delivery_time: '24hr' } })
  })

  it('an instant listing stores delivery_time = instant whatever the client sent (BUG-07 server side)', () => {
    const r = validateListingWrite({ ...base, delivery_method: 'instant', delivery_time: '7d' }, ITEMS)
    expect(r).toMatchObject({ ok: true, value: { delivery_method: 'instant', delivery_time: 'instant' } })
    expect(resolveDeliveryTime('instant', null)).toEqual({ ok: true, value: 'instant' })
  })

  it('delivery_method outside manual|instant is rejected', () => {
    expect(validateListingWrite({ ...base, delivery_method: 'pigeon' }, ITEMS)).toMatchObject({ ok: false })
  })

  it('title 5..100 outside currency; images are http(s) URLs, at most 10', () => {
    expect(validateListingWrite({ ...base, title: 'abc' }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, title: 'x'.repeat(101) }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, title: '', quantity: 1000, min_quantity: 1 }, { categoryType: 'currency', currencyConfig: null })).toMatchObject({ ok: true })
    expect(validateListingWrite({ ...base, images: ['javascript:alert(1)'] }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, images: Array(11).fill('https://x.y/a.png') }, ITEMS)).toMatchObject({ ok: false })
  })

  it('patch: only the touched fields are validated, unknown keys are refused', () => {
    expect(validateListingPatch({ price: 2 }, ITEMS, existing)).toMatchObject({ ok: true, value: { price: 2 } })
    expect(validateListingPatch({ approved_by: 'me' }, ITEMS, existing)).toMatchObject({ ok: false })
    expect(validateListingPatch({ seller_id: 'other' }, ITEMS, existing)).toMatchObject({ ok: false })
    expect(validateListingPatch({}, ITEMS, existing)).toMatchObject({ ok: false })
  })

  it('patch: a delivery change re-runs the window rule against the merged method', () => {
    expect(validateListingPatch({ delivery_time: '3d' }, ITEMS, existing)).toMatchObject({ ok: true, value: { delivery_time: '3d' } })
    expect(validateListingPatch({ delivery_time: 'custom' }, ITEMS, existing)).toMatchObject({ ok: false })
    expect(validateListingPatch({ delivery_method: 'instant' }, ITEMS, existing)).toMatchObject({ ok: true, value: { delivery_time: 'instant' } })
    expect(validateListingPatch({ delivery_method: 'manual' }, ITEMS, { ...existing, delivery_method: 'instant' })).toMatchObject({ ok: false })
  })

  it('patch: status is limited to what a seller may set; moderation states are review-only', () => {
    expect([...SELLER_PATCH_STATUSES]).toEqual(['draft', 'active', 'paused', 'archived'])
    expect(validateListingPatch({ status: 'paused' }, ITEMS, existing)).toMatchObject({ ok: true })
    expect(validateListingPatch({ status: 'pending_approval' }, ITEMS, existing)).toMatchObject({ ok: false })
    expect(validateListingPatch({ status: 'sold' }, ITEMS, existing)).toMatchObject({ ok: false })
  })
})

describe('ACC-06 — server-side price validation', () => {
  const CURRENCY = { categoryType: 'currency' as const, currencyConfig: { price_floor: 0.005, price_ceiling: 0.02, min_quantity: 100, bundles: [] } }

  it('$0 and sub-cent prices are refused; 0.00004 does not round to a free listing', () => {
    expect(validateListingWrite({ ...base, price: 0 }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, price: 0.00004 }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, price: 0.009 }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, price: -5 }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, price: Number.NaN }, ITEMS)).toMatchObject({ ok: false })
  })

  it('price is stored at numeric(12,4) scale and capped at the column maximum (BUG-15 server side)', () => {
    expect(validateListingWrite({ ...base, price: 1.23456 }, ITEMS)).toMatchObject({ ok: true, value: { price: 1.2346 } })
    expect(validateListingWrite({ ...base, price: 1e9 }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, original_price: 0 }, ITEMS)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, original_price: null }, ITEMS)).toMatchObject({ ok: true, value: { original_price: null } })
  })

  it('currency listings must sit inside the admin floor / ceiling of the game config', () => {
    const cur = { ...base, title: '', price: 0.01, quantity: 1000, min_quantity: 100 }
    expect(validateListingWrite({ ...cur, price: 0.001 }, CURRENCY)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...cur, price: 0.05 }, CURRENCY)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...cur, price: 0.01 }, CURRENCY)).toMatchObject({ ok: true, value: { price: 0.01 } })
    // no config → only the absolute rules apply
    expect(validateListingWrite({ ...cur, price: 0.05 }, { categoryType: 'currency', currencyConfig: null })).toMatchObject({ ok: true })
  })

  it('patch: the same price rules apply to the offers-table inline editor', () => {
    expect(validateListingPatch({ price: 0 }, ITEMS, existing)).toMatchObject({ ok: false })
    expect(validateListingPatch({ price: 2.00005 }, ITEMS, existing)).toMatchObject({ ok: true, value: { price: 2.0001 } })
    expect(validateListingPatch({ price: 0.05 }, CURRENCY, existing)).toMatchObject({ ok: false })
  })
})

describe('ACC-05 — minimum order size comes from the config, bundle ids from the config (BUG-02/06/08 server side)', () => {
  const FLEX = { categoryType: 'currency' as const, currencyConfig: { min_quantity: 1, quantity_granularity: 'thousand' as const, bundles: [] } }
  const FLEX_500 = { categoryType: 'currency' as const, currencyConfig: { min_quantity: 500, bundles: [] } }
  const BUNDLED = { categoryType: 'currency' as const, currencyConfig: { min_quantity: 100, bundles: [{ id: 'vb-800', name: '800 V-Bucks', amount: 800 }] } }
  const cur = { ...base, title: '', price: 0.01 }

  it('flexible currency: the admin floor replaces the literal 100 (min 1 stays 1, a 10K stock is buyable)', () => {
    expect(validateListingWrite({ ...cur, quantity: 10, min_quantity: 1 }, FLEX)).toMatchObject({ ok: true, value: { min_quantity: 1, bundle_id: null } })
    // a crafted request cannot undercut a floor above 100
    expect(validateListingWrite({ ...cur, quantity: 5000, min_quantity: 50 }, FLEX_500)).toMatchObject({ ok: true, value: { min_quantity: 500 } })
    // no config row → floor 1 (parity with the wizard's resolveMinQuantity)
    expect(validateListingWrite({ ...cur, quantity: 5000, min_quantity: 1 }, { categoryType: 'currency', currencyConfig: null })).toMatchObject({ ok: true, value: { min_quantity: 1 } })
  })

  it('stock below the floor cannot be listed; the minimum is capped at the stock', () => {
    expect(validateListingWrite({ ...cur, quantity: 50, min_quantity: 1 }, FLEX_500)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, quantity: 3, min_quantity: 10 }, ITEMS)).toMatchObject({ ok: true, value: { min_quantity: 3 } })
    expect(validateListingWrite({ ...cur, quantity: 600, min_quantity: 900 }, FLEX_500)).toMatchObject({ ok: true, value: { min_quantity: 600 } })
  })

  it('bundle mode: bundle_id is required and must exist in the config; a bundle sells whole (min 1)', () => {
    expect(validateListingWrite({ ...cur, quantity: 3, min_quantity: 1, bundle_id: null }, BUNDLED)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...cur, quantity: 3, min_quantity: 1, bundle_id: 'from-another-game' }, BUNDLED)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...cur, quantity: 3, min_quantity: 7, bundle_id: 'vb-800' }, BUNDLED)).toMatchObject({ ok: true, value: { min_quantity: 1, bundle_id: 'vb-800' } })
  })

  it('a bundle_id on a flexible currency or any other category is refused', () => {
    expect(validateListingWrite({ ...cur, quantity: 1000, min_quantity: 1, bundle_id: 'vb-800' }, FLEX)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...base, bundle_id: 'vb-800' }, ITEMS)).toMatchObject({ ok: false })
  })

  it('patch: min/quantity edits obey the same floor and cap', () => {
    expect(validateListingPatch({ min_quantity: 10 }, ITEMS, existing)).toMatchObject({ ok: true, value: { min_quantity: 5 } })
    expect(validateListingPatch({ quantity: 50 }, FLEX_500, { ...existing, quantity: 1000, min_quantity: 500 })).toMatchObject({ ok: false })
    expect(validateListingPatch({ quantity: 50 }, ITEMS, { ...existing, is_unlimited: true })).toMatchObject({ ok: true })
  })
})

describe('numeric(12,4) price rounding', () => {
  it('rounds half away from zero at 4 decimals like Postgres', () => {
    expect(roundPrice(0.00005)).toBe(0.0001)
    expect(roundPrice(1.23456)).toBe(1.2346)
    expect(roundPrice(4.99)).toBe(4.99)
  })
})

describe('insert statuses', () => {
  it('a new listing is draft or active — nothing else (ACC-11)', () => {
    expect([...INSERT_STATUSES]).toEqual(['draft', 'active'])
  })
})
