/**
 * DB access for the trend radar. Every function takes the service-role
 * client the caller already holds (signed route / admin action / script) and
 * writes explicit timestamps so runs are replayable and tests can clean up
 * by range. No SQL functions: PostgREST calls only.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignalEvent, TrendSignal } from './signals'

export type Db = SupabaseClient<any, any, any, any, any>

export const HOURS = 3600_000
export const DAYS = 24 * HOURS

export interface CatalogueGame {
  gameId: string
  slug: string
  name: string
  isActive: boolean
  reviewStatus: string
  imageUrl: string | null
  reviewSnoozedUntil: string | null
  updatedAt: string | null
}

/** universeId → game, for every game that has a Roblox external id. */
export async function loadRobloxCatalogue(db: Db): Promise<Map<number, CatalogueGame>> {
  const { data, error } = await db
    .from('game_external_ids')
    .select('external_id, game:games!game_external_ids_game_id_fkey(id, slug, name, is_active, review_status, image_url, review_snoozed_until, updated_at)')
    .eq('platform', 'roblox')
  if (error) throw new Error(`game_external_ids read failed: ${error.message}`)
  const out = new Map<number, CatalogueGame>()
  for (const row of (data ?? []) as any[]) {
    const g = row.game
    if (!g) continue
    out.set(Number(row.external_id), {
      gameId: g.id,
      slug: g.slug,
      name: g.name,
      isActive: Boolean(g.is_active),
      reviewStatus: g.review_status,
      imageUrl: g.image_url ?? null,
      reviewSnoozedUntil: g.review_snoozed_until ?? null,
      updatedAt: g.updated_at ?? null,
    })
  }
  return out
}

export interface NewMetric {
  universeId: number
  playing: number
  visits: number | null
  favorites: number | null
  inTopTrending: boolean
  inUpAndComing: boolean
}

export async function insertMetrics(db: Db, rows: NewMetric[], capturedAt: Date): Promise<number> {
  if (rows.length === 0) return 0
  const payload = rows.map((r) => ({
    platform: 'roblox',
    external_id: String(r.universeId),
    playing: r.playing,
    visits: r.visits,
    favorites: r.favorites,
    in_top_trending: r.inTopTrending,
    in_up_and_coming: r.inUpAndComing,
    captured_at: capturedAt.toISOString(),
  }))
  // 500-row chunks keep each PostgREST body small.
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await db.from('game_metrics').insert(payload.slice(i, i + 500))
    if (error) throw new Error(`game_metrics insert failed: ${error.message}`)
  }
  return payload.length
}

/**
 * The sample nearest to 48h ago per universe, taken from a 42–54h window so a
 * drifted GitHub schedule still finds one.
 */
export async function loadPlaying48hAgo(db: Db, universeIds: number[], now: Date): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (universeIds.length === 0) return out
  const target = now.getTime() - 48 * HOURS
  const from = new Date(now.getTime() - 54 * HOURS).toISOString()
  const to = new Date(now.getTime() - 42 * HOURS).toISOString()
  const best = new Map<number, { playing: number; distance: number }>()
  for (let i = 0; i < universeIds.length; i += 200) {
    const slice = universeIds.slice(i, i + 200).map(String)
    const { data, error } = await db
      .from('game_metrics')
      .select('external_id, playing, captured_at')
      .eq('platform', 'roblox')
      .in('external_id', slice)
      .gte('captured_at', from)
      .lte('captured_at', to)
    if (error) throw new Error(`game_metrics 48h read failed: ${error.message}`)
    for (const row of (data ?? []) as any[]) {
      const id = Number(row.external_id)
      const distance = Math.abs(new Date(row.captured_at).getTime() - target)
      const cur = best.get(id)
      if (!cur || distance < cur.distance) best.set(id, { playing: row.playing, distance })
    }
  }
  for (const [id, v] of best) out.set(id, v.playing)
  return out
}

