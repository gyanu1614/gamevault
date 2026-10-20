/**
 * How a DropMarket trade value reads on the page (our own points: Frost Dragon
 * Fly Ride = 100, from real sale prices; src/lib/pricing/adopt-me-trade-value). The database keeps the exact
 * number from the source (two decimals); this only rounds for display, one
 * rule everywhere (it used to be six local formatters, showing "20.66").
 *   10,000+     one decimal with K   20.6K
 *   10–9,999    whole number         6,940 · 244
 *   1–9.99      one decimal          2.5
 *   under 1     two decimals         0.03
 */
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatTradeValue(n: number): string {
  const a = Math.abs(n)
  if (a >= 10_000) return `${(Math.round(n / 100) / 10).toLocaleString('en-US')}K`
  if (a >= 10) return WHOLE.format(n)
  if (a >= 1) return (Math.round(n * 10) / 10).toString()
  return (Math.round(n * 100) / 100).toString()
}

/**
 * The same value in Frost Dragons (Fly Ride): our points put Frost FR at 100,
 * so 320 points ≈ 3.2 Frosts. One decimal; tiny pets read "< 0.1".
 */
export function frostsLabel(points: number): string {
  const f = points / 100
  if (f < 0.1) return '< 0.1 Frosts'
  const r = f >= 10 ? Math.round(f) : Math.round(f * 10) / 10
  return `≈ ${r.toLocaleString('en-US')} ${r === 1 ? 'Frost' : 'Frosts'}`
}
