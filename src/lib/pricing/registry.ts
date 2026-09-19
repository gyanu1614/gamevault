/**
 * The pricing game registry — the single list of games that can be repriced.
 *
 * Both callers read this list, so they cannot drift apart:
 *   - scripts/reprice.mjs        (the scheduled path: runs on the GH Actions
 *                                 runner, right after each game's crawl)
 *   - /api/cron/correct-prices   (a thin manual trigger for one-off re-runs)
 *
 * Adding a game is adding one entry here. A game's `run` owns its own
 * read → price → write and returns a small summary; a failure throws so the
 * runner can fail the job loudly.
 *
 * `run` takes an options bag so every game gets incremental repricing for free:
 * `full: true` forces a complete recompute (the backfill path), otherwise a
 * game reprices only the items whose listings actually moved.
 */

import { runSabCorrection } from '@/lib/pricing/games/sab'
import { runAdoptMeCorrection } from '@/lib/pricing/games/adopt-me'
import { runStealAnEggCorrection } from '@/lib/pricing/games/steal-an-egg'

export type RepriceOptions = {
  /** Recompute and rewrite every item, ignoring the incremental check. */
  full?: boolean
}

export type PricingGame = {
  key: string
  run: (options?: RepriceOptions) => Promise<Record<string, unknown>>
}

export const PRICING_GAMES: PricingGame[] = [
  { key: 'sab', run: (options) => runSabCorrection(options) },
  { key: 'adopt-me', run: (options) => runAdoptMeCorrection(options) },
  // Steal An Egg runs on the generic values_* pipeline; same shared reputable
  // model, so it needs no new pricing maths.
  {
    key: 'steal-an-egg',
    run: (options) => runStealAnEggCorrection('steal-an-egg', options),
  },
]

/** The registry as a lookup, for `--game=<slug>` dispatch. */
export function findPricingGame(key: string): PricingGame | undefined {
  return PRICING_GAMES.find((game) => game.key === key)
}

/** Every registered key, for error messages and `--game=all`. */
export function pricingGameKeys(): string[] {
  return PRICING_GAMES.map((game) => game.key)
}
