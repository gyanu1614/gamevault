import { describe, it, expect } from 'vitest'
import { ruleTextsOf, parseRuleTexts, flexibleExample, bundleExample } from './price-rule-form'

describe('ruleTextsOf', () => {
  it('shows tiny amounts in plain decimals and drops the legacy $10 default', () => {
    expect(ruleTextsOf({ price_floor: 0.0000001, price_ceiling: 10 })).toEqual({ unitMin: '0.0000001', unitMax: '', bundleMin: '', bundleMax: '' })
    expect(ruleTextsOf({ price_floor: 1, price_ceiling: 10, bundles: [{}] })).toEqual({ unitMin: '', unitMax: '', bundleMin: '1', bundleMax: '' })
  })
})

describe('parseRuleTexts', () => {
  const blank = { unitMin: '', unitMax: '', bundleMin: '', bundleMax: '' }

  it('8-decimal minimum accepted; blanks are "no rule"', () => {
    expect(parseRuleTexts({ ...blank, unitMin: '0.0000001' })).toEqual({
      ok: true,
      value: { unitMin: 0.0000001, unitMax: null, bundleMin: null, bundleMax: null },
    })
  })

  it('plain-word errors: bad amount, max under min, a max no listing can meet', () => {
    const bad = parseRuleTexts({ ...blank, unitMin: '0.000000001' })
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.errors.unitMin).toMatch(/8 decimal places/)
    const inverted = parseRuleTexts({ ...blank, bundleMin: '20', bundleMax: '10' })
    expect(!inverted.ok && inverted.errors.bundleMax).toMatch(/lower than the minimum/)
    const tiny = parseRuleTexts({ ...blank, unitMax: '0.00001' })
    expect(!tiny.ok && tiny.errors.unitMax).toMatch(/block every listing/)
  })
})

describe('live examples', () => {
  it('the owner’s Sheckles example', () => {
    expect(
      flexibleExample({ unitMin: 0.0045, unitMax: null, granularity: 'thousand', unitLabel: 'Sheckles', minQuantity: 1 }),
    ).toBe('A seller listing 1,000 K Sheckles (1,000,000 Sheckles) at $0.0045 per K ($0.0000045 each) charges $4.50.')
  })

  it('unit currencies read "each"; the minimum order is respected', () => {
    expect(
      flexibleExample({ unitMin: 0.0055, unitMax: null, granularity: 'unit', unitLabel: 'Robux', minQuantity: 100 }),
    ).toBe('A seller listing 1,000 Robux at $0.0055 each charges $5.50.')
    expect(flexibleExample({ unitMin: null, unitMax: null, granularity: 'unit', unitLabel: 'Robux', minQuantity: 1 })).toBeNull()
  })

  it('bundles', () => {
    expect(bundleExample({ bundleMin: 1, bundleMax: 40, bundleName: '1400 Diamonds' })).toBe('A seller listing “1400 Diamonds” can charge from $1.00 to $40.00.')
    expect(bundleExample({ bundleMin: null, bundleMax: null, bundleName: null })).toBe('A seller listing a bundle can charge any price from $0.01.')
  })
})
