/**
 * How an Adopt Me trade value reads on the page (our own points: Frost Dragon
 * Fly Ride = 100, from real sale prices; src/lib/pricing/adopt-me-trade-value).
 * The rounding is the shared rule in src/lib/values/trade-points.ts.
 */
import { benchmarkLabel } from '@/lib/values/trade-points'

export { formatTradeValue } from '@/lib/values/trade-points'

/** The same value in Frost Dragons (Fly Ride): 320 points ≈ 3.2 Frosts; tiny pets read "< 0.1 Frosts". */
export function frostsLabel(points: number): string {
  return benchmarkLabel(points, { one: 'Frost', many: 'Frosts' })
}
