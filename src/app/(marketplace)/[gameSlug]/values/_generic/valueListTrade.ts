import type { ValueItem } from '@/lib/values/data'
import { TRADE_BENCHMARKS, benchmarkLabel, formatTradeValue, tradePoints } from '@/lib/values/trade-points'
import type { ItemCopyInput } from './valueListItemCopy'

/** An item's trade points against its game's benchmark (= 100), from the market price, else the cheapest. */
export function pointsOf(gameSlug: string, items: ValueItem[], i: ValueItem): number | null {
  const bench = TRADE_BENCHMARKS[gameSlug]
  if (!bench) return null
  const b = items.find((x) => x.slug === bench.slug)?.price
  return tradePoints(i.price?.averageUsd ?? i.price?.cheapestUsd, b?.averageUsd ?? b?.cheapestUsd)
}

/** The trade value as the page words it: "27", "≈ 0.3 Harvesters". */
export function tradeCopy(gameSlug: string, items: ValueItem[], i: ValueItem): ItemCopyInput['trade'] {
  const bench = TRADE_BENCHMARKS[gameSlug]
  const p = pointsOf(gameSlug, items, i)
  return bench && p != null
    ? { points: formatTradeValue(p), inBenchmark: benchmarkLabel(p, bench), benchmark: bench.one, isBenchmark: i.slug === bench.slug }
    : null
}
