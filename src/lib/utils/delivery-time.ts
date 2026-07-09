/**
 * V14r — Shared delivery-time formatter.
 *
 * Converts the wizard's compact storage format ("5min", "1hr", "instant")
 * into a properly cased, pluralised display label ("5 Mins", "1 Hr",
 * "Instant"). Used by the buyer-facing currency page, the seller-facing
 * listings page, and anywhere else we surface delivery_time so the copy
 * stays consistent across the app.
 */

/**
 * parseDeliveryMinutes — convert a delivery_time label into minutes, for the
 * SafeDrop SLA / delivery progress bar.
 *
 * The order page previously did Number(delivery_time), which is NaN for every
 * stored value ("20min", "1hr", "1-24 hours", …) → it always fell back to 60
 * min, so a 20-minute listing showed a 1-hour SLA. This parses correctly:
 *   "5min"/"15min"/"20min"/"30min" → 5/15/20/30
 *   "1hr"/"3hr"/"6hr"/"12hr"       → 60/180/360/720
 *   "24hr" / "1 day"               → 1440
 *   "1-24 hours" (a range)         → upper bound (1440) so the seller isn't
 *                                    marked overdue before their full window
 *   "instant"                      → 5 (a short SLA; instant delivery is ~now)
 *   unparseable / null             → fallback (default 60)
 */
const DEFAULT_DELIVERY_MINUTES = 60

export function parseDeliveryMinutes(
  raw: string | null | undefined,
  fallback = DEFAULT_DELIVERY_MINUTES,
): number {
  if (!raw) return fallback
  const s = raw.trim().toLowerCase()
  if (!s) return fallback
  if (s === 'instant') return 5

  const unitToMin = (value: number, unit: string | undefined): number | null => {
    if (!Number.isFinite(value) || value <= 0) return null
    switch (unit) {
      case 'min':
      case 'mins':
      case 'm':
      case undefined: // bare number → assume minutes
        return Math.round(value)
      case 'hr':
      case 'hrs':
      case 'hour':
      case 'hours':
      case 'h':
        return Math.round(value * 60)
      case 'd':
      case 'day':
      case 'days':
        return Math.round(value * 24 * 60)
      default:
        return null
    }
  }

  // Range like "1-24 hours" → use the UPPER bound (+ its unit).
  const range = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([a-z]+)?/)
  if (range) return unitToMin(Number(range[2]), range[3]) ?? fallback

  // Single value like "20min" / "1hr" / "3 hours" / "1 day".
  const single = s.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?/)
  if (single) return unitToMin(Number(single[1]), single[2]) ?? fallback

  return fallback
}

export function formatDeliveryLabel(s: string | null | undefined): string {
  if (!s) return 'Unspecified'
  const trimmed = s.trim()
  if (!trimmed) return 'Unspecified'
  if (trimmed.toLowerCase() === 'instant') return 'Instant'

  // Match "5min" / "1 hr" / "30 mins" / "1hrs" — tolerant of spacing and
  // an existing trailing 's'.
  const m = trimmed.match(/^(\d+)\s*(min|hr)s?$/i)
  if (m) {
    const n = parseInt(m[1], 10)
    // V14t — Spell out "Hour"/"Hours" instead of "Hr"/"Hrs" so it reads
    // alongside "Mins" without a weight mismatch (both are now full words).
    const unit = m[2].toLowerCase() === 'hr'
      ? (n === 1 ? 'Hour' : 'Hours')
      : (n === 1 ? 'Min' : 'Mins')
    return `${n} ${unit}`
  }

  // Fallback: title-case each word so legacy free-text values like
  // "1-24 hours" still read cleanly.
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase())
}
