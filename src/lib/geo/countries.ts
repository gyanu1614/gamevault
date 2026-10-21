/**
 * Country display helpers (ISO-3166 alpha-2), client- and server-safe.
 * Names come from the runtime's Intl data, so no name table ships.
 */

const NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

const CC = /^[A-Z]{2}$/

/** "BE" → "Belgium"; an unknown or malformed code comes back as itself. */
export function countryName(cc: string): string {
  const code = cc.trim().toUpperCase()
  if (!CC.test(code)) return cc
  try {
    return NAMES?.of(code) ?? code
  } catch {
    return code
  }
}

/** "BE" → 🇧🇪 (regional-indicator pair); anything else → 🌍. */
export function flagEmoji(cc: string): string {
  const code = cc.trim().toUpperCase()
  if (!CC.test(code)) return '🌍'
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}