/** `${externalId}:${signal}` for every event inside the dedup window. */
export async function loadRecentSignals(db: Db, now: Date, dedupDays: number, platform: 'roblox' | 'eldorado' = 'roblox'): Promise<Set<string>> {
  const since = new Date(now.getTime() - dedupDays * DAYS).toISOString()
  const { data, error } = await db
    .from('trend_events')
    .select('external_id, signal')
    .eq('platform', platform)
    .gte('created_at', since)
    .lte('created_at', now.toISOString())
  if (error) throw new Error(`trend_events read failed: ${error.message}`)
  return new Set((data ?? []).map((r: any) => `${r.external_id}:${r.signal}`))
}

/** Universes whose game is rejected inside the suppression window, or snoozed. */
export function suppressedUniverses(catalogue: Map<number, CatalogueGame>, now: Date, rejectSuppressDays: number): Set<number> {
  const out = new Set<number>()
  const since = now.getTime() - rejectSuppressDays * DAYS
  for (const [id, g] of catalogue) {
    if (g.reviewStatus === 'rejected' && g.updatedAt && new Date(g.updatedAt).getTime() >= since) out.add(id)
    if (g.reviewSnoozedUntil && new Date(g.reviewSnoozedUntil).getTime() > now.getTime()) out.add(id)
  }
  return out
}

export interface NewEvent extends SignalEvent {
  gameId?: string | null
  handledAt?: Date | null
}

export async function insertEvents(db: Db, events: NewEvent[], createdAt: Date): Promise<number> {
  if (events.length === 0) return 0
  const payload = events.map((e) => ({
    platform: e.platform,
    external_id: e.externalId,
    game_id: e.gameId ?? null,
    signal: e.signal,
    value: e.value,
    name: e.name,
    // playingNow rides in flags so prepare and the review card can show it
    // without re-reading metrics.
    flags: { ...e.flags, playingNow: e.playingNow },
    created_at: createdAt.toISOString(),
    handled_at: e.handledAt ? e.handledAt.toISOString() : null,
  }))
  const { error } = await db.from('trend_events').insert(payload)
  if (error) throw new Error(`trend_events insert failed: ${error.message}`)
  return payload.length
}

export async function insertEndpointFailure(
  db: Db,
  endpoint: string,
  flags: Record<string, unknown>,
  createdAt: Date,
): Promise<void> {
  const { error } = await db.from('trend_events').insert({
    platform: 'roblox',
    external_id: endpoint,
    signal: 'endpoint_failure' satisfies TrendSignal,
    value: 0,
    name: endpoint,
    flags,
    created_at: createdAt.toISOString(),
    handled_at: createdAt.toISOString(),
  })
  if (error) throw new Error(`trend_events endpoint_failure insert failed: ${error.message}`)
}

// ── Eldorado chart ─────────────────────────────────────────────────────────

export async function latestChartSnapshot(db: Db, source = 'eldorado'): Promise<string[] | null> {
  const { data, error } = await db
    .from('rmt_chart_snapshots')
    .select('names')
    .eq('source', source)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`rmt_chart_snapshots read failed: ${error.message}`)
  return data ? ((data as any).names as string[]) : null
}

export async function insertChartSnapshot(db: Db, names: string[], capturedAt: Date, source = 'eldorado'): Promise<void> {
  const { error } = await db.from('rmt_chart_snapshots').insert({ source, names, captured_at: capturedAt.toISOString() })
  if (error) throw new Error(`rmt_chart_snapshots insert failed: ${error.message}`)
}

export async function loadCatalogueTitles(db: Db): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await db.from('games').select('slug, name, display_name')
  if (error) throw new Error(`games read failed: ${error.message}`)
  const out: { slug: string; name: string }[] = []
  for (const g of (data ?? []) as any[]) {
    out.push({ slug: g.slug, name: g.name })
    if (g.display_name && g.display_name !== g.name) out.push({ slug: g.slug, name: g.display_name })
  }
  return out
}
