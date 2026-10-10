import { SITE_URL } from '@/config/site'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { fetchAllRows } from '@/lib/seo/paged-read'
import { valuePageUrls } from '@/lib/seo/indexnow/value-changes'
import { logUrlEvents } from '@/lib/seo/indexnow/log-events'
import type { SubmitFn } from '@/lib/seo/indexnow/submit'

import { nextEvidence, type ItemCurrent, type ItemSeries, type StoredEvidence } from './evidence'
import { readGateMode } from './settings'

/**
 * Refresh seo_value_evidence for one game after its prices were published (and
 * nightly as a backstop): read the current prices + offer counts, the daily
 * history (seo_value_series) and the stored anchors, compute each page's
 * evidence (./evidence), write it, then
 *  - log `value-change:<game>` for pages whose price moved materially (the
 *    value page plus the hub pages its number feeds: valuePageUrls) — this
 *    replaces the old per-run IndexNow comparison;
 *  - log `gate-promote` / `gate-demote` when a page crossed the data gate and
 *    the gate is enforced;
 *  - revalidate the item page of every page whose date or verdict changed.
 * Idempotent: a second run with the same data changes nothing.
 */
export type ValueSource = 'sab' | 'adopt-me' | 'pipeline'

export function valueSourceOf(gameSlug: string): ValueSource | null {
  if (gameSlug === 'steal-a-brainrot') return 'sab'
  if (gameSlug === 'adopt-me') return 'adopt-me'
  if (VALUES_PIPELINE_GAMES.has(gameSlug)) return 'pipeline'
  return null
}

export const VALUE_EVIDENCE_GAMES = ['steal-a-brainrot', 'adopt-me', ...VALUES_PIPELINE_GAMES]

type Db = any
const num = (v: unknown): number | null => (v == null || Number.isNaN(Number(v)) ? null : Number(v))

/** Adopt Me's headline variant: Fly Ride (the most traded) when it has a real price, else the best-covered one. */
export function adoptMeHeadline(
  variants: { variant: string; cashUsd: number | null; offers: number; estimated: boolean }[],
): { variant: string; cashUsd: number; offers: number } | null {
  const real = variants.filter((v) => v.cashUsd != null && !v.estimated) as { variant: string; cashUsd: number; offers: number }[]
  return real.find((v) => v.variant === 'FR') ?? [...real].sort((a, b) => b.offers - a.offers)[0] ?? null
}

async function loadCurrent(db: Db, source: ValueSource, gameSlug: string): Promise<Map<string, ItemCurrent>> {
  const out = new Map<string, ItemCurrent>()
  if (source === 'sab') {
    const [catalog, prices] = await Promise.all([
      fetchAllRows<{ slug: string | null }>((f, t) => db.from('sab_brainrot_catalog').select('slug').order('slug').range(f, t)),
      fetchAllRows<{ brainrot_slug: string | null; market_value_usd: number | null; external_sample_size: number | null; price_updated_at: string | null }>(
        (f, t) =>
          db
            .from('sab_price_display')
            .select('brainrot_slug, market_value_usd, external_sample_size, price_updated_at')
            .eq('mutation_slug', 'default')
            .order('brainrot_id')
            .range(f, t),
      ),
    ])
    for (const c of catalog) if (c.slug) out.set(c.slug, { observations: 0, valueUsd: null, values: { '': null } })
    for (const p of prices) {
      if (!p.brainrot_slug || !out.has(p.brainrot_slug)) continue
      const value = num(p.market_value_usd)
      out.set(p.brainrot_slug, {
        observations: value == null ? 0 : (p.external_sample_size ?? 0),
        valueUsd: value,
        values: { '': value },
        sourceChangedAt: p.price_updated_at,
      })
    }
    return out
  }
  if (source === 'adopt-me') {
    const [pets, values] = await Promise.all([
      fetchAllRows<{ id: string; slug: string }>((f, t) => db.from('adopt_me_pets').select('id, slug').eq('has_page', true).order('id').range(f, t)),
      fetchAllRows<{ pet_id: string; variant: string; cash_value_usd: number | null; reputable_count: number | null; is_estimated: boolean; last_priced_at: string | null }>(
        (f, t) =>
          db
            .from('adopt_me_pet_values')
            .select('pet_id, variant, cash_value_usd, reputable_count, is_estimated, last_priced_at')
            .order('id')
            .range(f, t),
      ),
    ])
    const byPet = new Map<string, typeof values>()
    for (const v of values) byPet.set(v.pet_id, [...(byPet.get(v.pet_id) ?? []), v])
    for (const pet of pets) {
      const rows = byPet.get(pet.id) ?? []
      const variants = rows.map((r) => ({ variant: r.variant, cashUsd: num(r.cash_value_usd), offers: r.reputable_count ?? 0, estimated: r.is_estimated }))
      const headline = adoptMeHeadline(variants)
      const real = variants.filter((v) => v.cashUsd != null && !v.estimated)
      out.set(pet.slug, {
        observations: real.reduce((m, v) => Math.max(m, v.offers), 0),
        valueUsd: headline?.cashUsd ?? null,
        values: Object.fromEntries(variants.map((v) => [v.variant, v.estimated ? null : v.cashUsd])),
        sourceChangedAt: rows.reduce<string | null>((m, r) => (r.last_priced_at && (!m || r.last_priced_at > m) ? r.last_priced_at : m), null),
      })
    }
    return out
  }
  const items = await fetchAllRows<{
    slug: string
    values_prices: { sample_size: number | null; cheapest_usd: number | null; price_changed_at: string | null } | { sample_size: number | null; cheapest_usd: number | null; price_changed_at: string | null }[] | null
  }>((f, t) =>
    db
      .from('values_items')
      .select('id, slug, games!inner(slug), values_prices(sample_size, cheapest_usd, price_changed_at)')
      .eq('games.slug', gameSlug)
      .eq('is_enabled', true)
      .order('id')
      .range(f, t),
  )
  for (const i of items) {
    const p = Array.isArray(i.values_prices) ? i.values_prices[0] : i.values_prices
    const value = num(p?.cheapest_usd)
    out.set(i.slug, {
      observations: value == null ? 0 : (p?.sample_size ?? 0),
      valueUsd: value,
      values: { '': value },
      sourceChangedAt: p?.price_changed_at ?? null,
    })
  }
  return out
}

