/**
 * The checkout's "Lowest Fee" tag (owner 2026-10-15): the one method, among
 * the buyer's own-country rails, whose quoted service fee for THIS order is
 * the smallest. The caller passes those rows only: crypto and other
 * countries' regional rails are never candidates.
 * Pure and client-safe; re-run whenever the quotes change (promo, quantity,
 * store credit). A tie goes to the first row in display order; no tag when
 * fewer than two rows are quoted or all cost the same.
 */
export interface FeeRankedRow {
  id: string
  quote: { serviceFeeMinor: number } | null
}

export function lowestFeeMethodId(rows: readonly FeeRankedRow[]): string | null {
  let best: FeeRankedRow | null = null
  let quoted = 0
  let allEqual = true
  for (const r of rows) {
    if (!r.quote) continue
    quoted += 1
    if (best && r.quote.serviceFeeMinor !== best.quote!.serviceFeeMinor) allEqual = false
    if (!best || r.quote.serviceFeeMinor < best.quote!.serviceFeeMinor) best = r
  }
  return quoted >= 2 && !allEqual ? best!.id : null
}
