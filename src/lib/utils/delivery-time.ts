/**
 * V14r — Shared delivery-time formatter.
 *
 * Converts the wizard's compact storage format ("5min", "1hr", "instant")
 * into a properly cased, pluralised display label ("5 Mins", "1 Hr",
 * "Instant"). Used by the buyer-facing currency page, the seller-facing
 * listings page, and anywhere else we surface delivery_time so the copy
 * stays consistent across the app.
 */

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
