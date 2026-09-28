import { describe, expect, it } from 'vitest'
import { utcPeriods } from './periods'

describe('utcPeriods', () => {
  it('starts today and the month at UTC midnight, whatever the local zone', () => {
    const p = utcPeriods(new Date('2026-09-27T23:30:00-07:00')) // 06:30 UTC on the 28th
    expect(p.todayStart.toISOString()).toBe('2026-09-28T00:00:00.000Z')
    expect(p.monthStart.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(p.prevMonthStart.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('January rolls the previous month back to December', () => {
    const p = utcPeriods(new Date('2027-01-15T12:00:00Z'))
    expect(p.monthStart.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(p.prevMonthStart.toISOString()).toBe('2026-12-01T00:00:00.000Z')
  })
})
