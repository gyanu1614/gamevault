/**
 * DropMarket's own trade value, for any game: points from real sale prices,
 * with one well-known item fixed at a set number (Adopt Me: Frost Dragon Fly
 * Ride = 100, src/lib/pricing/adopt-me-trade-value.ts; MM2: Harvester = 250,
 * below). No community votes, no third-party values — the same rule the owner
 * set for Adopt Me on 2026-10-19. Display rounding is one rule everywhere.
 */

export interface TradeBenchmark {
  /** The item the scale is fixed to. */
  slug: string
  one: string
  many: string
  /** Its points. */
  points: number
}

/** Value-list games (values_items) whose pages show trade points. Adopt Me stores its own (adopt_me_pet_values). */
export const TRADE_BENCHMARKS: Record<string, TradeBenchmark> = {
  // A liquid, widely traded Ancient that MM2 players know by name, at 250: the
  // number the community lists give it, so our price-based points read on the
  // scale MM2 traders already use. Checked 2026-10-20 against game.guide (31
  // items): median ratio 1.05, 22 of 31 within ±25%; cheap items run ~24% above
  // (cash prices have a floor), the top items ~19% below.
  'murder-mystery-2': { slug: 'harvester', one: 'Harvester', many: 'Harvesters', points: 250 },
}

/** Points for a price against the benchmark's price (= `scale` points); null when either is missing. */
export function tradePoints(priceUsd: number | null | undefined, benchmarkUsd: number | null | undefined, scale = 100): number | null {
  if (priceUsd == null || benchmarkUsd == null || !(priceUsd > 0) || !(benchmarkUsd > 0)) return null
  return Math.round((priceUsd / benchmarkUsd) * scale * 100) / 100
}

const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 *   10,000+     one decimal with K   20.6K
 *   10–9,999    whole number         6,940 · 244
 *   1–9.99      one decimal          2.5
 *   under 1     two decimals         0.03
 */
export function formatTradeValue(n: number): string {
  const a = Math.abs(n)
  if (a >= 10_000) return `${(Math.round(n / 100) / 10).toLocaleString('en-US')}K`
  if (a >= 10) return WHOLE.format(n)
  if (a >= 1) return (Math.round(n * 10) / 10).toString()
  return (Math.round(n * 100) / 100).toString()
}

/** The same value in benchmark items: 320 points ≈ 3.2 Frosts (at 100). One decimal; tiny values read "< 0.1". */
export function benchmarkLabel(points: number, b: Pick<TradeBenchmark, 'one' | 'many'> & { points?: number }): string {
  const f = points / (b.points ?? 100)
  if (f < 0.1) return `< 0.1 ${b.many}`
  const r = f >= 10 ? Math.round(f) : Math.round(f * 10) / 10
  return `≈ ${r.toLocaleString('en-US')} ${r === 1 ? b.one : b.many}`
}
