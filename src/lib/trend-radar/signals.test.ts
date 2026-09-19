import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG } from './config'
import { evaluateSignals, type SignalInput } from './signals'
import type { SortGame } from './roblox'

const g = (universeId: number, playerCount: number, name = `Game ${universeId}`): SortGame => ({
  universeId, rootPlaceId: universeId * 10, name, playerCount, isSponsored: false, upVotes: 0, downVotes: 0,
})

/** 40 ranked games: #1 has 400k playing … #40 has 10k. */
const ranked = Array.from({ length: 40 }, (_, i) => g(1000 + i, (40 - i) * 10_000))

function input(over: Partial<SignalInput> = {}): SignalInput {
  return {
    topPlayingNow: ranked,
    playingNow: new Map(ranked.map((x) => [x.universeId, x.playerCount])),
    playing48hAgo: new Map(),
    catalogue: new Set(),
    recentlySignalled: new Set(),
    suppressed: new Set(),
    config: DEFAULT_CONFIG,
    ...over,
  }
}

describe('evaluateSignals — top30_entry', () => {
  it('fires for every top-N universe that is not in the catalogue', () => {
    const events = evaluateSignals(input({ catalogue: new Set([1000, 1001]) }))
    const top = events.filter((e) => e.signal === 'top30_entry')
    expect(top).toHaveLength(28)
    expect(top[0]).toMatchObject({ platform: 'roblox', externalId: '1002', value: 3, name: 'Game 1002', playingNow: 380_000 })
    expect(top[0].flags).toMatchObject({ rank: 3 })
  })

  it('does not fire for rank N+1 and beyond', () => {
    const events = evaluateSignals(input())
    const ids = events.filter((e) => e.signal === 'top30_entry').map((e) => Number(e.externalId))
    expect(ids).toContain(1029) // rank 30
    expect(ids).not.toContain(1030) // rank 31
  })

  it('ranks by playerCount even if the list arrives unsorted', () => {
    const shuffled = [...ranked].reverse()
    const events = evaluateSignals(input({ topPlayingNow: shuffled, config: { ...DEFAULT_CONFIG, topN: 1 } }))
    expect(events.filter((e) => e.signal === 'top30_entry').map((e) => e.externalId)).toEqual(['1000'])
  })

  it('respects the dedup window and reject/snooze suppression', () => {
    const events = evaluateSignals(input({
      config: { ...DEFAULT_CONFIG, topN: 3 },
      recentlySignalled: new Set(['1000:top30_entry']),
      suppressed: new Set([1001]),
    }))
    expect(events.map((e) => e.externalId)).toEqual(['1002'])
  })
})

describe('evaluateSignals — growth_48h', () => {
  it('fires when playing is up ≥ growthPct vs 48h ago AND ≥ growthMinPlaying now', () => {
    const events = evaluateSignals(input({
      topPlayingNow: [],
      playingNow: new Map([[7, 60_000], [8, 40_000], [9, 60_000]]),
      playing48hAgo: new Map([[7, 20_000], [8, 10_000], [9, 30_000]]),
    }))
    // 7: +200% and 60k → fires. 8: +300% but 40k < 50k → no. 9: +100% < 150% → no.
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ signal: 'growth_48h', externalId: '7', value: 200, playingNow: 60_000 })
    expect(events[0].flags).toMatchObject({ playing48hAgo: 20_000 })
  })

  it('needs a 48h sample — no baseline, no event', () => {
    const events = evaluateSignals(input({ topPlayingNow: [], playingNow: new Map([[7, 500_000]]) }))
    expect(events).toEqual([])
  })

  it('still records growth on a catalogue game, flagged so prepare does not create it', () => {
    const events = evaluateSignals(input({
      topPlayingNow: [],
      playingNow: new Map([[7, 300_000]]),
      playing48hAgo: new Map([[7, 100_000]]),
      catalogue: new Set([7]),
    }))
    expect(events).toHaveLength(1)
    expect(events[0].flags).toMatchObject({ inCatalogue: true })
  })

  it('a universe can fire both signals in one run', () => {
    const events = evaluateSignals(input({
      topPlayingNow: [g(1, 500_000)],
      playingNow: new Map([[1, 500_000]]),
      playing48hAgo: new Map([[1, 100_000]]),
    }))
    expect(events.map((e) => e.signal).sort()).toEqual(['growth_48h', 'top30_entry'])
  })
})
