/**
 * Shared price-display rules for every values surface (list cards + item
 * heroes). Plain module: safe for server and client components.
 */

/**
 * Show the quiet "typically ~$X" market line only when the market (average)
 * price exceeds the cheapest by this multiple; below it the two read as one
 * number and the cheapest headline says it all.
 */
export const MARKET_SECONDARY_GAP = 1.25

/** The market price to show as a secondary line, or null when it adds nothing. */
export function marketSecondaryUsd(
  cheapestUsd: number | null | undefined,
  marketUsd: number | null | undefined,
): number | null {
  return cheapestUsd != null && marketUsd != null && marketUsd > cheapestUsd * MARKET_SECONDARY_GAP
    ? marketUsd
    : null
}
