import { describe, it, expect } from 'vitest'
import { notDeliveredEligibility } from './not-delivered'

const paidAt = '2026-10-16T10:00:00.000Z'
const at = (min: number) => Date.parse(paidAt) + min * 60_000

describe('notDeliveredEligibility', () => {
  it('a 20-minute listing is not eligible at minute 19', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(19) }))
      .toEqual({ eligible: false, reason: 'not_overdue', dueAt: '2026-10-16T10:20:00.000Z' })
  })

  it('is eligible once the delivery time has passed', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(21) }))
      .toEqual({ eligible: true, dueAt: '2026-10-16T10:20:00.000Z' })
  })

  it('delivering orders are eligible too; delivered or closed ones are not', () => {
    expect(notDeliveredEligibility({ status: 'delivering', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(30) }).eligible).toBe(true)
    expect(notDeliveredEligibility({ status: 'paid', delivered_at: paidAt, paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(30) }))
      .toEqual({ eligible: false, reason: 'status' })
    expect(notDeliveredEligibility({ status: 'disputed', paid_at: paidAt, created_at: paidAt, deliveryTime: '20min', now: at(30) }))
      .toEqual({ eligible: false, reason: 'status' })
  })

  it('falls back to 60 minutes for an unparseable delivery time, like the order page', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: 'soon', now: at(59) }).eligible).toBe(false)
    expect(notDeliveredEligibility({ status: 'paid', paid_at: paidAt, created_at: paidAt, deliveryTime: 'soon', now: at(61) }).eligible).toBe(true)
  })

  it('counts from created_at when paid_at is missing', () => {
    expect(notDeliveredEligibility({ status: 'paid', paid_at: null, created_at: paidAt, deliveryTime: '1hr', now: at(61) }))
      .toEqual({ eligible: true, dueAt: '2026-10-16T11:00:00.000Z' })
  })
})
