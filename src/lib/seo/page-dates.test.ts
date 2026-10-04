import { describe, it, expect } from 'vitest'

import { SITE_PAGES_UPDATED, legalLastUpdatedIso, parseLongDate } from '@/lib/seo/page-dates'

describe('parseLongDate', () => {
  it('turns the legal pack "12 July 2026" into an ISO date', () => {
    expect(parseLongDate('12 July 2026')).toBe('2026-07-12')
    expect(parseLongDate('1 January 2027')).toBe('2027-01-01')
  })
  it('throws on a format it does not know instead of inventing a date', () => {
    expect(() => parseLongDate('July 2026')).toThrow()
    expect(() => parseLongDate('12 Smarch 2026')).toThrow()
  })
})

describe('page dates are real, past, W3C dates (never "now")', () => {
  it('legal pages carry the legal pack\'s own "last updated" date', () => {
    expect(legalLastUpdatedIso()).toBe('2026-07-12')
  })
  it.each(Object.entries(SITE_PAGES_UPDATED))('%s', (_name, date) => {
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(date).getTime()).toBeLessThanOrEqual(Date.now())
  })
})
