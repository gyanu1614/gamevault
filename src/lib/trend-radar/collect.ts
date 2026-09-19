/**
 * Collection run (every 6h): discovery → metrics → signals → events, plus the
 * weekly Eldorado chart diff when asked. Idempotent per run: a re-run inside
 * the dedup window stores fresh metrics and fires nothing new.
 *
 * Failure shape (refinements ii/iii): a discovery outage or a tripped
 * throttle ends the run cleanly — no partial metrics, one endpoint_failure
 * event carrying the endpoint health — and the route still answers 200 with
 * `ok:false` so the workflow log shows exactly what happened.
 */
import { normalizeTitle } from '@/lib/games/icons'
import { DEFAULT_CONFIG, type TrendConfig } from './config'
import { chartGameNames, diffChart, matchChartName, ELDORADO_FEES_URL } from './eldorado'
import {
  createPacer,
  fetchGameMetrics,
  fetchSorts,
  RobloxEndpointError,
  RobloxThrottleTripped,
  type EndpointHealth,
  type FetchLike,
  type Pacer,
} from './roblox'
import { evaluateSignals, type SignalEvent } from './signals'
import {
  insertChartSnapshot,
  insertEndpointFailure,
  insertEvents,
  insertMetrics,
  latestChartSnapshot,
  loadCatalogueTitles,
  loadPlaying48hAgo,
  loadRecentSignals,
  loadRobloxCatalogue,
  suppressedUniverses,
  type Db,
  type NewEvent,
} from './store'

export interface CollectDeps {
  db: Db
  fetchImpl?: FetchLike
  pacer?: Pacer
  config?: TrendConfig
  now?: Date
  /** Also run the weekly Eldorado chart diff. */
  includeRmt?: boolean
  /** Evaluate everything, write nothing (no metrics, events, snapshots, failures). */
  dryRun?: boolean
}

export interface CollectSummary {
  ok: boolean
  dryRun?: boolean
  endpoint?: string
  universes: number
  metricsInserted: number
  events: SignalEvent[]
  eventsInserted: number
  rmt?: { seeded: boolean; chartSize: number; added: string[]; events: number; error?: string }
  failure?: EndpointHealth
  tripped?: boolean
}

export async function runCollect(deps: CollectDeps): Promise<CollectSummary> {
  const { db, fetchImpl = fetch, config = DEFAULT_CONFIG, now = new Date(), includeRmt = false, dryRun = false } = deps
  const pacer = deps.pacer ?? createPacer()
  const robloxDeps = { fetchImpl, pacer }

  // 1. Discovery.
  let sorts
  try {
    sorts = await fetchSorts(robloxDeps)
  } catch (e) {
    return await failRun(db, now, 'discovery', e, {}, dryRun)
  }

  // 2. Universe set = catalogue ∪ every discovery list.
  const catalogue = await loadRobloxCatalogue(db)
  const trending = new Set(sorts.topTrending.map((g) => g.universeId))
  const upAndComing = new Set(sorts.upAndComing.map((g) => g.universeId))
  const universeIds = Array.from(
    new Set([
      ...catalogue.keys(),
      ...sorts.topPlayingNow.map((g) => g.universeId),
      ...trending,
      ...upAndComing,
    ]),
  )
  const sortPlaying = new Map<number, number>()
  const rootPlaceIds = new Map<number, number>()
  for (const g of [...sorts.topPlayingNow, ...sorts.topTrending, ...sorts.upAndComing]) {
    sortPlaying.set(g.universeId, g.playerCount)
    rootPlaceIds.set(g.universeId, g.rootPlaceId)
  }

  // 3. Metrics (batches of 50, paced). A trip = clean stop, nothing written.
  let metricRows
  try {
    metricRows = await fetchGameMetrics(universeIds, robloxDeps)
  } catch (e) {
    return await failRun(db, now, 'metrics', e, { endpoint: sorts.endpoint, universes: universeIds.length }, dryRun)
  }
  const playingNow = new Map<number, number>()
  const names = new Map<number, string>()
  for (const r of metricRows) {
    playingNow.set(r.universeId, r.playing)
    names.set(r.universeId, r.name)
    if (r.rootPlaceId) rootPlaceIds.set(r.universeId, r.rootPlaceId)
  }
  // A universe the games API skipped still gets its sort playerCount.
  for (const id of universeIds) if (!playingNow.has(id) && sortPlaying.has(id)) playingNow.set(id, sortPlaying.get(id)!)

  const metricRowsToInsert = universeIds
      .filter((id) => playingNow.has(id))
      .map((id) => {
        const r = metricRows.find((m) => m.universeId === id)
        return {
          universeId: id,
          playing: playingNow.get(id)!,
          visits: r?.visits ?? null,
          favorites: r?.favorites ?? null,
          inTopTrending: trending.has(id),
          inUpAndComing: upAndComing.has(id),
        }
      })
  const metricsInserted = dryRun ? 0 : await insertMetrics(db, metricRowsToInsert, now)

  // 4. Signals.
  const [playing48hAgo, recentlySignalled] = await Promise.all([
    loadPlaying48hAgo(db, universeIds, now),
    loadRecentSignals(db, now, config.dedupDays),
  ])
  const events = evaluateSignals({
    topPlayingNow: sorts.topPlayingNow,
    playingNow,
    playing48hAgo,
    catalogue: new Set(catalogue.keys()),
    recentlySignalled,
    suppressed: suppressedUniverses(catalogue, now, config.rejectSuppressDays),
    config,
    names,
  })
  const newEvents: NewEvent[] = events.map((e) => {
    const universeId = Number(e.externalId)
    const cat = catalogue.get(universeId)
    return {
      ...e,
      flags: { ...e.flags, rootPlaceId: rootPlaceIds.get(universeId) ?? null, endpoint: sorts.endpoint },
      gameId: cat?.gameId ?? null,
      // Growth on a catalogue game is evidence, not an action: handled now.
      handledAt: cat ? now : null,
    }
  })
  const eventsInserted = dryRun ? 0 : await insertEvents(db, newEvents, now)

  const summary: CollectSummary = {
    ok: true,
    dryRun,
    endpoint: sorts.endpoint,
    universes: universeIds.length,
    metricsInserted,
    events,
    eventsInserted,
  }

  // 5. Weekly RMT demand signal (names only).
  if (includeRmt) summary.rmt = await runRmtChart(db, fetchImpl, config, now, dryRun)

  return summary
}

