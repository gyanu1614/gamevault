import { describe, expect, it } from 'vitest'
import { currencyUnitLabel, withCurrencyNavLabel } from './currency-nav-label'

describe('currency tab label', () => {
  const cats = [
    { name: 'Accounts', type: 'account' },
    { name: 'Currency', type: 'currency' },
    { name: 'Items', type: 'items' },
  ]
  it('renames only the currency category to the unit label', () => {
    expect(withCurrencyNavLabel(cats, 'Gems').map((c) => c.name)).toEqual(['Accounts', 'Gems', 'Items'])
  })
  it('keeps the stored name when the unit is unset or the generic default', () => {
    expect(withCurrencyNavLabel(cats, null)).toBe(cats)
    expect(withCurrencyNavLabel(cats, '  ')).toBe(cats)
    expect(currencyUnitLabel('Currency')).toBeNull()
    expect(currencyUnitLabel('units')).toBeNull()
    expect(currencyUnitLabel(' Tokens ')).toBe('Tokens')
  })
})
