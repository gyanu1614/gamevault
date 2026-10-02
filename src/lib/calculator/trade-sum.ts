/**
 * Shared trade-calculator maths: side totals and the WIN / LOSS / FAIR verdict.
 *
 * Sums in integer cents so totals are exact (nine $0.62 items are $5.58, not
 * $5.579999…). Every positive estimate counts, however small; a side is only
 * "unknown" when a line has no estimate at all. Low-confidence lines still
 * count — the caller shows a note instead of pausing the verdict.
 *
 * Before this module the SAB trade tab dropped any price flagged
 * `isTradeReady=false` from the total while its tile still showed the price,
 * so a $0.62 tile summed to $0.00 and paused the verdict.
 */

export interface TradeLine {
  /** Per-unit point estimate in USD; null/undefined/≤0 = no estimate. */
  pointUsd: number | null | undefined
  /** Per-unit market range in USD; falls back to the point value. */
  lowUsd?: number | null
  highUsd?: number | null
  quantity: number
  lowConfidence?: boolean
  /** Shown when this line is the one without an estimate. */
  label?: string
}

export interface SideTotals {
  items: number
  pointCents: number
  lowCents: number
  highCents: number
  unknown: number
  unknownLabels: string[]
  lowConfidence: number
}

export type VerdictKind = 'win' | 'loss' | 'fair' | 'uncertain'

export interface TradeVerdict {
  kind: VerdictKind
  /** (received − given) / given × 100, from the point values. */
  pct: number
  diffCents: number
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100)
}

export function centsToUsd(cents: number): number {
  return cents / 100
}

export function hasEstimate(usd: number | null | undefined): usd is number {
  return usd != null && Number.isFinite(usd) && usd > 0
}

export function sumSide(lines: readonly TradeLine[]): SideTotals {
  const totals: SideTotals = {
    items: lines.length,
    pointCents: 0,
    lowCents: 0,
    highCents: 0,
    unknown: 0,
    unknownLabels: [],
    lowConfidence: 0,
  }

  for (const line of lines) {
    if (!hasEstimate(line.pointUsd)) {
      totals.unknown += 1
      if (line.label) totals.unknownLabels.push(line.label)
      continue
    }
    const qty = Math.max(0, Math.trunc(line.quantity))
    const point = usdToCents(line.pointUsd)
    const low = hasEstimate(line.lowUsd) ? usdToCents(line.lowUsd) : point
    const high = hasEstimate(line.highUsd) ? usdToCents(line.highUsd) : point

    totals.pointCents += point * qty
    // The range must contain the point value; the stored market range is from
    // a different evidence window than the corrected point and can sit above it.
    totals.lowCents += Math.min(point, low) * qty
    totals.highCents += Math.max(point, high) * qty
    if (line.lowConfidence) totals.lowConfidence += 1
  }

  return totals
}

/** Within ±5% (and overlapping ranges) reads as FAIR. */
const FAIR_TOLERANCE = 0.05

/**
 * Null while the verdict is paused: a side is empty, a line has no estimate,
 * or you give nothing of value.
 */
export function tradeVerdict(give: SideTotals, receive: SideTotals): TradeVerdict | null {
  if (give.items === 0 || receive.items === 0) return null
  if (give.unknown > 0 || receive.unknown > 0) return null
  if (give.pointCents <= 0) return null

  const diffCents = receive.pointCents - give.pointCents
  const pct = (diffCents / give.pointCents) * 100

  const clearWin = receive.lowCents > give.highCents * (1 + FAIR_TOLERANCE)
  const clearLoss = receive.highCents < give.lowCents * (1 - FAIR_TOLERANCE)
  const overlap =
    receive.lowCents <= give.highCents * (1 + FAIR_TOLERANCE) &&
    give.lowCents <= receive.highCents * (1 + FAIR_TOLERANCE)

  let kind: VerdictKind = 'uncertain'
  if (clearWin) kind = 'win'
  else if (clearLoss) kind = 'loss'
  else if (Math.abs(pct) <= FAIR_TOLERANCE * 100 && overlap) kind = 'fair'

  return { kind, pct, diffCents }
}
