import { describe, it, expect } from 'vitest'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

describe('parseDeliveryMinutes', () => {
  it('parses the wizard minute options', () => {
    expect(parseDeliveryMinutes('5min')).toBe(5)
    expect(parseDeliveryMinutes('15min')).toBe(15)
    expect(parseDeliveryMinutes('20min')).toBe(20)
    expect(parseDeliveryMinutes('30min')).toBe(30)
  })
  it('parses the wizard hour options', () => {
    expect(parseDeliveryMinutes('1hr')).toBe(60)
    expect(parseDeliveryMinutes('3hr')).toBe(180)
    expect(parseDeliveryMinutes('6hr')).toBe(360)
    expect(parseDeliveryMinutes('12hr')).toBe(720)
    expect(parseDeliveryMinutes('24hr')).toBe(1440)
  })
  it('tolerates spacing and plural/word units', () => {
    expect(parseDeliveryMinutes('20 min')).toBe(20)
    expect(parseDeliveryMinutes('3 hours')).toBe(180)
    expect(parseDeliveryMinutes('1 hour')).toBe(60)
    expect(parseDeliveryMinutes('1 day')).toBe(1440)
  })
  it('uses the UPPER bound of a range', () => {
    expect(parseDeliveryMinutes('1-24 hours')).toBe(24 * 60) // 1440
    expect(parseDeliveryMinutes('15-30min')).toBe(30)
  })
  it('treats instant as a short SLA', () => {
    expect(parseDeliveryMinutes('instant')).toBe(5)
  })
  it('bare number assumes minutes', () => {
    expect(parseDeliveryMinutes('45')).toBe(45)
  })
  it('falls back to default (60) on null/garbage', () => {
    expect(parseDeliveryMinutes(null)).toBe(60)
    expect(parseDeliveryMinutes(undefined)).toBe(60)
    expect(parseDeliveryMinutes('')).toBe(60)
    expect(parseDeliveryMinutes('whenever')).toBe(60)
    expect(parseDeliveryMinutes('soon-ish', 90)).toBe(90) // custom fallback
  })
  it('the bug case: 20min listing is NOT 60 min', () => {
    expect(parseDeliveryMinutes('20min')).not.toBe(60)
    expect(parseDeliveryMinutes('20min')).toBe(20)
  })
})
