/**
 * Steal a Brainrot — shared value/income formatters (single source of truth).
 *
 * Fixes the prior inconsistency where some places showed compact income
 * ("50M/s") and others showed raw digits ("50,000,000"). Every SAB surface —
 * value directory, per-brainrot page, calculator, marketplace — must use these.
 */

export function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Compact per-second income, always suffixed "/s" (e.g. "50M/s", "1.2B/s"). */
export function formatIncome(value: number | string | null | undefined): string {
  const amount = asNumber(value)
  if (amount == null) return 'Unknown'
  return `${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount)}/s`
}

/** USD cash value. Sub-$10 shows cents; $10+ rounds for scannability. */
export function formatCash(value: number | string | null | undefined): string | null {
  const amount = asNumber(value)
  if (amount == null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Multiplier badge, e.g. "7.5x". */
export function formatMultiplier(value: number | string | null | undefined): string {
  const amount = asNumber(value)
  if (amount == null) return '—'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)}x`
}

/** Short human date, e.g. "Jul 25, 2026"; null-safe. */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