async function failRun(
  db: Db,
  now: Date,
  stage: 'discovery' | 'metrics',
  e: unknown,
  extra: Record<string, unknown> = {},
  dryRun = false,
): Promise<CollectSummary> {
  const base: CollectSummary = { ok: false, dryRun, universes: 0, metricsInserted: 0, events: [], eventsInserted: 0 }
  if (e instanceof RobloxThrottleTripped) {
    if (!dryRun) await insertEndpointFailure(db, stage === 'discovery' ? 'get-sorts' : 'games', { stage, tripped: true, hits: e.hits, ...extra }, now)
    return { ...base, tripped: true }
  }
  if (e instanceof RobloxEndpointError) {
    if (!dryRun) await insertEndpointFailure(db, e.health.endpoint, { stage, ...e.health, ...extra }, now)
    return { ...base, failure: e.health }
  }
  throw e
}

async function runRmtChart(
  db: Db,
  fetchImpl: FetchLike,
  config: TrendConfig,
  now: Date,
  dryRun: boolean,
): Promise<NonNullable<CollectSummary['rmt']>> {
  try {
    const res = await fetchImpl(ELDORADO_FEES_URL, {
      headers: { 'User-Agent': 'DropMarketRadarBot/1.0 (+https://dropmarket.gg)', Accept: 'text/html' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`eldorado fee page ${res.status}`)
    const names = chartGameNames(await res.text())
    if (names.length < 20) throw new Error(`eldorado fee page parsed to ${names.length} names — layout changed?`)

    const previous = await latestChartSnapshot(db)
    const diff = diffChart(previous, names)
    if (!dryRun) await insertChartSnapshot(db, names, now)
    if (diff.seeded) return { seeded: true, chartSize: names.length, added: [], events: 0 }

    const [titles, recent] = await Promise.all([loadCatalogueTitles(db), loadRecentSignals(db, now, config.dedupDays, 'eldorado')])
    const events: NewEvent[] = []
    for (const name of diff.added) {
      const key = normalizeTitle(name)
      if (!key || recent.has(`${key}:rmt_chart`)) continue
      const match = matchChartName(name, titles)
      if (match.status === 'matched') continue
      events.push({
        platform: 'eldorado',
        externalId: key,
        signal: 'rmt_chart',
        value: 0,
        name,
        playingNow: 0,
        flags: { ambiguous: match.status === 'ambiguous', candidates: match.candidates, confidence: match.confidence, source: ELDORADO_FEES_URL },
      })
    }
    const inserted = dryRun ? events.length : await insertEvents(db, events, now)
    return { seeded: false, chartSize: names.length, added: diff.added, events: inserted }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    if (!dryRun) await insertEndpointFailure(db, 'eldorado-fees', { stage: 'rmt_chart', error }, now).catch(() => {})
    return { seeded: false, chartSize: 0, added: [], events: 0, error }
  }
}
