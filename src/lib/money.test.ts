import { describe, it, expect } from 'vitest'
import {
  money,
  zero,
  add,
  subtract,
  negate,
  sum,
  compare,
  isEqual,
  isZero,
  isNegative,
  assertNonNegative,
  splitPercent,
  fromDecimal,
  toDecimal,
  format,
  scaleOf,
} from '@/lib/money'
import { CurrencyMismatchError, InvalidMoneyError, NegativeAmountError } from '@/lib/errors'

describe('money: construction & scale', () => {
  it('normalizes currency code to uppercase', () => {
    expect(money(100n, 'eur').currency).toBe('EUR')
  })
  it('knows fiat scales, defaults to 2', () => {
    expect(scaleOf('EUR')).toBe(2)
    expect(scaleOf('xyz')).toBe(2)
  })
  it('zero is 0 minor units', () => {
    expect(zero('EUR').amountMinor).toBe(0n)
  })
})

describe('money: decimal round-trip (the float edge)', () => {
  it('parses a decimal string to exact minor units', () => {
    expect(fromDecimal('49.99', 'EUR').amountMinor).toBe(4999n)
    expect(fromDecimal('0.01', 'EUR').amountMinor).toBe(1n)
    expect(fromDecimal('1000', 'EUR').amountMinor).toBe(100000n)
    expect(fromDecimal('-5.00', 'EUR').amountMinor).toBe(-500n)
  })
  it('round-trips string -> Money -> string', () => {
    for (const s of ['0.00', '0.01', '49.99', '1234.50', '-7.25']) {
      expect(toDecimal(fromDecimal(s, 'EUR'))).toBe(s)
    }
  })
  it('accepts a number but converts at the currency scale', () => {
    expect(fromDecimal(49.99, 'EUR').amountMinor).toBe(4999n)
    expect(fromDecimal(0.1, 'EUR').amountMinor).toBe(10n)
  })
  it('rejects more decimal places than the currency allows', () => {
    expect(() => fromDecimal('1.999', 'EUR')).toThrow(InvalidMoneyError)
  })
  it('rejects non-numeric strings', () => {
    expect(() => fromDecimal('abc', 'EUR')).toThrow(InvalidMoneyError)
    expect(() => fromDecimal('1.2.3', 'EUR')).toThrow(InvalidMoneyError)
  })
})

describe('money: exact arithmetic (no float drift)', () => {
  it('0.1 + 0.2 === 0.30 exactly', () => {
    const r = add(fromDecimal('0.10', 'EUR'), fromDecimal('0.20', 'EUR'))
    expect(r.amountMinor).toBe(30n)
    expect(toDecimal(r)).toBe('0.30')
  })
  it('adds, subtracts, negates', () => {
    expect(add(money(100n, 'EUR'), money(250n, 'EUR')).amountMinor).toBe(350n)
    expect(subtract(money(100n, 'EUR'), money(250n, 'EUR')).amountMinor).toBe(-150n)
    expect(negate(money(100n, 'EUR')).amountMinor).toBe(-100n)
  })
  it('sums a list', () => {
    expect(sum([money(1n, 'EUR'), money(2n, 'EUR'), money(3n, 'EUR')]).amountMinor).toBe(6n)
  })
  it('refuses to sum an empty list (currency unknown)', () => {
    expect(() => sum([])).toThrow(InvalidMoneyError)
  })
})

describe('money: currency safety', () => {
  it('throws on mixed-currency add', () => {
    expect(() => add(money(1n, 'EUR'), money(1n, 'GBP'))).toThrow(CurrencyMismatchError)
  })
  it('throws on mixed-currency subtract and compare', () => {
    expect(() => subtract(money(1n, 'EUR'), money(1n, 'USD'))).toThrow(CurrencyMismatchError)
    expect(() => compare(money(1n, 'EUR'), money(1n, 'USD'))).toThrow(CurrencyMismatchError)
  })
})

describe('money: comparison & guards', () => {
  it('compares within a currency', () => {
    expect(compare(money(1n, 'EUR'), money(2n, 'EUR'))).toBe(-1)
    expect(compare(money(2n, 'EUR'), money(2n, 'EUR'))).toBe(0)
    expect(compare(money(3n, 'EUR'), money(2n, 'EUR'))).toBe(1)
    expect(isEqual(money(2n, 'EUR'), money(2n, 'EUR'))).toBe(true)
    expect(isZero(zero('EUR'))).toBe(true)
    expect(isNegative(money(-1n, 'EUR'))).toBe(true)
  })
  it('assertNonNegative throws on negative', () => {
    expect(() => assertNonNegative(money(-1n, 'EUR'), 'balance')).toThrow(NegativeAmountError)
    expect(assertNonNegative(money(0n, 'EUR'), 'balance').amountMinor).toBe(0n)
  })
})

describe('money: splitPercent (reserve split — never drops a minor unit)', () => {
  it('splits cleanly when divisible', () => {
    const { part, rest } = splitPercent(money(1000n, 'EUR'), 10) // 100 / 900
    expect(part.amountMinor).toBe(100n)
    expect(rest.amountMinor).toBe(900n)
  })
  it('part + rest always equals the original (rounding goes to rest)', () => {
    // 92.00 * 10% = 9.20 exactly; but try a value that rounds.
    const total = money(9201n, 'EUR') // 92.01
    const { part, rest } = splitPercent(total, 10)
    // 92.01 * 10% = 9.201 -> half-up -> 9.20 (920), rest 8281
    expect(part.amountMinor).toBe(920n)
    expect(rest.amountMinor).toBe(8281n)
    expect(add(part, rest).amountMinor).toBe(total.amountMinor) // invariant: no cent lost
  })
  it('half-up rounding on the boundary', () => {
    // 1.05 * 50% = 0.525 -> half-up -> 0.53 (53)
    const { part, rest } = splitPercent(money(105n, 'EUR'), 50)
    expect(part.amountMinor).toBe(53n)
    expect(rest.amountMinor).toBe(52n)
    expect(add(part, rest).amountMinor).toBe(105n)
  })
  it('0% and 100% are identity edges', () => {
    expect(splitPercent(money(500n, 'EUR'), 0).part.amountMinor).toBe(0n)
    expect(splitPercent(money(500n, 'EUR'), 100).part.amountMinor).toBe(500n)
  })
  it('property: for many amounts, part+rest reconstructs the total', () => {
    for (let cents = 0n; cents <= 2000n; cents += 7n) {
      for (const pct of [5, 10, 15, 33, 50, 90]) {
        const total = money(cents, 'EUR')
        const { part, rest } = splitPercent(total, pct)
        expect(add(part, rest).amountMinor).toBe(cents)
      }
    }
  })
  it('rejects out-of-range percent', () => {
    expect(() => splitPercent(money(1n, 'EUR'), -1)).toThrow(InvalidMoneyError)
    expect(() => splitPercent(money(1n, 'EUR'), 101)).toThrow(InvalidMoneyError)
  })
})

describe('money: format', () => {
  it('renders currency + decimal', () => {
    expect(format(money(4999n, 'EUR'))).toBe('EUR 49.99')
    expect(format(money(-500n, 'GBP'))).toBe('GBP -5.00')
  })
})
