'use server'

/**
 * /admin/seo — index health and the value-page data gate. Admin-only (the
 * (admin) layout gates the page; every action re-checks the role). Reads and
 * writes go through the service role: these tables have no session policies.
 */
import { revalidatePath, revalidateTag } from 'next/cache'

import { SITE_URL } from '@/config/site'
import { requireRole } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { fetchAllRows } from '@/lib/seo/paged-read'
import { isValueItemIndexable, passesValueDataGate, VALUE_GATE_MIN_HISTORY_DAYS, VALUE_GATE_MIN_OBSERVATIONS } from '@/lib/games/indexability'
import { valueItemHasPage } from '@/lib/values/hub-config'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { SEO_GATE_TAG } from '@/lib/seo/gate/settings'
import { recordAndFlush } from '@/lib/seo/events/log'

const ROLES = ['admin', 'super_admin'] as const

/**
 * The value pages the gate can actually show or hide: `game/item` keys. The
 * evidence table also holds pipeline items with no indexable page (MM2 commons
 * have no page; a priced item under 3 live listings is noindex by the older
 * rule), so counting every row inflated the table (1,067 "MM2 pages" vs 213).
 * Steal a Brainrot and Adopt Me rows are all real pages.
 */
async function pipelinePageKeys(db: any): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const game of VALUES_PIPELINE_GAMES) {
    const items = await fetchAllRows<{ slug: string; rarity: string | null; values_prices: { sample_size: number | null; cheapest_usd: number | null } | { sample_size: number | null; cheapest_usd: number | null }[] | null }>(
      (f, t) =>
        db
          .from('values_items')
          .select('id, slug, rarity, games!inner(slug), values_prices(sample_size, cheapest_usd)')
          .eq('games.slug', game)
          .eq('is_enabled', true)
          .order('id')
          .range(f, t),
    )
    for (const i of items) {
      const p = Array.isArray(i.values_prices) ? i.values_prices[0] : i.values_prices
      const priced = p?.cheapest_usd != null
      if (priced && valueItemHasPage(game, { rarity: i.rarity, priced }) && isValueItemIndexable({ priced, sampleSize: p?.sample_size })) {
        keys.add(`${game}/${i.slug}`)
      }
    }
  }
  return keys
}

const isPipeline = (game: string) => VALUES_PIPELINE_GAMES.has(game)

export interface GateGameRow {
  game: string
  pages: number
  passing: number
  /** Failing and would be hidden once enforced (not protected, no owner decision). */
  wouldHide: number
  /** Failing, but Google has it indexed or it earned clicks: kept until the owner decides. */
  protectedFailing: number
}

export interface DecisionRow {
  path: string
  observations: number
  historyDays: number
  hasPrice: boolean
  override: 'index' | 'noindex' | null
}

export interface SeoHealth {
  mode: 'report' | 'enforce'
  plannedEnforceOn: string | null
  enforcedSince: string | null
  thresholds: { observations: number; historyDays: number }
  gate: GateGameRow[]
  /** Failing pages Google has indexed or that earned clicks — the owner's call. */
  decisions: DecisionRow[]
  sectionsDay: string | null
  sections: { section: string; sitemapUrls: number; inspected: number; indexed: number; clicks: number; impressions: number; indexedWeekAgo: number | null; inspectedWeekAgo: number | null }[]
  alerts: { id: number; kind: string; message: string; createdAt: string; posted: boolean }[]
  events: { pending: number; failed: number; sent24h: number; recentFailed: { url: string; reason: string; error: string | null; attempts: number }[] }
}

