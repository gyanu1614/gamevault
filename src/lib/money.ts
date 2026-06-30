/**
 * Money — the one correct representation of money in the codebase.
 *
 * THE RULE (from the money-layer spec): money is integer **minor units**
 * (e.g. cents) held as `bigint`, tagged with an ISO currency code. We NEVER
 * do float math on money. The only places a decimal touches money are the
 * explicit edges: `fromDecimal` (parsing provider/DB strings in) and
 * `toDecimal`/`format` (rendering out). Everything in between is exact integer
 * arithmetic, so 0.1 + 0.2 is exactly 0.30 and nothing ever silently drops a
 * cent.
 *
 * `amountMinor` is a bigint count of the smallest unit for the currency
 * (`scale` decimal places). For 2-dp currencies (EUR/GBP/USD), 100 minor = 1.00.
 */

import {
  CurrencyMismatchError,
  InvalidMoneyError,
  NegativeAmountError,
} from '@/lib/errors'

export interface Money {
  readonly amountMinor: bigint
  readonly currency: string
}

/**
 * Decimal places per currency. Default is 2. Crypto settles to fiat (EUR) in
 * our flow, so we only need fiat scales here; extend if a 0-/3-dp currency
 * ever enters the ledger. Currency codes are normalized to UPPERCASE.
 */
const CURRENCY_SCALE: Record<string, number> = {
  EUR: 2,
  GBP: 2,
  USD: 2,
}
const DEFAULT_SCALE = 2

/** Decimal places (scale) for a currency. */
export function scaleOf(currency: string): number {
  return CURRENCY_SCALE[currency.toUpperCase()] ?? DEFAULT_SCALE
}

/** Construct Money directly from a bigint minor-unit amount. */
export function money(amountMinor: bigint, currency: string): Money {
  return { amountMinor, currency: currency.toUpperCase() }
}

/** Zero in a given currency. */
export function zero(currency: string): Money {
  return money(0n, currency)
}

// ─── Currency guard ───────────────────────────────────────────────
function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency)
  }
}

// ─── Arithmetic (exact integer) ───────────────────────────────────

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amountMinor + b.amountMinor, a.currency)
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amountMinor - b.amountMinor, a.currency)
}

/** Negate (e.g. to express a debit/credit sign). */
export function negate(a: Money): Money {
  return money(-a.amountMinor, a.currency)
}

/** Sum a list; requires at least one element (currency is inferred from it). */
export function sum(items: Money[]): Money {
  if (items.length === 0) {
    throw new InvalidMoneyError('[]', 'cannot sum an empty list (currency unknown)')
  }
  return items.reduce((acc, m) => add(acc, m))
}

// ─── Comparison ───────────────────────────────────────────────────

/** -1 if a<b, 0 if equal, 1 if a>b. Throws on currency mismatch. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b)
  if (a.amountMinor < b.amountMinor) return -1
  if (a.amountMinor > b.amountMinor) return 1
  return 0
}

export const isEqual = (a: Money, b: Money): boolean => compare(a, b) === 0
export const isGreaterThan = (a: Money, b: Money): boolean => compare(a, b) === 1
export const isLessThan = (a: Money, b: Money): boolean => compare(a, b) === -1
export const isZero = (a: Money): boolean => a.amountMinor === 0n
export const isNegative = (a: Money): boolean => a.amountMinor < 0n
export const isPositive = (a: Money): boolean => a.amountMinor > 0n

/** Assert non-negative (used where a balance/charge must never be < 0). */
export function assertNonNegative(a: Money, context: string): Money {
  if (a.amountMinor < 0n) throw new NegativeAmountError(`${context} (${format(a)})`)
  return a
}

// ─── Percentage split (no minor units lost) ───────────────────────

/**
 * splitPercent — split an amount into `pct%` and the remainder, with the
 * rounding remainder assigned to the *remainder* leg so the two pieces always
 * sum back to exactly the original. Used for the reserve split (e.g. 10% to
 * seller_reserve, 90% to seller_available) where dropping a cent would
 * unbalance the ledger.
 *
 * Returns `{ part, rest }` where `part` is `round(amount * pct/100)` (half-up)
 * and `rest = amount - part`. `pct` is a number in [0,100].
 */
export function splitPercent(
  amount: Money,
  pct: number
): { part: Money; rest: Money } {
  if (pct < 0 || pct > 100) {
    throw new InvalidMoneyError(String(pct), 'percent must be between 0 and 100')
  }
  // Work in a scaled-integer domain to keep half-up rounding exact:
  // part = round(amount * pct / 100). Multiply by 100 (basis) then divide.
  const basisPct = BigInt(Math.round(pct * 100)) // pct as basis points*100, integer
  const numerator = amount.amountMinor * basisPct // amount * pct * 100
  const denominator = 10000n // 100 (pct) * 100 (basis)
  const part = roundedDiv(numerator, denominator)
  const partMoney = money(part, amount.currency)
  return { part: partMoney, rest: subtract(amount, partMoney) }
}

/** Integer division with half-up rounding, sign-aware. */
function roundedDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new InvalidMoneyError('div', 'division by zero')
  }
  const negative = numerator < 0n !== denominator < 0n
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  const q = n / d
  const r = n % d
  // round half up: if remainder*2 >= denominator, bump
  const rounded = r * 2n >= d ? q + 1n : q
  return negative ? -rounded : rounded
}

// ─── Decimal edges (the ONLY float/string ↔ money boundary) ───────

/**
 * fromDecimal — parse a decimal string ("49.99") or number into Money, exactly.
 *
 * Prefer passing a STRING (from a provider/DB), which is parsed without any
 * float involvement. A `number` is accepted for convenience but is converted
 * via its string form and validated against the currency scale — pass strings
 * for anything authoritative.
 */
export function fromDecimal(value: string | number, currency: string): Money {
  const scale = scaleOf(currency)
  const str = typeof value === 'number' ? numberToDecimalString(value, scale) : value.trim()

  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new InvalidMoneyError(str, 'not a valid decimal number')
  }

  const negative = str.startsWith('-')
  const unsigned = negative ? str.slice(1) : str
  const [intPart, fracPartRaw = ''] = unsigned.split('.')

  if (fracPartRaw.length > scale) {
    throw new InvalidMoneyError(str, `more decimal places than ${currency} allows (${scale})`)
  }
  const fracPart = fracPartRaw.padEnd(scale, '0')

  const minor = BigInt(intPart) * 10n ** BigInt(scale) + BigInt(fracPart || '0')
  return money(negative ? -minor : minor, currency)
}

/** Convert a JS number to a fixed-scale decimal string without float drift surprises. */
function numberToDecimalString(value: number, scale: number): string {
  if (!Number.isFinite(value)) {
    throw new InvalidMoneyError(String(value), 'not a finite number')
  }
  // toFixed gives a stable string at the currency scale; we then validate it.
  return value.toFixed(scale)
}

/** toDecimal — render Money as a plain decimal string ("49.99"). For display/serialization. */
export function toDecimal(m: Money): string {
  const scale = scaleOf(m.currency)
  const negative = m.amountMinor < 0n
  const abs = negative ? -m.amountMinor : m.amountMinor
  const divisor = 10n ** BigInt(scale)
  const intPart = abs / divisor
  const fracPart = abs % divisor
  const sign = negative ? '-' : ''
  if (scale === 0) return `${sign}${intPart}`
  const frac = fracPart.toString().padStart(scale, '0')
  return `${sign}${intPart}.${frac}`
}

/** format — human-readable with currency code, e.g. "EUR 49.99". */
export function format(m: Money): string {
  return `${m.currency} ${toDecimal(m)}`
}