async function loadSeries(db: Db, source: ValueSource, gameSlug: string): Promise<Map<string, ItemSeries>> {
  const rows = await fetchAllRows<{ item_slug: string; series_key: string; days: string[]; vals: (number | string | null)[] }>((f, t) =>
    db
      .rpc('seo_value_series', { p_source: source, p_game_slug: gameSlug })
      .order('item_slug')
      .order('series_key')
      .range(f, t),
  )
  const out = new Map<string, ItemSeries>()
  for (const r of rows) {
    const series = out.get(r.item_slug) ?? {}
    series[r.series_key] = r.days.map((day, i) => ({ day, value: num(r.vals[i]) }))
    out.set(r.item_slug, series)
  }
  return out
}

export interface RefreshResult {
  game: string
  items: number
  moved: string[]
  flipped: string[]
}

export async function refreshValueEvidence(
  db: Db,
  gameSlug: string,
  deps: { now?: string; revalidateItem?: (gameSlug: string, itemSlug: string) => void; record?: SubmitFn; siteUrl?: string } = {},
): Promise<RefreshResult | null> {
  const source = valueSourceOf(gameSlug)
  if (!source) return null
  const now = deps.now ?? new Date().toISOString()
  const record = deps.record ?? logUrlEvents
  const siteUrl = deps.siteUrl ?? SITE_URL
  const valuesPrefix = `${siteUrl}/${gameSlug}/values/`

  const [current, series, stored, inspections, mode] = await Promise.all([
    loadCurrent(db, source, gameSlug),
    loadSeries(db, source, gameSlug),
    fetchAllRows<{ item_slug: string; anchors: Record<string, number | null> | null; price_moved_at: string | null; passes_gate: boolean; passes_changed_at: string | null }>(
      (f, t) =>
        db
          .from('seo_value_evidence')
          .select('item_slug, anchors, price_moved_at, passes_gate, passes_changed_at')
          .eq('game_slug', gameSlug)
          .order('item_slug')
          .range(f, t),
    ),
    fetchAllRows<{ url: string; verdict: string | null; clicks_90d: number | null }>((f, t) =>
      db.from('seo_url_inspections').select('url, verdict, clicks_90d').like('url', `${valuesPrefix}%`).order('url').range(f, t),
    ),
    readGateMode(db),
  ])
  const storedBySlug = new Map<string, StoredEvidence>(
    stored.map((s) => [
      s.item_slug,
      { anchors: s.anchors ?? {}, priceMovedAt: s.price_moved_at, passesGate: s.passes_gate, passesChangedAt: s.passes_changed_at },
    ]),
  )
  const protectedSlugs = new Set(
    inspections.filter((i) => i.verdict === 'PASS' || (i.clicks_90d ?? 0) > 0).map((i) => i.url.slice(valuesPrefix.length)),
  )

  const rows: Record<string, unknown>[] = []
  const moved: string[] = []
  const flipped: { slug: string; passes: boolean }[] = []
  for (const [slug, cur] of current) {
    const r = nextEvidence({ current: cur, series: series.get(slug) ?? {}, stored: storedBySlug.get(slug) ?? null, now, isProtected: protectedSlugs.has(slug) })
    if (r.priceMoved) moved.push(slug)
    if (r.gateFlipped) flipped.push({ slug, passes: r.row.passesGate })
    rows.push({
      game_slug: gameSlug,
      item_slug: slug,
      observations: r.row.observations,
      history_days: r.row.historyDays,
      value_usd: r.row.valueUsd,
      anchors: r.row.anchors,
      price_moved_at: r.row.priceMovedAt,
      passes_gate: r.row.passesGate,
      passes_changed_at: r.row.passesChangedAt,
      is_protected: r.row.isProtected,
      refreshed_at: now,
    })
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('seo_value_evidence').upsert(rows.slice(i, i + 500), { onConflict: 'game_slug,item_slug' })
    if (error) throw new Error(`seo_value_evidence upsert: ${error.message}`)
  }

  if (moved.length > 0) await record(valuePageUrls(gameSlug, moved), { reason: `value-change:${gameSlug}` })
  if (mode === 'enforce') {
    const promoted = flipped.filter((f) => f.passes).map((f) => `/${gameSlug}/values/${f.slug}`)
    const demoted = flipped.filter((f) => !f.passes).map((f) => `/${gameSlug}/values/${f.slug}`)
    if (promoted.length > 0) await record(promoted, { reason: 'gate-promote' })
    if (demoted.length > 0) await record(demoted, { reason: 'gate-demote' })
  }
  for (const slug of new Set([...moved, ...flipped.map((f) => f.slug)])) deps.revalidateItem?.(gameSlug, slug)

  return { game: gameSlug, items: rows.length, moved, flipped: flipped.map((f) => f.slug) }
}
