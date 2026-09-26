import { describe, it, expect } from 'vitest'
import {
  EM_DASH,
  balanceLabel,
  decimal,
  finiteOrNull,
  money,
  percentFromRate,
  signedMoney,
} from './format-amount'

const SYMBOLS = { USD: '$', EUR: '€' }

describe('finiteOrNull', () => {
  it('keeps finite numbers, including zero and negatives', () => {
    expect(finiteOrNull(0)).toBe(0)
    expect(finiteOrNull(-4.5)).toBe(-4.5)
  })

  it('rejects the values that made .toFixed() throw or print NaN', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, '12', {}]) {
      expect(finiteOrNull(bad)).toBeNull()
    }
  })
})

describe('money', () => {
  it('formats a number to two decimals', () => {
    expect(money(12.3)).toBe('$12.30')
    expect(money(0)).toBe('$0.00')
  })

  // The regression: these inputs previously threw
  // "Cannot read properties of undefined (reading 'toFixed')".
  it('returns a placeholder instead of throwing on a missing amount', () => {
    expect(money(undefined)).toBe(EM_DASH)
    expect(money(null)).toBe(EM_DASH)
    expect(money(NaN)).toBe(EM_DASH)
  })
})

describe('signedMoney', () => {
  it('signs ledger amounts', () => {
    expect(signedMoney(5)).toBe('+$5.00')
    expect(signedMoney(-5)).toBe('-$5.00')
  })

  it('falls back for a missing amount', () => {
    expect(signedMoney(undefined)).toBe(EM_DASH)
  })
})

describe('decimal', () => {
  it('honours the requested precision', () => {
    expect(decimal(4.26, 1)).toBe('4.3')
    expect(decimal(4)).toBe('4.00')
  })

  it('falls back for a missing value (a seller with no rating)', () => {
    expect(decimal(undefined, 1)).toBe(EM_DASH)
    expect(decimal(null, 1)).toBe(EM_DASH)
  })
})

describe('percentFromRate', () => {
  it('renders a stored fraction as a percentage', () => {
    expect(percentFromRate(0.085)).toBe('8.50%')
  })

  it('returns null so the caller can drop the clause entirely', () => {
    expect(percentFromRate(undefined)).toBeNull()
    expect(percentFromRate(null)).toBeNull()
  })
})

describe('balanceLabel', () => {
  it('joins non-zero balances', () => {
    expect(
      balanceLabel(
        [
          { currency: 'USD', amount: 1 },
          { currency: 'EUR', amount: 2 },
        ],
        SYMBOLS,
      ),
    ).toBe('$1.00 · €2.00')
  })

  it('shows the first row when every balance is zero', () => {
    expect(
      balanceLabel(
        [
          { currency: 'USD', amount: 0 },
          { currency: 'EUR', amount: 0 },
        ],
        SYMBOLS,
      ),
    ).toBe('$0.00')
  })

  it('prefixes an unknown currency with its code', () => {
    expect(balanceLabel([{ currency: 'GBP', amount: 3 }], SYMBOLS)).toBe('GBP 3.00')
  })

  it('skips rows with a missing amount rather than throwing', () => {
    const rows = [{ currency: 'USD' }, { currency: 'EUR', amount: 2 }] as any
    expect(balanceLabel(rows, SYMBOLS)).toBe('€2.00')
  })

  it('falls back when there are no usable balances at all', () => {
    expect(balanceLabel([], SYMBOLS)).toBe(EM_DASH)
    expect(balanceLabel(undefined, SYMBOLS)).toBe(EM_DASH)
    expect(balanceLabel([{ currency: 'USD' }] as any, SYMBOLS)).toBe(EM_DASH)
  })
})
