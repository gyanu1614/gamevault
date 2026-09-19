/**
 * Signal math. Pure: the collector resolves everything from the DB and hands
 * it over; this decides what fires. Unit-tested against fixtures so a
 * threshold change is a config edit, not a code change.
 */
import type { TrendConfig } from './config'
import type { SortGame } from './roblox'

export type TrendSignal = 'top30_entry' | 'growth_48h' | 'rmt_chart' | 'endpoint_failure'

export interface SignalEvent {
  platform: 'roblox' | 'eldorado'
  externalId: string
  signal: TrendSignal
  /** top30_entry: rank. growth_48h: % growth. rmt_chart: 0. */
  value: number
  name: string
  playingNow: number
  flags: Record<string, unknown>
}

export interface SignalInput {
  /** The discovery list (any order — ranked here by playerCount). */
  topPlayingNow: SortGame[]
  /** universeId → playing right now (games API, or the sort's playerCount). */
  playingNow: Map<number, number>
  /** universeId → playing ~48h ago, only for universes that have a sample. */
  playing48hAgo: Map<number, number>
  /** Every universe that already has a game_external_ids row (any review status). */
  catalogue: Set<number>
  /** `${universeId}:${signal}` keys that fired inside the dedup window. */
  recentlySignalled: Set<string>
  /** Universes whose game is rejected (inside the suppression window) or snoozed. */
  suppressed: Set<number>
  config: TrendConfig
  /** universeId → name, for growth events on universes outside the sort list. */
  names?: Map<number, string>
}

export function evaluateSignals(input: SignalInput): SignalEvent[] {
  const { config } = input
  const events: SignalEvent[] = []
  const names = new Map(input.names ?? [])
  for (const g of input.topPlayingNow) names.set(g.universeId, g.name)

  const blocked = (universeId: number, signal: TrendSignal) =>
    input.suppressed.has(universeId) || input.recentlySignalled.has(`${universeId}:${signal}`)

  // top30_entry — a universe outside the catalogue inside the top N.
  const ranked = [...input.topPlayingNow].sort((a, b) => b.playerCount - a.playerCount)
  ranked.slice(0, config.topN).forEach((g, i) => {
    const rank = i + 1
    if (input.catalogue.has(g.universeId)) return
    if (blocked(g.universeId, 'top30_entry')) return
    events.push({
      platform: 'roblox',
      externalId: String(g.universeId),
      signal: 'top30_entry',
      value: rank,
      name: g.name,
      playingNow: input.playingNow.get(g.universeId) ?? g.playerCount,
      flags: { rank, topN: config.topN },
    })
  })

  // growth_48h — needs a baseline sample; catalogue games are recorded but flagged.
  for (const [universeId, now] of input.playingNow) {
    const before = input.playing48hAgo.get(universeId)
    if (before === undefined || before <= 0) continue
    const pct = Math.round(((now - before) / before) * 100)
    if (pct < config.growthPct || now < config.growthMinPlaying) continue
    if (blocked(universeId, 'growth_48h')) continue
    events.push({
      platform: 'roblox',
      externalId: String(universeId),
      signal: 'growth_48h',
      value: pct,
      name: names.get(universeId) ?? String(universeId),
      playingNow: now,
      flags: {
        playing48hAgo: before,
        growthPct: config.growthPct,
        growthMinPlaying: config.growthMinPlaying,
        inCatalogue: input.catalogue.has(universeId),
      },
    })
  }

  return events
}
