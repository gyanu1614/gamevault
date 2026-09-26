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
    expect(validateListingWrite({ ...base, title: '' }, { categoryType: 'currency', currencyConfig: null })).toMatchObject({ ok: true })
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
