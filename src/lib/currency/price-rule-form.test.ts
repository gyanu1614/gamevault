import { describe, it, expect } from 'vitest'
import { ruleTextsOf, parseRuleTexts, flexibleExample, bundleExample, perSingleUnitText } from './price-rule-form'
import { isRuleAmountInput } from './price-format'
import { priceRulesForSave } from './price-rules'

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

// Owner bug 2026-10-04: "I can't enter 0.00001 for Grow a Garden's minimum —
// it only allows 1." The released form used <input type="number"
// step="0.0001">, which the browser refuses for 0.00001. These pin the
// text-field path end to end at 8 decimals for every Unit Size.
describe('8-decimal amounts for per-unit and per-K/M rules (GaG regression)', () => {
  const blank = { unitMin: '', unitMax: '', bundleMin: '', bundleMax: '' }

  it('every keystroke on the way to 0.00001 is accepted by the field', () => {
    for (const partial of ['0', '0.', '0.0', '0.0000', '0.00001', '0.00000001']) {
      expect(isRuleAmountInput(partial)).toBe(true)
    }
    expect(isRuleAmountInput('0.000000001')).toBe(false)
  })

  it('0.00001 parses as a minimum (unit and bundle) and survives save → reload', () => {
    const parsed = parseRuleTexts({ ...blank, unitMin: '0.00001', bundleMin: '0.00001' })
    expect(parsed).toEqual({
      ok: true,
      value: { unitMin: 0.00001, unitMax: null, bundleMin: 0.00001, bundleMax: null },
    })
    const saved = priceRulesForSave({ price_floor: 1, price_ceiling: 10, quantity_granularity: 'thousand' }, parsed.value)
    expect(saved.price_floor).toBe(0.00001)
    expect(ruleTextsOf(saved).unitMin).toBe('0.00001')
  })

  it('shows what a per-K / per-M rule means for ONE unit', () => {
    expect(perSingleUnitText(0.01, 'thousand', 'Sheckles')).toBe('= $0.00001 per Sheckles')
    expect(perSingleUnitText(10, 'million', 'Tokens')).toBe('= $0.00001 per Tokens')
    expect(perSingleUnitText(0.0045, 'thousand', '')).toBe('= $0.0000045 per unit')
    expect(perSingleUnitText(0.0001, 'million', 'Tokens')).toBe('= less than $0.00000001 per Tokens')
    expect(perSingleUnitText(0.5, 'unit', 'Robux')).toBeNull()
    expect(perSingleUnitText(null, 'thousand', 'Sheckles')).toBeNull()
  })
})
