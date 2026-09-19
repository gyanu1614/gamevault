import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, loadConfig } from './config'

describe('loadConfig', () => {
  it('returns the defaults when no env is set', () => {
    expect(loadConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it('reads every threshold from its TREND_* env var', () => {
    const cfg = loadConfig({
      TREND_TOP_N: '20',
      TREND_GROWTH_PCT: '200',
      TREND_GROWTH_MIN_PLAYING: '75000',
      TREND_DEDUP_DAYS: '3',
      TREND_REJECT_SUPPRESS_DAYS: '30',
      TREND_DECAY_PCT: '40',
      TREND_DECAY_WINDOW_DAYS: '7',
      TREND_METRICS_RETENTION_DAYS: '45',
      TREND_ALERT_BURST_MAX: '3',
    })
    expect(cfg).toEqual({
      topN: 20,
      growthPct: 200,
      growthMinPlaying: 75000,
      dedupDays: 3,
      rejectSuppressDays: 30,
      decayPct: 40,
      decayWindowDays: 7,
      metricsRetentionDays: 45,
      alertBurstMax: 3,
    })
  })

  it('ignores an env value that is not a positive number', () => {
    const cfg = loadConfig({ TREND_TOP_N: 'thirty', TREND_GROWTH_PCT: '-5', TREND_DEDUP_DAYS: '0' })
    expect(cfg.topN).toBe(DEFAULT_CONFIG.topN)
    expect(cfg.growthPct).toBe(DEFAULT_CONFIG.growthPct)
    expect(cfg.dedupDays).toBe(DEFAULT_CONFIG.dedupDays)
  })

  it('ships the thresholds the step spec names', () => {
    expect(DEFAULT_CONFIG.topN).toBe(30)
    expect(DEFAULT_CONFIG.growthPct).toBe(150)
    expect(DEFAULT_CONFIG.growthMinPlaying).toBe(50_000)
    expect(DEFAULT_CONFIG.dedupDays).toBe(7)
    expect(DEFAULT_CONFIG.rejectSuppressDays).toBe(90)
    expect(DEFAULT_CONFIG.decayPct).toBe(25)
    expect(DEFAULT_CONFIG.decayWindowDays).toBe(14)
    expect(DEFAULT_CONFIG.metricsRetentionDays).toBe(90)
    expect(DEFAULT_CONFIG.alertBurstMax).toBe(5)
  })
})
