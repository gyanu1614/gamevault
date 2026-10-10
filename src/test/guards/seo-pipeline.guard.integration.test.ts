/**
 * Growth point 28 — the SEO pipeline tables (migration 20261009210010) on a
 * real database:
 *   · posture: anon may READ the three tables a static page needs for its
 *     robots meta (settings, evidence, overrides) and nothing else; nobody but
 *     the service role writes, or runs seo_value_series;
 *   · the owner's five no-price Brainrot overrides and the report-only default
 *     are seeded;
 *   · seo_value_series + refreshValueEvidence end to end on a pipeline game:
 *     offers, distinct history days, the backfilled last material move, and a
 *     re-run with the same data changes nothing;
 *   · the change-log store: insert → due → sent.
 * Every row it writes is minted under this file's namespace and removed.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { ANON, SVC, URL, assertGuardTargetAllowed, hasEnv } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { refreshValueEvidence } from '@/lib/seo/gate/refresh'
import { supabaseUrlEventStore } from '@/lib/seo/events/log'

const ns = fixtureNamespace()
const GAME = 'murder-mystery-2'
const SITE = 'https://dropmarket.gg'
const itemSlug = `guard-test-${ns.tag}-knife`
const eventUrl = `${SITE}/guard-test-${ns.tag}`

let svc: SupabaseClient
let anon: SupabaseClient
let gameId = ''
let itemId = ''

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, 20 + i)).toISOString().slice(0, 10))

describe.skipIf(!hasEnv)('SEO pipeline tables (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { data: game, error } = await svc.from('games').select('id').eq('slug', GAME).single()
    if (error) throw new Error(`game ${GAME}: ${error.message}`)
    gameId = (game as { id: string }).id
    const { data: item, error: ie } = await svc
      .from('values_items')
      .insert({ game_id: gameId, kind: 'item', slug: itemSlug, name: `Guard ${ns.tag}`, rarity: 'Godly', is_enabled: true, is_priced: true, obtain: [] })
      .select('id')
      .single()
    if (ie) throw new Error(`values_items insert: ${ie.message}`)
    itemId = (item as { id: string }).id
    const { error: pe } = await svc.from('values_prices').insert({ item_id: itemId, game_id: gameId, cheapest_usd: 12, sample_size: 9, source_count: 1, price_changed_at: '2026-10-08T00:00:00Z' })
    if (pe) throw new Error(`values_prices insert: ${pe.message}`)
    // 8 days: 10 for five days, then 12 (a 20% move on day 6).
    const { error: he } = await svc.from('values_price_history').insert(
      days(8).map((d, i) => ({ item_id: itemId, game_id: gameId, history_date: d, cheapest_usd: i < 5 ? 10 : 12, sample_size: 9 })),
    )
    if (he) throw new Error(`values_price_history insert: ${he.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!svc) return
    const failures: string[] = []
    const del = async (what: string, q: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await q
      if (error) failures.push(`${what}: ${error.message}`)
    }
    await del('seo_value_evidence', svc.from('seo_value_evidence').delete().eq('game_slug', GAME).like('item_slug', `guard-test-${ns.key}%`))
    await del('seo_url_events', svc.from('seo_url_events').delete().like('url', `${SITE}/%guard-test-${ns.key}%`))
    // values_prices / values_price_history go with the item (ON DELETE CASCADE).
    if (itemId) await del('values_items', svc.from('values_items').delete().eq('id', itemId))
    const { count } = await svc.from('values_items').select('id', { count: 'exact', head: false }).like('slug', `guard-test-${ns.key}%`)
    if (count) failures.push(`${count} values_items residue`)
    expect(failures).toEqual([])
  }, 60_000)

  it('anon reads settings, evidence and overrides — and cannot write them', async () => {
    for (const t of ['seo_value_evidence', 'seo_index_overrides']) {
      const { error } = await anon.from(t).select('*').limit(1)
      expect(error, t).toBeNull()
    }
    // Settings: only the public columns (who changed it and the deploy id stay private).
    expect((await anon.from('seo_settings').select('id, gate_mode, planned_enforce_on, enforced_since').limit(1)).error).toBeNull()
    expect((await anon.from('seo_settings').select('updated_by').limit(1)).error?.code).toBe('42501')
    const ins = await anon.from('seo_index_overrides').insert({ path: `/x/values/${itemSlug}`, verdict: 'index', reason: 'x' })
    expect(ins.error?.code).toBe('42501')
    const upd = await anon.from('seo_settings').update({ gate_mode: 'enforce' }).eq('id', 1).select()
    expect(upd.error?.code ?? (upd.data?.length === 0 ? 'no-rows' : 'updated')).not.toBe('updated')
  })

  it('anon can read none of the log/monitoring tables, nor run seo_value_series', async () => {
    for (const t of ['seo_url_events', 'seo_url_inspections', 'seo_section_daily', 'seo_alerts']) {
      const { error } = await anon.from(t).select('*').limit(1)
      expect(error?.code, t).toBe('42501')
    }
    const { error } = await anon.rpc('seo_value_series', { p_source: 'pipeline', p_game_slug: GAME })
    expect(error).not.toBeNull()
  })

  it('ships report-only, with the five no-price Brainrot pages hidden by the owner', async () => {
    const { data: s } = await svc.from('seo_settings').select('gate_mode, planned_enforce_on').eq('id', 1).single()
    expect(s).toMatchObject({ gate_mode: 'report', planned_enforce_on: '2026-10-16' })
    const { data: o } = await svc.from('seo_index_overrides').select('path, verdict').like('path', '/steal-a-brainrot/values/%')
    expect((o ?? []).map((r: any) => r.path.split('/').pop()).sort()).toEqual(
      ['berenjello-angello', 'dolphini-jetskini', 'fizzy-soda', 'malame-amarele', 'noo-la-polizia'],
    )
    expect((o ?? []).every((r: any) => r.verdict === 'noindex')).toBe(true)
  })

  it('seo_value_series returns the history in date order', async () => {
    const { data, error } = await svc.rpc('seo_value_series', { p_source: 'pipeline', p_game_slug: GAME })
    expect(error).toBeNull()
    const row = (data as any[]).find((r) => r.item_slug === itemSlug)
    expect(row.days).toEqual(days(8))
    expect(row.vals.map(Number)).toEqual([10, 10, 10, 10, 10, 12, 12, 12])
  })

  it('refreshes the evidence: offers, days, the backfilled last material move; a re-run changes nothing', async () => {
    const record = vi.fn(async () => undefined)
    const now = '2026-10-09T12:00:00.000Z'
    const first = await refreshValueEvidence(svc, GAME, { now, record, siteUrl: SITE })
    expect(first?.moved).not.toContain(itemSlug)
    const { data: ev } = await svc.from('seo_value_evidence').select('*').eq('game_slug', GAME).eq('item_slug', itemSlug).single()
    expect(ev).toMatchObject({ observations: 9, history_days: 8, passes_gate: true, price_moved_at: `${days(8)[5]}T00:00:00+00:00` })
    expect(Number((ev as any).value_usd)).toBe(12)

    const again = await refreshValueEvidence(svc, GAME, { now: '2026-10-09T13:00:00.000Z', record, siteUrl: SITE })
    expect(again?.moved).not.toContain(itemSlug)
    expect(again?.flipped).not.toContain(itemSlug)
    const { data: ev2 } = await svc.from('seo_value_evidence').select('price_moved_at').eq('game_slug', GAME).eq('item_slug', itemSlug).single()
    expect((ev2 as any).price_moved_at).toBe((ev as any).price_moved_at)
    expect(record).not.toHaveBeenCalled()
  })

  it('the change-log store: insert, then due, then sent', async () => {
    const store = supabaseUrlEventStore(svc)
    await store.insert([{ url: eventUrl, reason: 'guard-test' }])
    const due = (await store.due(500, new Date(Date.now() + 1000).toISOString())).filter((r) => r.url === eventUrl)
    expect(due).toHaveLength(1)
    await store.markSent([due[0].id], new Date().toISOString())
    const { data } = await svc.from('seo_url_events').select('indexnow_status, sent_at').eq('id', due[0].id).single()
    expect((data as any).indexnow_status).toBe('sent')
  })
})
