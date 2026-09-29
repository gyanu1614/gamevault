import { describe, expect, it } from 'vitest'
import { cancelRequestEligibility } from './cancel-request-eligibility'

const PAID = '2026-09-28T10:00:00Z'
const at = (h: number) => Date.parse(PAID) + h * 3_600_000

describe('cancelRequestEligibility', () => {
  const base = { status: 'paid', created_at: '2026-09-28T09:00:00Z', paid_at: PAID, deliveryTime: '12h' }
  it('long delivery, an hour after payment: eligible', () => {
    expect(cancelRequestEligibility({ ...base, now: at(1.01) })).toEqual({ eligible: true })
    expect(cancelRequestEligibility({ ...base, status: 'delivering', now: at(5) })).toEqual({ eligible: true })
  })
  it('the hour counts from payment, not from placing the order', () => {
    const r = cancelRequestEligibility({ ...base, now: at(0.5) })
    expect(r).toMatchObject({ eligible: false, reason: 'too_soon', opensAt: '2026-09-28T11:00:00.000Z' })
  })
  it('short deliveries use the overdue dispute instead', () => {
    expect(cancelRequestEligibility({ ...base, deliveryTime: '15min', now: at(3) })).toMatchObject({ eligible: false, reason: 'short_delivery' })
    expect(cancelRequestEligibility({ ...base, deliveryTime: null, now: at(3) })).toMatchObject({ eligible: false, reason: 'short_delivery' })
  })
  it('delivered, disputed, finished or unpaid orders cannot request', () => {
    for (const status of ['pending', 'delivered', 'disputed', 'completed', 'refunded', 'cancelled', 'processing']) {
      expect(cancelRequestEligibility({ ...base, status, now: at(3) })).toMatchObject({ eligible: false, reason: 'status' })
    }
    expect(cancelRequestEligibility({ ...base, status: 'delivering', delivered_at: PAID, now: at(3) })).toMatchObject({ reason: 'status' })
  })
})
