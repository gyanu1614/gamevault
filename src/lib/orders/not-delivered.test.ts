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

describe('responseWindowMinutes / windowSpan', () => {
  it('is the listing delivery time, never under 15 minutes or over 24 hours', async () => {
    const { responseWindowMinutes } = await import('./not-delivered')
    expect(responseWindowMinutes('20min')).toBe(20)
    expect(responseWindowMinutes('instant')).toBe(15) // parses to 5
    expect(responseWindowMinutes('5min')).toBe(15)
    expect(responseWindowMinutes('1hr')).toBe(60)
    expect(responseWindowMinutes('3 days')).toBe(1440)
    expect(responseWindowMinutes('1-24 hours')).toBe(1440)
    expect(responseWindowMinutes(null)).toBe(60) // the order page's 60-minute fallback
  })

  it('reads as minutes or whole hours', async () => {
    const { windowSpan } = await import('./not-delivered')
    expect(windowSpan(20)).toBe('20 minutes')
    expect(windowSpan(60)).toBe('1 hour')
    expect(windowSpan(90)).toBe('90 minutes')
    expect(windowSpan(1440)).toBe('24 hours')
  })
})
