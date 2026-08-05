/**
 * "Cheapest tracked" price — the lowest real listing a buyer could act on right
 * now, surfaced next to our computed value on the value list.
 *
 * This is deliberately NOT `min(price)`. The naive cheapest is exactly the trap
 * the value pipeline exists to avoid: a lone unverifiable G2G listing ($97
 * against a $676 market) or a stale "active" listing last seen a week ago. So a
 * tracked price must clear three gates, mirroring the floor logic in
 * price-correction.ts:
 *   1. FRESH   — observed within the freshness window (we crawl daily, not live).
 *   2. TRUSTED — from a source that carries seller-trust signals, OR within a
 *                small band of the verified market. An unverifiable deep undercut
 *                cannot be shown.
 *   3. FLOORED — never below our own published value's trust band, so the column
 *                can't contradict (or undercut) the value on the same row.
 *
 * When nothing clears the gates the item shows no tracked price ("—"), which is
 * honest: for most of the long tail we simply have no recent real listing.
 */

/** Sources whose listings carry seller-trust signals (verified flag, age). */
export const TRUSTED_TRACKED_SOURCES = new Set(['eldorado'])

/** A listing is "recent" only if observed within this many hours. */
export const TRACKED_FRESHNESS_HOURS = 48

/**
 * A NON-trusted listing (G2G/Itemku — no seller-trust signals) may only be shown
 * if it is within this fraction of the item's published value: a plausibly-real
 * cheaper deal, not an unverifiable undercut. Matches the floor's
 * TRUSTED_FLOOR_UNDERCUT (0.92 = at most 8% under). The $97 G2G fake against a
 * $676 market is far past this and dropped.
 */
export const TRACKED_UNTRUSTED_UNDERCUT = 0.92

/**
 * A TRUSTED listing (Eldorado — carries seller-trust signals) is allowed a
 * deeper discount before we distrust it: a verified seller listing 15% under the
 * blended value is a real deal, not a scam. Below this it's likely a mispriced /
 * mislabeled listing (the kind the value pipeline already fences out), so we
 * stop trusting it as a "cheapest you can buy at".
 */
export const TRACKED_TRUSTED_UNDERCUT = 0.85

/**
 * How far below the published value a tracked price must sit to earn the "deal"
 * flag. A price a hair under value is not worth flagging; 3% gives it meaning.
 */
export const TRACKED_DEAL_MARGIN = 0.97

export type TrackedListing = {
  priceUsd: number
  source: string
  /** ISO timestamp the listing was last observed. */
  observedAt: string
}

export type CheapestTracked = {
  priceUsd: number
  source: string
  /** True when the tracked price is a genuine discount to the published value. */
  isDeal: boolean
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/**
 * The cheapest tracked price for one variant.
 *
 * @param listings   recent raw listings for the variant (any freshness — this
 *                   filters). Each must carry price, source, observedAt.
 * @param publishedValueUsd the item's corrected value, used as the trust floor
 *                   and the deal baseline. When null (no published value) we
 *                   cannot judge trust, so nothing is shown.
 * @param nowMs      current time in ms (injected so callers/tests are
 *                   deterministic; no Date.now() inside).
 */
export function cheapestTracked(
  listings: TrackedListing[],
  publishedValueUsd: number | null,
  nowMs: number,
): CheapestTracked | null {
  if (publishedValueUsd == null || !isFinitePositive(publishedValueUsd)) {
    return null
  }

  const freshCutoff = nowMs - TRACKED_FRESHNESS_HOURS * 60 * 60 * 1000
  const trustedFloor = publishedValueUsd * TRACKED_TRUSTED_UNDERCUT
  const untrustedFloor = publishedValueUsd * TRACKED_UNTRUSTED_UNDERCUT

  const eligible = listings
    .filter((l) => isFinitePositive(l.priceUsd))
    // FRESH: observed inside the window.
    .filter((l) => {
      const t = Date.parse(l.observedAt)
      return Number.isFinite(t) && t >= freshCutoff
    })
    // TRUSTED + FLOORED: a verified-source listing may sit a bit lower (a real
    // deal) than an unverifiable one, but neither may sit so far under the value
    // that it's the mispriced/fake data the value pipeline already fences out.
    // The $97 G2G fake against a $676 market is far past the untrusted floor and
    // dropped; a $613 Eldorado listing (9% under) clears the trusted floor.
    .filter((l) => {
      const floor = TRUSTED_TRACKED_SOURCES.has(l.source)
        ? trustedFloor
        : untrustedFloor
      return l.priceUsd >= floor
    })

  if (!eligible.length) return null

  let cheapest = eligible[0]
  for (const l of eligible) {
    if (l.priceUsd < cheapest.priceUsd) cheapest = l
  }

  return {
    priceUsd: cheapest.priceUsd,
    source: cheapest.source,
    isDeal: cheapest.priceUsd < publishedValueUsd * TRACKED_DEAL_MARGIN,
  }
}
