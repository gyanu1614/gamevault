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

  it('images may be a same-site static path (older currency offers carry /games/<game>.png)', () => {
    const CURRENCY = { categoryType: 'currency' as const, currencyConfig: null }
    const cur = { ...base, title: '', quantity: 1000, min_quantity: 1 }
    expect(validateListingWrite({ ...cur, images: ['/games/gag.png'] }, CURRENCY)).toMatchObject({ ok: true })
    expect(validateListingWrite({ ...base, images: ['/games/fortnite.png'] }, ITEMS)).toMatchObject({ ok: true })
    // Never another host, a traversal, a query or a non-image.
    for (const bad of ['//evil.com/a.png', '/../etc/passwd.png', '/games/a.png?x=1', '/games/a.html', '/', 'games/a.png', '/\\evil.com/a.png']) {
      expect(validateListingWrite({ ...base, images: [bad] }, ITEMS), bad).toMatchObject({ ok: false })
    }
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

/**
 * D2 (2026-10-04) — "price must be at most $10 per unit for this game" on
 * every bundle listing above $10 (Fortnite 12,500 V-Bucks, 99 Nights 1400
 * Diamonds). The configs below are the prod blobs read on 2026-10-04: the
 * admin form saved DEFAULT_CURRENCY_CONFIG's hidden `price_ceiling: 10`, and
 * resolvePrice applied it to the bundle price as if it were a per-unit price.
 */
describe('D2 — bundle prices are judged per bundle; a cap applies only when an admin set one', () => {
  const bundleListing = { ...base, title: '', quantity: 3, min_quantity: 1 }
  const FORTNITE = {
    categoryType: 'currency' as const,
    currencyConfig: {
      price_floor: 10,
      price_ceiling: 10,
      min_quantity: 100,
      bundles: [{ id: 'vb-12500', name: '12,500 V-Bucks', amount: 12500 }],
    },
  }
  const NIGHTS = {
    categoryType: 'currency' as const,
    currencyConfig: {
      price_floor: 1,
      price_ceiling: 10,
      min_quantity: 100,
      bundles: [{ id: 'd-1400', name: '1400 Diamonds', amount: 1400 }],
    },
  }

  it('Fortnite 12,500 V-Bucks at $64.99 and 99 Nights 1400 Diamonds at $16.49 publish', () => {
    expect(validateListingWrite({ ...bundleListing, price: 64.99, bundle_id: 'vb-12500' }, FORTNITE)).toMatchObject({ ok: true, value: { price: 64.99 } })
    expect(validateListingWrite({ ...bundleListing, price: 16.49, bundle_id: 'd-1400' }, NIGHTS)).toMatchObject({ ok: true, value: { price: 16.49 } })
  })

  it('a bundle with a per-unit-style ceiling still passes: the per-unit cap never applies to a bundle', () => {
    const withUnitCap = { ...NIGHTS, currencyConfig: { ...NIGHTS.currencyConfig, price_ceiling: 0.02, price_max: 0.02 } }
    expect(validateListingWrite({ ...bundleListing, price: 16.49, bundle_id: 'd-1400' }, withUnitCap)).toMatchObject({ ok: true })
  })

  it('an explicit per-bundle maximum is enforced, in plain words', () => {
    const capped = { ...NIGHTS, currencyConfig: { ...NIGHTS.currencyConfig, bundle_price_max: 15 } }
    const res = validateListingWrite({ ...bundleListing, price: 16.49, bundle_id: 'd-1400' }, capped)
    expect(res).toMatchObject({ ok: false })
    expect(!res.ok && res.error).toMatch(/at most \$15\.00 per bundle/)
  })

  it('the per-bundle minimum (legacy floor) still applies', () => {
    const res = validateListingWrite({ ...bundleListing, price: 0.5, bundle_id: 'd-1400' }, NIGHTS)
    expect(res).toMatchObject({ ok: false })
    expect(!res.ok && res.error).toMatch(/at least \$1\.00 per bundle/)
  })

  it('flexible over an admin-set maximum is still refused (per unit)', () => {
    const FLEX_MAX = { categoryType: 'currency' as const, currencyConfig: { price_floor: 0.01, price_max: 2, quantity_granularity: 'thousand' as const, min_quantity: 1, bundles: [] } }
    const res = validateListingWrite({ ...base, title: '', price: 2.5, quantity: 100, min_quantity: 1 }, FLEX_MAX)
    expect(res).toMatchObject({ ok: false })
    expect(!res.ok && res.error).toMatch(/at most \$2\.00 per K/)
  })

  it('no maximum set → no cap (the legacy $10 default is not a maximum)', () => {
    const FLEX = { categoryType: 'currency' as const, currencyConfig: { price_floor: 1, price_ceiling: 10, quantity_granularity: 'thousand' as const, min_quantity: 1, bundles: [] } }
    expect(validateListingWrite({ ...base, title: '', price: 25, quantity: 100, min_quantity: 1 }, FLEX)).toMatchObject({ ok: true })
    expect(validateListingWrite({ ...base, title: '', price: 25, quantity: 100, min_quantity: 1 }, { categoryType: 'currency', currencyConfig: { min_quantity: 1, bundles: [] } })).toMatchObject({ ok: true })
  })

  it('patch: the offers-table price edit on a bundle listing uses the bundle rules', () => {
    const ex = { quantity: 3, min_quantity: 1, is_unlimited: false, delivery_method: 'manual', bundle_id: 'vb-12500' }
    expect(validateListingPatch({ price: 64.99 }, FORTNITE, ex)).toMatchObject({ ok: true })
  })
})

/**
 * D3 — Robux (prod: floor $0.0035, max $0.008 per Robux) sat entirely under
 * the absolute $0.01 listing floor, so no Robux listing could be published or
 * re-priced. Flexible currency is priced per unit at the column's 4 decimals;
 * ACC-06's point (no order can cost $0) is kept by requiring the smallest
 * order — price × minimum — to be at least $0.01.
 */
describe('D3 — sub-cent per-unit prices for flexible currency', () => {
  const ROBUX = { categoryType: 'currency' as const, currencyConfig: { price_floor: 0.0035, price_ceiling: 0.008, min_quantity: 100, bundles: [] } }
  const flex = { ...base, title: '', quantity: 10000, min_quantity: 100 }

  it('a $0.0055 Robux listing with a 100 minimum publishes', () => {
    expect(validateListingWrite({ ...flex, price: 0.0055 }, ROBUX)).toMatchObject({ ok: true, value: { price: 0.0055, min_quantity: 100 } })
  })

  it('still inside the admin range', () => {
    expect(validateListingWrite({ ...flex, price: 0.003 }, ROBUX)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...flex, price: 0.009 }, ROBUX)).toMatchObject({ ok: false })
  })

  it('the smallest possible order must cost at least $0.01', () => {
    const NO_RULES = { categoryType: 'currency' as const, currencyConfig: { min_quantity: 1, bundles: [] } }
    expect(validateListingWrite({ ...flex, price: 0.005, min_quantity: 1 }, NO_RULES)).toMatchObject({ ok: false })
    expect(validateListingWrite({ ...flex, price: 0.005, min_quantity: 2 }, NO_RULES)).toMatchObject({ ok: true })
    // rounds to $0.0000 at the column scale → refused, never a free listing
    expect(validateListingWrite({ ...flex, price: 0.00004 }, NO_RULES)).toMatchObject({ ok: false })
  })

  it('items and bundles keep the absolute $0.01 floor', () => {
    expect(validateListingWrite({ ...base, price: 0.005 }, ITEMS)).toMatchObject({ ok: false })
    const B = { categoryType: 'currency' as const, currencyConfig: { bundles: [{ id: 'b', name: 'B', amount: 1 }] } }
    expect(validateListingWrite({ ...base, title: '', price: 0.005, bundle_id: 'b' }, B)).toMatchObject({ ok: false })
  })

  it('patch: re-pricing a Robux listing to $0.0052 works; dropping the minimum under $0.01 total does not', () => {
    const ex = { quantity: 10000, min_quantity: 100, is_unlimited: false, delivery_method: 'manual' }
    expect(validateListingPatch({ price: 0.0052 }, ROBUX, ex)).toMatchObject({ ok: true, value: { price: 0.0052 } })
    const LOOSE = { categoryType: 'currency' as const, currencyConfig: { min_quantity: 1, bundles: [] } }
    expect(validateListingPatch({ min_quantity: 1 }, LOOSE, { ...ex, price: 0.005 } as typeof ex)).toMatchObject({ ok: false })
  })
})

