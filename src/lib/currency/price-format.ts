/**
 * Per-unit price text and the admin's price-rule amounts.
 *
 * A currency's per-unit price can be far below a cent (Robux at $0.0055,
 * a single Sheckle at $0.0000045). `toFixed(2)` turns those into "$0.01" or
 * "$0.00", and `String(1e-7)` prints "1e-7". These helpers show enough
 * digits to be honest and never use exponent notation. Display only: order
 * totals keep their cents rounding elsewhere.
 */

/** Admin price rules (category_configs.config, JSONB) keep up to 8 decimals. */
export const RULE_DECIMALS = 8

/** Fixed-point text with trailing zeros trimmed down to `minDecimals`. */
function trimmed(n: number, decimals: number, minDecimals: number): string {
  const fixed = n.toFixed(decimals)
  if (!fixed.includes('.')) return fixed
  const [int, frac] = fixed.split('.')
  let f = frac.replace(/0+$/, '')
  while (f.length < minDecimals) f += '0'
  const intText = Number(int).toLocaleString('en-US')
  return f.length ? `${intText}.${f}` : intText
}

/**
 * "$5.00", "$0.0123", "$0.0055", "$0.0000045". At a cent or more: 2 to 4
 * decimals. Below a cent: enough decimals for two significant digits (max 8).
 */
export function formatUnitPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0.00'
  if (n >= 0.01) return `$${trimmed(n, 4, 2)}`
  const decimals = Math.min(RULE_DECIMALS, Math.max(4, -Math.floor(Math.log10(n)) + 1))
  return `$${trimmed(n, decimals, 2)}`
}

/** Round to the rule precision (kills float noise like 0.30000000000000004). */
export function roundRuleAmount(n: number): number {
  return Number(n.toFixed(RULE_DECIMALS))
}

/** "0.0000001", "16.49", "10" — never exponent notation; '' for unset. */
export function formatRuleAmount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return trimmed(roundRuleAmount(n), RULE_DECIMALS, 0).replace(/,/g, '')
}

const RULE_AMOUNT_RE = new RegExp(`^\\d*(\\.\\d{0,${RULE_DECIMALS}})?$`)

/** True when `raw` is a partial or complete amount the input may hold. */
export function isRuleAmountInput(raw: string): boolean {
  return RULE_AMOUNT_RE.test(raw)
}

/**
 * Admin input → number. Blank means "not set" (null). Plain decimals only,
 * at most 8 places, never negative.
 */
export function parseRuleAmount(
  raw: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const s = raw.trim()
  if (s === '' || s === '.') return { ok: true, value: null }
  if (!RULE_AMOUNT_RE.test(s)) {
    return { ok: false, error: `Use a plain amount like 0.0045 (up to ${RULE_DECIMALS} decimal places).` }
  }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Use an amount of zero or more.' }
  return { ok: true, value: roundRuleAmount(n) }
}
