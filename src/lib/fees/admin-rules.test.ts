import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_RISK_BAND_PCT,
  earliestBaseStartUtc,
  feeRuleErrorMessage,
  parsePct,
  parseUtcDate,
  riskBandForPct,
} from './admin-rules'

describe('admin fee rule helpers (pure)', () => {
  it('parsePct accepts 0–50 with ≤ 2 dp and rejects the rest', () => {
    expect(parsePct('10')).toEqual({ pct: 10 })
    expect(parsePct(12.5)).toEqual({ pct: 12.5 })
    expect(parsePct('0')).toEqual({ pct: 0 })
    expect(parsePct('50')).toEqual({ pct: 50 })
    expect(parsePct('50.01')).toMatchObject({ error: expect.stringMatching(/0% and 50%/) })
    expect(parsePct('-1')).toMatchObject({ error: expect.any(String) })
    expect(parsePct('7.125')).toMatchObject({ error: expect.stringMatching(/two decimal/) })
    expect(parsePct('abc')).toMatchObject({ error: expect.any(String) })
    expect(parsePct(undefined)).toMatchObject({ error: expect.any(String) })
  })

  it('parseUtcDate turns YYYY-MM-DD into 00:00 UTC and rejects nonsense', () => {
    expect(parseUtcDate('2026-10-06')).toEqual({ iso: '2026-10-06T00:00:00.000Z', ms: Date.UTC(2026, 9, 6) })
    expect(parseUtcDate('2026-02-30')).toMatchObject({ error: expect.stringMatching(/does not exist/) })
    expect(parseUtcDate('06/10/2026')).toMatchObject({ error: expect.any(String) })
    expect(parseUtcDate('')).toMatchObject({ error: expect.any(String) })
  })

  it('earliestBaseStartUtc is the first 00:00 UTC on/after now + notice', () => {
    const now = new Date('2026-09-22T07:15:00Z')
    expect(earliestBaseStartUtc(14, now).toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(earliestBaseStartUtc(14, new Date('2026-09-22T00:00:00Z')).toISOString()).toBe('2026-10-06T00:00:00.000Z')
    expect(earliestBaseStartUtc(0, new Date('2026-09-22T00:00:00Z')).toISOString()).toBe('2026-09-22T00:00:00.000Z')
  })

  it('riskBandForPct maps the three band rates and nothing else', () => {
    expect(ACCOUNT_RISK_BAND_PCT).toEqual({ low: 10, mid: 15, high: 20 })
    expect(riskBandForPct(10)).toBe('low')
    expect(riskBandForPct(15)).toBe('mid')
    expect(riskBandForPct(20)).toBe('high')
    expect(riskBandForPct(12)).toBe('custom')
    expect(riskBandForPct(null)).toBeNull()
  })

  it('feeRuleErrorMessage rewords the database refusals', () => {
    expect(feeRuleErrorMessage({ code: '23P01', message: 'conflicting key value violates exclusion constraint "fee_rules_no_overlapping_base"' }))
      .toMatch(/overlaps an existing base rate/)
    expect(feeRuleErrorMessage({ code: 'P0001', message: 'fee_rules: a base rate of 15.00% is already scheduled for this category from 2026-11-01 00:00:00+00 — cancel it first' }))
      .toBe('A base rate is already scheduled from 2026-11-01 — cancel it first, then schedule the new one.')
    expect(feeRuleErrorMessage({ code: '23514', message: 'fee_rules: a base rate change needs 14 days notice (earliest permitted start: 2026-10-06 12:00:00.123+00)' }))
      .toBe("A base rate change needs 14 days' notice — the earliest permitted start is 2026-10-06.")
    expect(feeRuleErrorMessage({ code: '23514', message: 'new row for relation "fee_rules" violates check constraint "fee_rules_promo_bounded"' }))
      .toBe('A promotional rate must have an end date.')
    expect(feeRuleErrorMessage({ message: 'fee_rules: rule x started at y — sellers have been charged under it; schedule a new rate instead' }))
      .toMatch(/already started/)
    expect(feeRuleErrorMessage(null)).toBe('The fee rule could not be saved.')
  })
})
