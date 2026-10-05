/**
 * Per-game publish configuration for the value pricing runs (T1).
 *
 * The change rule decides which prices are worth rebuilding a page for (see
 * change-rule.ts). Every game starts on the shared default — 3% / $0.05 —
 * and overrides only with a reason, written next to the override. Tune from
 * the run summaries (`changed_slugs` / `items_compared` in the reprice log),
 * not from memory.
 *
 * Optional env overrides for a one-off experiment without a deploy:
 *   PRICE_CHANGE_MIN_RELATIVE=0.05  PRICE_CHANGE_MIN_ABSOLUTE_USD=0.10
 * apply to every game in that run (the runner reads them; pages do not).
 */
import { DEFAULT_PRICE_CHANGE_RULE, type PriceChangeRule } from './change-rule'

/** process.env, or any plain map of it (tests). */
export type EnvLike = Readonly<Record<string, string | undefined>>

/** Keyed by page slug (registry `gameSlug`). */
const GAME_RULES: Readonly<Record<string, Partial<PriceChangeRule>>> = Object.freeze({
  // All three on the default today. Example of an override, with its reason:
  //   'steal-an-egg': { minAbsoluteUsd: 0.1 }, // ~$1 eggs flap by 5–8c daily
})

function envNumber(name: string, env: EnvLike): number | undefined {
  const raw = env[name]
  if (raw == null || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/** The change rule for a game slug (default ← per-game override ← env). */
export function priceChangeRule(
  gameSlug: string,
  env: EnvLike = process.env,
): PriceChangeRule {
  const game = GAME_RULES[gameSlug] ?? {}
  return {
    minRelative:
      envNumber('PRICE_CHANGE_MIN_RELATIVE', env) ??
      game.minRelative ??
      DEFAULT_PRICE_CHANGE_RULE.minRelative,
    minAbsoluteUsd:
      envNumber('PRICE_CHANGE_MIN_ABSOLUTE_USD', env) ??
      game.minAbsoluteUsd ??
      DEFAULT_PRICE_CHANGE_RULE.minAbsoluteUsd,
  }
}
