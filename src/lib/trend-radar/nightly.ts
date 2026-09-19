/**
 * Nightly maintenance: roll raw metrics past the retention window into
 * game_metrics_daily and prune them; flag approved trend-radar games whose
 * recent max playing has fallen under `decayPct` of their detection peak as
 * `declining` (one admin notification, nothing deactivated or deleted).
 *
 * All aggregation is done here in TypeScript over PostgREST reads: the raw
 * table grows ~4 rows/universe/day, so a night's slice is a few thousand rows
 * at most, and this keeps the migration free of SQL functions.
 */
import { DEFAULT_CONFIG, type TrendConfig } from './config'
import { DAYS, type Db } from './store'

export interface NightlyDeps {
  db: Db
  config?: TrendConfig
  now?: Date
  /** Admin notification seam (default: lib/utils/notifications.notifyAdmins). */
  notify?: (n: { title: string; message: string; link?: string }) => Promise<void>
  siteUrl?: string
}

export interface NightlySummary {
  rollup: { rawPruned: number; daysWritten: number }
  decay: { checked: number; declining: string[] }
}

export async function runNightly(deps: NightlyDeps): Promise<NightlySummary> {
  const { db, config = DEFAULT_CONFIG, now = new Date(), siteUrl = '' } = deps
  const notify =
    deps.notify ??
    (async (n) => {
      const { notifyAdmins } = await import('@/lib/utils/notifications')
      await notifyAdmins({ permission: 'settings.view', type: 'trend_declining', ...n })
    })

  return {
    rollup: await rollup(db, config, now),
    decay: await decay(db, config, now, notify, siteUrl),
  }
}

async function rollup(db: Db, config: TrendConfig, now: Date): Promise<NightlySummary['rollup']> {
  const cutoff = new Date(now.getTime() - config.metricsRetentionDays * DAYS).toISOString()
  const { data, error } = await db
    .from('game_metrics')
    .select('id, platform, external_id, playing, captured_at')
    .lt('captured_at', cutoff)
    .order('captured_at', { ascending: true })
    .limit(5000)
  if (error) throw new Error(`game_metrics rollup read failed: ${error.message}`)
  const rows = (data ?? []) as { id: number; platform: string; external_id: string; playing: number; captured_at: string }[]
  if (rows.length === 0) return { rawPruned: 0, daysWritten: 0 }

  const agg = new Map<string, { platform: string; external_id: string; day: string; max: number; sum: number; n: number }>()
  for (const r of rows) {
    const day = r.captured_at.slice(0, 10)
    const key = `${r.platform}|${r.external_id}|${day}`
    const cur = agg.get(key) ?? { platform: r.platform, external_id: r.external_id, day, max: 0, sum: 0, n: 0 }
    cur.max = Math.max(cur.max, r.playing)
    cur.sum += r.playing
    cur.n += 1
    agg.set(key, cur)
  }

  // Merge with an existing daily row (a previous partial night) before upserting.
  const daily = [...agg.values()]
  for (let i = 0; i < daily.length; i += 200) {
    const slice = daily.slice(i, i + 200)
    const { data: existing } = await db
      .from('game_metrics_daily')
      .select('platform, external_id, day, max_playing, avg_playing, samples')
      .in('external_id', slice.map((d) => d.external_id))
      .in('day', slice.map((d) => d.day))
    const prev = new Map(((existing ?? []) as any[]).map((e) => [`${e.platform}|${e.external_id}|${e.day}`, e]))
    const payload = slice.map((d) => {
      const p = prev.get(`${d.platform}|${d.external_id}|${d.day}`)
      const samples = d.n + (p?.samples ?? 0)
      const sum = d.sum + (p ? p.avg_playing * p.samples : 0)
      return {
        platform: d.platform,
        external_id: d.external_id,
        day: d.day,
        max_playing: Math.max(d.max, p?.max_playing ?? 0),
        avg_playing: Math.round(sum / samples),
        samples,
      }
    })
    const { error: ue } = await db.from('game_metrics_daily').upsert(payload, { onConflict: 'platform,external_id,day' })
    if (ue) throw new Error(`game_metrics_daily upsert failed: ${ue.message}`)
  }

  const ids = rows.map((r) => r.id)
  for (let i = 0; i < ids.length; i += 500) {
    const { error: de } = await db.from('game_metrics').delete().in('id', ids.slice(i, i + 500))
    if (de) throw new Error(`game_metrics prune failed: ${de.message}`)
  }
  return { rawPruned: ids.length, daysWritten: daily.length }
}

async function decay(
  db: Db,
  config: TrendConfig,
  now: Date,
  notify: NonNullable<NightlyDeps['notify']>,
  siteUrl: string,
): Promise<NightlySummary['decay']> {
  const { data, error } = await db
    .from('games')
    .select('id, slug, name, trend_peak_playing, external:game_external_ids!game_external_ids_game_id_fkey(platform, external_id)')
    .eq('source', 'trend-radar')
    .eq('review_status', 'approved')
    .not('trend_peak_playing', 'is', null)
  if (error) throw new Error(`games decay read failed: ${error.message}`)
  const games = ((data ?? []) as any[])
    .map((g) => ({
      id: g.id as string,
      slug: g.slug as string,
      name: g.name as string,
      peak: Number(g.trend_peak_playing),
      universeId: (g.external ?? []).find((x: any) => x.platform === 'roblox')?.external_id as string | undefined,
    }))
    .filter((g) => g.universeId && g.peak > 0)
  if (games.length === 0) return { checked: 0, declining: [] }

  const since = new Date(now.getTime() - config.decayWindowDays * DAYS).toISOString()
  const { data: metrics, error: me } = await db
    .from('game_metrics')
    .select('external_id, playing')
    .eq('platform', 'roblox')
    .in('external_id', games.map((g) => g.universeId!))
    .gte('captured_at', since)
    .lte('captured_at', now.toISOString())
  if (me) throw new Error(`game_metrics decay read failed: ${me.message}`)
  const maxByUniverse = new Map<string, number>()
  for (const m of (metrics ?? []) as { external_id: string; playing: number }[]) {
    maxByUniverse.set(m.external_id, Math.max(maxByUniverse.get(m.external_id) ?? 0, m.playing))
  }

  const declining: string[] = []
  for (const g of games) {
    const max = maxByUniverse.get(g.universeId!)
    if (max === undefined) continue // no samples in the window: no verdict
    if (max >= (config.decayPct / 100) * g.peak) continue
    const { error: ue } = await db
      .from('games')
      .update({
        review_status: 'declining',
        review_note: `Trend radar: ${config.decayWindowDays}-day max playing ${max.toLocaleString('en-US')} is below ${config.decayPct}% of detection peak ${g.peak.toLocaleString('en-US')} (${now.toISOString().slice(0, 10)}).`,
      })
      .eq('id', g.id)
      .eq('review_status', 'approved')
    if (ue) throw new Error(`games decay update failed: ${ue.message}`)
    declining.push(g.slug)
    await notify({
      title: `Trend radar: ${g.name} is declining`,
      message: `${g.slug}: ${config.decayWindowDays}-day max playing ${max.toLocaleString('en-US')} vs detection peak ${g.peak.toLocaleString('en-US')}. Nothing was deactivated.`,
      link: `${siteUrl}/admin/games?status=declining#${g.slug}`,
    }).catch((e) => console.error('trend radar decay notify failed:', e))
  }
  return { checked: games.length, declining }
}
