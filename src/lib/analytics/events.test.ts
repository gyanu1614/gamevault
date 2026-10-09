import { describe, expect, it } from 'vitest'
import { cleanEventProps, ANALYTICS_EVENTS } from './events'

describe('event catalogue', () => {
  it('names every funnel step once', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length)
    for (const e of [
      'listing_viewed',
      'checkout_started',
      'checkout_submitted',
      'promo_code_applied',
      'order_paid',
      'seller_banner_clicked',
      'founding_step_viewed',
      'founding_step_completed',
      'seller_first_listing_published',
      'seller_first_sale',
    ]) {
      expect(ANALYTICS_EVENTS).toContain(e)
    }
  })
})

describe('cleanEventProps', () => {
  it('keeps short strings, finite numbers, booleans and nulls', () => {
    expect(cleanEventProps({ game: 'adopt-me', step: 2, ok: true, promo: null })).toEqual({
      game: 'adopt-me',
      step: 2,
      ok: true,
      promo: null,
    })
  })

  it('drops objects, arrays, NaN and long free text', () => {
    expect(cleanEventProps({ a: { b: 1 }, list: [1], n: Number.NaN, note: 'x'.repeat(201), ok: 'y' })).toEqual({ ok: 'y' })
  })

  it('drops personal-data keys and values that look like an email', () => {
    expect(cleanEventProps({ email: 'a@b.com', buyer: 'a@b.com', name: 'Alex', game: 'mm2' })).toEqual({ game: 'mm2' })
  })
})
