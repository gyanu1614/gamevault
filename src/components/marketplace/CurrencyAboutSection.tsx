/**
 * Seam after the FAQ on the game hub. Renders nothing.
 *
 * The currency pages no longer use it: they render the per-game
 * "<Currency> Guide" (components/marketplace/currency-guide) through their
 * `guide` slot. The hub keeps this empty seam on purpose, so the guide's
 * text lives on ONE URL per game (the currency page) instead of being
 * duplicated on the hub. Keep it server-renderable if it ever fills.
 */

export function CurrencyAboutSection(_props: { gameName: string; currencyName?: string | null }) {
  return null
}