describe('currency delivery method (Gamepass, UID / Login …) — admin list only', () => {
  const ON = {
    categoryType: 'currency' as const,
    currencyConfig: {
      min_quantity: 1,
      bundles: [],
      delivery_methods: { enabled: true, options: [{ id: 'gamepass', label: 'Gamepass', description: '' }] },
    },
  }
  const OFF = { categoryType: 'currency' as const, currencyConfig: { min_quantity: 1, bundles: [] } }
  const cur = { ...base, title: '', price: 0.01, quantity: 10 }

  it('stores an offered method id', () => {
    expect(validateListingWrite({ ...cur, delivery_method_type: 'gamepass' }, ON)).toMatchObject({
      ok: true,
      value: { delivery_method_type: 'gamepass' },
    })
  })

  it('rejects a method the admin does not offer', () => {
    expect(validateListingWrite({ ...cur, delivery_method_type: 'trade' }, ON)).toEqual({
      ok: false,
      error: 'Pick a delivery method from the list.',
    })
  })

  it('stores nothing when the game has the field off, or for non-currency listings', () => {
    expect(validateListingWrite({ ...cur, delivery_method_type: 'gamepass' }, OFF)).toMatchObject({ ok: true, value: { delivery_method_type: null } })
    expect(validateListingWrite({ ...base, delivery_method_type: 'gamepass' }, ITEMS)).toMatchObject({ ok: true, value: { delivery_method_type: null } })
  })

  it('an empty pick stays allowed (bulk upload, older clients)', () => {
    expect(validateListingWrite(cur, ON)).toMatchObject({ ok: true, value: { delivery_method_type: null } })
  })
})

describe('quick edit (patch) — delivery method is checked against the admin list too', () => {
  const ON = {
    categoryType: 'currency' as const,
    currencyConfig: { min_quantity: 1, bundles: [], delivery_methods: { enabled: true, options: [{ id: 'gamepass', label: 'Gamepass', description: '' }] } },
  }
  const row = { quantity: 100, min_quantity: 1, is_unlimited: false, delivery_method: 'manual', bundle_id: null }

  it('accepts an offered method', () => {
    expect(validateListingPatch({ delivery_method_type: 'gamepass' }, ON, row)).toMatchObject({ ok: true, value: { delivery_method_type: 'gamepass' } })
  })

  it('rejects one the admin does not offer', () => {
    expect(validateListingPatch({ delivery_method_type: 'trade' }, ON, row)).toEqual({ ok: false, error: 'Pick a delivery method from the list.' })
  })
})
