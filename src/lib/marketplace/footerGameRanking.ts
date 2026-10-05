/**
 * Footer game directory order — "most trending first" (owner, 2026-10-04).
 *
 * Pure: the cached reads live in gameActivityCache.ts; this only ranks.
 * Order, most important first:
 *   1. paid orders in the last 30 days (real demand),
 *   2. active listing count (real supply),
 *   3. the trend-radar peak concurrent players (games.trend_peak_playing),
 *   4. the curated games.sort_order, then name — the old static order, so a
 *      quiet marketplace still renders a sensible, stable directory.
 * Games without an enabled category are dropped: they have nothing to link.
 */

/** Games shown in the always-visible first row; the rest sit under Show All. */
export const FOOTER_VISIBLE_GAMES = 6

/** Total games in the footer directory (page weight: it renders on every page). */
export const FOOTER_MAX_GAMES = 24

export type GameSignal = Readonly<Record<string, number>>

export interface FooterGameSignals {
  /** game id → paid orders in the last 30 days. */
  orders30d?: GameSignal
  /** game id → active listings. */
  activeListings?: GameSignal
  /** game id → trend-radar peak concurrent players. */
  trendPeak?: GameSignal
}

export interface RankableGame {
  id: string
  name: string
  sort_order: number | null
}

function value(signal: GameSignal | undefined, id: string): number {
  const v = signal?.[id]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

export function rankFooterGames<G extends RankableGame>(
  games: readonly G[],
  gameIdsWithCategories: ReadonlySet<string>,
  signals: FooterGameSignals,
  limit: number = FOOTER_MAX_GAMES,
): G[] {
  const { orders30d, activeListings, trendPeak } = signals
  return games
    .filter((g) => gameIdsWithCategories.has(g.id))
    .slice()
    .sort((a, b) => {
      const byOrders = value(orders30d, b.id) - value(orders30d, a.id)
      if (byOrders !== 0) return byOrders
      const byListings = value(activeListings, b.id) - value(activeListings, a.id)
      if (byListings !== 0) return byListings
      const byTrend = value(trendPeak, b.id) - value(trendPeak, a.id)
      if (byTrend !== 0) return byTrend
      const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER
      const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER
      if (sa !== sb) return sa - sb
      return a.name.localeCompare(b.name)
    })
    .slice(0, Math.max(0, limit))
}

/** game id per row → count per game id (null/undefined rows skipped). */
export function tallyByGame(gameIds: Iterable<string | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of gameIds) {
    if (!id) continue
    out[id] = (out[id] ?? 0) + 1
  }
  return out
}
