import { describe, it, expect } from 'vitest'
import { formatUnitPrice, formatRuleAmount, parseRuleAmount, RULE_DECIMALS } from './price-format'

describe('formatUnitPrice — per-unit prices never collapse to $0.00', () => {
  it('cents and above: 2 decimals, up to 4 when the price has them', () => {
    expect(formatUnitPrice(5)).toBe('$5.00')
    expect(formatUnitPrice(4.99)).toBe('$4.99')
    expect(formatUnitPrice(0.0123)).toBe('$0.0123')
    expect(formatUnitPrice(1234.5)).toBe('$1,234.50')
  })

  it('sub-cent: enough decimals for two significant digits, no scientific notation', () => {
    expect(formatUnitPrice(0.0055)).toBe('$0.0055')
    expect(formatUnitPrice(0.0013)).toBe('$0.0013')
    expect(formatUnitPrice(0.0000045)).toBe('$0.0000045')
    expect(formatUnitPrice(0.0000001)).toBe('$0.0000001')
  })

  it('zero / junk', () => {
    expect(formatUnitPrice(0)).toBe('$0.00')
    expect(formatUnitPrice(Number.NaN)).toBe('$0.00')
  })
})

describe('admin rule amounts (8 decimals)', () => {
  it('parses plain decimals up to 8 places; blank = not set', () => {
    expect(RULE_DECIMALS).toBe(8)
    expect(parseRuleAmount('0.0000001')).toEqual({ ok: true, value: 0.0000001 })
    expect(parseRuleAmount('16.49')).toEqual({ ok: true, value: 16.49 })
    expect(parseRuleAmount('  ')).toEqual({ ok: true, value: null })
    expect(parseRuleAmount('.5')).toEqual({ ok: true, value: 0.5 })
  })

  it('refuses more than 8 decimals, negatives, letters and exponent notation', () => {
    expect(parseRuleAmount('0.000000001')).toMatchObject({ ok: false })
    expect(parseRuleAmount('-1')).toMatchObject({ ok: false })
    expect(parseRuleAmount('1e-7')).toMatchObject({ ok: false })
    expect(parseRuleAmount('abc')).toMatchObject({ ok: false })
  })

  it('formats back without exponent notation or float noise', () => {
    expect(formatRuleAmount(0.0000001)).toBe('0.0000001')
    expect(formatRuleAmount(0.1 + 0.2)).toBe('0.3')
    expect(formatRuleAmount(10)).toBe('10')
    expect(formatRuleAmount(null)).toBe('')
  })
})
