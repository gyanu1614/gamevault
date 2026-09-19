/**
 * Trend-radar thresholds. Config, not constants: every number can be tuned
 * from the environment without a deploy, and `trend_events` keeps the value
 * that fired so a tuning decision is made from evidence.
 */
export interface TrendConfig {
  /** `top30_entry`: a universe outside the catalogue enters the top N by playing. */
  topN: number
  /** `growth_48h`: playing up ≥ this % vs 48h ago … */
  growthPct: number
  /** … AND at least this many playing now. */
  growthMinPlaying: number
  /** One event per (universe, signal) per this many days. */
  dedupDays: number
  /** A rejected game is not re-alerted for this many days. */
  rejectSuppressDays: number
  /** Decay: 14-day max playing below this % of detection peak → `declining`. */
  decayPct: number
  decayWindowDays: number
  /** Raw `game_metrics` rows older than this are rolled up and pruned. */
  metricsRetentionDays: number
  /**
   * More than this many games prepared in ONE run → one Discord digest
   * instead of a message per game. Bounds the first-run burst (every
   * non-catalogue top-30 game "enters" at once) without hiding any of them.
   */
  alertBurstMax: number
}

export const DEFAULT_CONFIG: TrendConfig = {
  topN: 30,
  growthPct: 150,
  growthMinPlaying: 50_000,
  dedupDays: 7,
  rejectSuppressDays: 90,
  decayPct: 25,
  decayWindowDays: 14,
  metricsRetentionDays: 90,
  alertBurstMax: 5,
}

const ENV_KEYS: Record<keyof TrendConfig, string> = {
  topN: 'TREND_TOP_N',
  growthPct: 'TREND_GROWTH_PCT',
  growthMinPlaying: 'TREND_GROWTH_MIN_PLAYING',
  dedupDays: 'TREND_DEDUP_DAYS',
  rejectSuppressDays: 'TREND_REJECT_SUPPRESS_DAYS',
  decayPct: 'TREND_DECAY_PCT',
  decayWindowDays: 'TREND_DECAY_WINDOW_DAYS',
  metricsRetentionDays: 'TREND_METRICS_RETENTION_DAYS',
  alertBurstMax: 'TREND_ALERT_BURST_MAX',
}

/** Defaults overridden by any TREND_* env var that parses to a positive number. */
export function loadConfig(env: Record<string, string | undefined> = process.env): TrendConfig {
  const out: TrendConfig = { ...DEFAULT_CONFIG }
  for (const key of Object.keys(ENV_KEYS) as (keyof TrendConfig)[]) {
    const raw = env[ENV_KEYS[key]]
    if (raw === undefined || raw === '') continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) out[key] = n
  }
  return out
}
