/**
 * Total money/number formatters for the admin seller screens.
 *
 * Why these exist: SellerDetail / ActiveSeller cross a server-action
 * serialization boundary. Their TypeScript types say `amount: number`, but
 * that is a compile-time claim about a payload the client receives at
 * runtime — a column that goes null, a `select` that omits a field, or an
 * optimistic cache patch that rebuilds a row can all deliver `undefined`
 * where the type promised a number. Calling `.toFixed()` on that threw
 * "Cannot read properties of undefined (reading 'toFixed')" and, because
 * these render inside the page body, took down the whole route rather than
 * one cell (Sentry JAVASCRIPT-NEXTJS-4).
 *
 * So the display layer treats a missing number as missing data and renders
 * a placeholder, instead of trusting the type and crashing.
 */

/** Rendered in place of a number we don't have. */
export const EM_DASH = '—'

/**
 * Narrow an unknown numeric field to a finite number.
 *
 * Rejects undefined/null and the non-finite values (NaN, ±Infinity) that a
 * bad division or a `Number(someString)` upstream can produce — those format
 * as "$NaN", which is worse than an honest placeholder.
 */
export function finiteOrNull(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** `$12.34`, or `—` when the amount is missing or non-finite. */
export function money(n: unknown): string {
  const v = finiteOrNull(n)
  return v === null ? EM_DASH : `$${v.toFixed(2)}`
}

/** Signed amount for ledger rows: `-$5.00` / `+$5.00`, or `—`. */
export function signedMoney(n: unknown): string {
  const v = finiteOrNull(n)
  if (v === null) return EM_DASH
  return v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `+$${v.toFixed(2)}`
}

/** Fixed-decimal number without a currency symbol (CSV cells, ratings). */
export function decimal(n: unknown, digits = 2): string {
  const v = finiteOrNull(n)
  return v === null ? EM_DASH : v.toFixed(digits)
}

/**
 * A rate stored as a fraction (0.085) rendered as a percentage ("8.50%").
 * Returns null so callers can omit the whole clause rather than print "—%".
 */
export function percentFromRate(rate: unknown, digits = 2): string | null {
  const v = finiteOrNull(rate)
  return v === null ? null : `${(v * 100).toFixed(digits)}%`
}

/**
 * `$1.00 · €2.00` for a balance list, skipping rows whose amount is missing.
 * Mirrors the previous behaviour: prefer non-zero rows, else show the first.
 */
export function balanceLabel(
  balances: { currency: string; amount: number }[] | null | undefined,
  symbols: Record<string, string>,
): string {
  const rows = (balances ?? []).filter((b) => finiteOrNull(b?.amount) !== null)
  if (rows.length === 0) return EM_DASH
  const nonZero = rows.filter((b) => b.amount !== 0)
  const shown = nonZero.length > 0 ? nonZero : rows.slice(0, 1)
  return shown
    .map((b) => `${symbols[b.currency] ?? `${b.currency} `}${b.amount.toFixed(2)}`)
    .join(' · ')
}