export async function getSeoHealth(): Promise<{ ok: true; data: SeoHealth } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  const db = createServiceRoleClient() as any
  try {
    const since24h = new Date(Date.now() - 86_400_000).toISOString()
    const [settings, evidence, overrides, latestDay, alerts, pending, failed, sent, recentFailed, pipelinePages] = await Promise.all([
      db.from('seo_settings').select('gate_mode, planned_enforce_on, enforced_since').eq('id', 1).maybeSingle(),
      fetchAllRows<{ game_slug: string; item_slug: string; observations: number; history_days: number; value_usd: number | null; is_protected: boolean }>((f, t) =>
        db.from('seo_value_evidence').select('game_slug, item_slug, observations, history_days, value_usd, is_protected').order('game_slug').order('item_slug').range(f, t),
      ),
      db.from('seo_index_overrides').select('path, verdict').limit(1000),
      db.from('seo_section_daily').select('day').order('day', { ascending: false }).limit(1).maybeSingle(),
      db.from('seo_alerts').select('id, kind, message, created_at, posted_at').order('created_at', { ascending: false }).limit(30),
      db.from('seo_url_events').select('id', { count: 'exact', head: false }).eq('indexnow_status', 'pending').limit(1),
      db.from('seo_url_events').select('id', { count: 'exact', head: false }).eq('indexnow_status', 'failed').limit(1),
      db.from('seo_url_events').select('id', { count: 'exact', head: false }).eq('indexnow_status', 'sent').gte('sent_at', since24h).limit(1),
      db.from('seo_url_events').select('url, reason, last_error, attempts').eq('indexnow_status', 'failed').order('changed_at', { ascending: false }).limit(10),
      pipelinePageKeys(db),
    ])
    for (const r of [settings, overrides, latestDay, alerts, pending, failed, sent, recentFailed]) if (r.error) throw new Error(r.error.message)

    const overrideBy = new Map<string, 'index' | 'noindex'>(((overrides.data ?? []) as { path: string; verdict: 'index' | 'noindex' }[]).map((o) => [o.path, o.verdict]))
    const games = new Map<string, GateGameRow>()
    const decisions: DecisionRow[] = []
    for (const e of evidence) {
      if (isPipeline(e.game_slug) && !pipelinePages.has(`${e.game_slug}/${e.item_slug}`)) continue
      const g = games.get(e.game_slug) ?? { game: e.game_slug, pages: 0, passing: 0, wouldHide: 0, protectedFailing: 0 }
      g.pages += 1
      const path = `/${e.game_slug}/values/${e.item_slug}`
      const passes = passesValueDataGate({ valueUsd: e.value_usd == null ? null : Number(e.value_usd), observations: e.observations, historyDays: e.history_days })
      const override = overrideBy.get(path) ?? null
      if (passes) g.passing += 1
      else if (e.is_protected) {
        g.protectedFailing += 1
        decisions.push({ path, observations: e.observations, historyDays: e.history_days, hasPrice: e.value_usd != null, override })
      } else if (!override) g.wouldHide += 1
      games.set(e.game_slug, g)
    }

    const day = (latestDay.data as { day: string } | null)?.day ?? null
    let sections: SeoHealth['sections'] = []
    if (day) {
      const weekAgo = new Date(Date.parse(`${day}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
      const [now, before] = await Promise.all([
        db.from('seo_section_daily').select('section, sitemap_urls, inspected, indexed, clicks, impressions').eq('day', day).order('section'),
        db.from('seo_section_daily').select('section, inspected, indexed').eq('day', weekAgo),
      ])
      if (now.error) throw new Error(now.error.message)
      const prev = new Map(((before.data ?? []) as { section: string; inspected: number; indexed: number }[]).map((r) => [r.section, r]))
      sections = ((now.data ?? []) as any[]).map((r) => ({
        section: r.section,
        sitemapUrls: r.sitemap_urls,
        inspected: r.inspected,
        indexed: r.indexed,
        clicks: r.clicks,
        impressions: r.impressions,
        indexedWeekAgo: prev.get(r.section)?.indexed ?? null,
        inspectedWeekAgo: prev.get(r.section)?.inspected ?? null,
      }))
    }

    const s = settings.data as { gate_mode: string; planned_enforce_on: string | null; enforced_since: string | null } | null
    return {
      ok: true,
      data: {
        mode: s?.gate_mode === 'enforce' ? 'enforce' : 'report',
        plannedEnforceOn: s?.planned_enforce_on ?? null,
        enforcedSince: s?.enforced_since ?? null,
        thresholds: { observations: VALUE_GATE_MIN_OBSERVATIONS, historyDays: VALUE_GATE_MIN_HISTORY_DAYS },
        gate: [...games.values()].sort((a, b) => a.game.localeCompare(b.game)),
        decisions: decisions.sort((a, b) => a.path.localeCompare(b.path)),
        sectionsDay: day,
        sections,
        alerts: ((alerts.data ?? []) as any[]).map((a) => ({ id: a.id, kind: a.kind, message: a.message, createdAt: a.created_at, posted: !!a.posted_at })),
        events: {
          pending: pending.count ?? 0,
          failed: failed.count ?? 0,
          sent24h: sent.count ?? 0,
          recentFailed: ((recentFailed.data ?? []) as any[]).map((r) => ({ url: r.url, reason: r.reason, error: r.last_error, attempts: r.attempts })),
        },
      },
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Value pages whose verdict changes when the gate mode flips (fail the gate, not protected, no owner decision). */
async function flippingPaths(db: any): Promise<string[]> {
  const [evidence, overrides, pipelinePages] = await Promise.all([
    fetchAllRows<{ game_slug: string; item_slug: string; observations: number; history_days: number; value_usd: number | null; is_protected: boolean }>((f, t) =>
      db.from('seo_value_evidence').select('game_slug, item_slug, observations, history_days, value_usd, is_protected').order('game_slug').order('item_slug').range(f, t),
    ),
    db.from('seo_index_overrides').select('path').limit(1000),
    pipelinePageKeys(db),
  ])
  const decided = new Set(((overrides.data ?? []) as { path: string }[]).map((o) => o.path))
  return evidence
    .filter((e) => !isPipeline(e.game_slug) || pipelinePages.has(`${e.game_slug}/${e.item_slug}`))
    .filter((e) => !e.is_protected && !passesValueDataGate({ valueUsd: e.value_usd == null ? null : Number(e.value_usd), observations: e.observations, historyDays: e.history_days }))
    .map((e) => `/${e.game_slug}/values/${e.item_slug}`)
    .filter((p) => !decided.has(p))
}

function refreshGateReaders() {
  // Every value page reads the gate config under this tag; the sitemap follows within the hour.
  revalidateTag(SEO_GATE_TAG)
  revalidatePath('/admin/seo')
}

/** The one-click switch. Enforcing noindexes the failing pages and logs them for IndexNow (and the reverse). */
export async function setSeoGateMode(mode: 'report' | 'enforce'): Promise<{ ok: true; flipped: number } | { ok: false; error: string }> {
  const admin = await requireRole([...ROLES])
  if (mode !== 'report' && mode !== 'enforce') return { ok: false, error: 'Unknown mode' }
  const db = createServiceRoleClient() as any
  const now = new Date().toISOString()
  const { error } = await db
    .from('seo_settings')
    .update({ gate_mode: mode, enforced_since: mode === 'enforce' ? now : null, updated_by: admin.userId, updated_at: now })
    .eq('id', 1)
  if (error) return { ok: false, error: error.message }
  const paths = await flippingPaths(db)
  if (paths.length > 0) await recordAndFlush(paths, mode === 'enforce' ? 'gate-demote' : 'gate-promote')
  refreshGateReaders()
  return { ok: true, flipped: paths.length }
}

export async function setSeoPlannedEnforceDate(date: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Use a YYYY-MM-DD date' }
  const { error } = await (createServiceRoleClient() as any).from('seo_settings').update({ planned_enforce_on: date, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/seo')
  return { ok: true }
}

/** The owner's call on one value page: keep it indexed, hide it, or clear the decision (back to the gate). */
export async function setSeoIndexOverride(path: string, verdict: 'index' | 'noindex' | null): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  if (!/^\/[a-z0-9-]+\/values\/[a-z0-9-]+$/.test(path)) return { ok: false, error: 'Not a value page path' }
  const db = createServiceRoleClient() as any
  const res =
    verdict === null
      ? await db.from('seo_index_overrides').delete().eq('path', path)
      : await db.from('seo_index_overrides').upsert({ path, verdict, reason: `admin ${new Date().toISOString().slice(0, 10)}`, decided_at: new Date().toISOString() }, { onConflict: 'path' })
  if (res.error) return { ok: false, error: res.error.message }
  await recordAndFlush([`${SITE_URL}${path}`], verdict === 'noindex' ? 'override-noindex' : 'override-index')
  refreshGateReaders()
  return { ok: true }
}
