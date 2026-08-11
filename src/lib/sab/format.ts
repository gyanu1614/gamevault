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

/**
 * In-game currency cost, compact — e.g. "$250B", "$40B", "$1.5M". This is the
 * game-world cash to buy the item (often billions/trillions), so full digits
 * ("$250,000,000,000") are unreadable; we abbreviate with M/B/T. Returns null
 * when there's no value so callers can show "Unknown".
 */
export function formatIngameCost(value: number | string | null | undefined): string | null {
  const amount = asNumber(value)
  if (amount == null) return null
  return `$${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(amount)}`
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

/**
 * Confidence label → plain wording.
 *
 * Maps the DB's confidence_label ('reviewed' | 'high' | 'medium' | 'low' |
 * anything else) to words a 13-year-old trading Brainrots actually parses.
 * "High confidence" is analyst-speak; it says nothing about whether the number
 * can be trusted.
 *
 * The scale is deliberately about ACCURACY, not confidence, because that's the
 * question a buyer is asking. 'reviewed' sits outside the scale — it means a
 * human checked the price, which is a different claim from "lots of samples
 * agreed", so it gets its own word rather than being folded into the top rung.
 *
 * Display only. Nothing branches on these strings, and the stored values are
 * untouched — renaming here can never affect pricing or the data layer.
 *
 * Single source of truth: this wording was copy-pasted into four separate
 * clients, which is how a rename ends up half-applied.
 */
export function formatConfidence(value: string | null | undefined): string {
  if (value === 'reviewed') return 'Verified'
  if (value === 'high') return 'Highly Accurate'
  if (value === 'medium') return 'Accurate'
  if (value === 'low') return 'Low Accuracy'
  return 'No Data Yet'
}
