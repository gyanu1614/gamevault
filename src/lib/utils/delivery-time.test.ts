import { describe, it, expect } from 'vitest'
import {
  parseDeliveryMinutes,
  formatDeliveryLabel,
  SELLER_DELIVERY_WINDOWS,
} from '@/lib/utils/delivery-time'

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

describe('seller delivery windows (day values)', () => {
  it('parses the day codes the wizard stores', () => {
    expect(parseDeliveryMinutes('2d')).toBe(2 * 1440)
    expect(parseDeliveryMinutes('3d')).toBe(3 * 1440)
    expect(parseDeliveryMinutes('5d')).toBe(5 * 1440)
    expect(parseDeliveryMinutes('7d')).toBe(7 * 1440)
  })

  it('labels day codes as days, not a raw "2D"', () => {
    expect(formatDeliveryLabel('1d')).toBe('1 Day')
    expect(formatDeliveryLabel('2d')).toBe('2 Days')
    expect(formatDeliveryLabel('7d')).toBe('7 Days')
  })

  it('keeps the existing minute and hour labels unchanged', () => {
    expect(formatDeliveryLabel('15min')).toBe('15 Mins')
    expect(formatDeliveryLabel('1hr')).toBe('1 Hour')
    expect(formatDeliveryLabel('6hr')).toBe('6 Hours')
  })

  it('offers 15 minutes to 7 days, with no instant, 5-minute or custom option', () => {
    const values = SELLER_DELIVERY_WINDOWS.map((w) => w.value)
    expect(values).toEqual(['15min', '30min', '1hr', '6hr', '12hr', '24hr', '2d', '3d', '5d', '7d'])
    expect(values).not.toContain('instant')
    expect(values).not.toContain('5min')
    expect(values).not.toContain('custom')
  })

  it('every window parses to a strictly increasing number of minutes', () => {
    const minutes = SELLER_DELIVERY_WINDOWS.map((w) => parseDeliveryMinutes(w.value, -1))
    expect(minutes.every((m) => m > 0)).toBe(true)
    for (let i = 1; i < minutes.length; i++) expect(minutes[i]).toBeGreaterThan(minutes[i - 1])
  })
})

describe('cancellation eligibility (>= 6h) via parseDeliveryMinutes', () => {
  // order-cancellation.ts replaced a substring matcher with
  // parseDeliveryMinutes(v, 0) / 60. These are the eligibility outcomes the
  // OLD matcher produced for every string it knew; they must not change.
  const hours = (v: string) => parseDeliveryMinutes(v, 0) / 60
  const legacy: Array<[string, boolean]> = [
    ['instant', false], ['5min', false], ['15min', false], ['20min', false],
    ['30min', false], ['1hr', false], ['0-1 hour', false], ['3hr', false],
    ['6hr', true], ['1-6 hour', true], ['12hr', true], ['6-12 hour', true],
    ['24hr', true], ['1 day', true], ['12-24 hour', true], ['1-24 hours', true],
    ['3 day', true], ['1-3 day', true],
  ]

  it.each(legacy)('%s keeps its old eligibility (%s)', (value, eligible) => {
    expect(hours(value) >= 6).toBe(eligible)
  })

  it('treats the new day windows as eligible (old matcher said 0 hours)', () => {
    for (const v of ['2d', '3d', '5d', '7d']) expect(hours(v) >= 6).toBe(true)
  })

  it('keeps unparseable values ineligible, as before', () => {
    expect(hours('whenever')).toBe(0)
    expect(hours('')).toBe(0)
  })
})
