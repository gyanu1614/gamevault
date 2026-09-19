import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from '@/test/guards/throwaway'
import getSortsFixture from './__fixtures__/roblox-get-sorts.json'
import { runCollect } from './collect'
import { createPacer, type FetchLike } from './roblox'
import { DEFAULT_CONFIG } from './config'

// Everything this file writes carries a 2001 timestamp so cleanup is a range
// delete and a crashed run cannot leave rows that look current.
const NOW = new Date('2001-01-10T12:00:00Z')
const TAG = `s2c${Date.now().toString(36)}`
const BLOX_FRUITS = 994732206 // in the fixture's top list — becomes a catalogue game
const STEAL_AN_EGG = 10563114921 // #1 in the fixture, NOT in the catalogue

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const fixtureFetch: FetchLike = async (url) => {
  const u = String(url)
  if (u.includes('get-sorts')) return json(getSortsFixture)
  if (u.includes('games.roblox.com/v1/games?')) {
    const ids = new URL(u).searchParams.get('universeIds')!.split(',').map(Number)
    return json({ data: ids.map((id) => ({ id, rootPlaceId: id * 10, name: `U${id}`, playing: id === STEAL_AN_EGG ? 2_000_000 : 1000, visits: 5, favoritedCount: 6, created: '2026-01-01T00:00:00Z' })) })
  }
  return json({}, 404)
}
const instant = () => createPacer({ minIntervalMs: 0, jitterMs: 0, sleep: async () => {} })

let svc: SupabaseClient
let gameId = ''
let ownsGame = false // false when the real catalogue already keys BLOX_FRUITS (backfill applied)

async function cleanup() {
  await svc.from('game_metrics').delete().lt('captured_at', '2002-01-01')
  await svc.from('trend_events').delete().lt('created_at', '2002-01-01')
  await svc.from('rmt_chart_snapshots').delete().lt('captured_at', '2002-01-01')
  if (gameId && ownsGame) await svc.from('games').delete().eq('id', gameId) // cascades game_external_ids
}

describe.skipIf(!hasEnv)('trend radar — collect (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    const { error } = await svc.from('trend_events').select('id').limit(1)
    if (error) throw new Error(`trend radar migration not applied on ${SUPABASE_URL}: ${error.message}`)
    await cleanup()
    // Blox Fruits must be a catalogue game. If the external-id backfill has
    // run on this stack it already is; otherwise key a throwaway game to it.
    const { data: keyed } = await svc.from('game_external_ids').select('game_id').eq('platform', 'roblox').eq('external_id', String(BLOX_FRUITS)).maybeSingle()
    if (keyed) {
      gameId = (keyed as any).game_id
      ownsGame = false
    } else {
      const { data: g, error: ge } = await svc.from('games')
        .insert({ name: `Radar Catalogue ${TAG}`, slug: `radar-cat-${TAG}`, ecosystem: 'roblox', is_active: true })
        .select('id').single()
      if (ge) throw new Error(ge.message)
      gameId = (g as any).id
      ownsGame = true
      const { error: xe } = await svc.from('game_external_ids').insert({ game_id: gameId, platform: 'roblox', external_id: String(BLOX_FRUITS) })
      if (xe) throw new Error(xe.message)
    }
  })
  afterAll(cleanup)

  it('stores one metrics row per universe (catalogue ∪ discovery) and fires top30_entry for exactly the non-catalogue top-N', async () => {
    const TOP_N = 35 // the whole fixture list, so at least one non-catalogue universe is in range on any stack
    const summary = await runCollect({ db: svc, fetchImpl: fixtureFetch, pacer: instant(), now: NOW, config: { ...DEFAULT_CONFIG, topN: TOP_N } })
    expect(summary.ok).toBe(true)
    expect(summary.endpoint).toBe('get-sorts')

    const { data: metrics } = await svc.from('game_metrics').select('external_id, playing').lt('captured_at', '2002-01-01')
    const ids = new Set((metrics ?? []).map((m: any) => m.external_id))
    expect(ids.has(String(BLOX_FRUITS))).toBe(true)
    expect(ids.has(String(STEAL_AN_EGG))).toBe(true)
    expect(ids.size).toBe(summary.universes)
    expect((metrics ?? []).find((m: any) => m.external_id === String(STEAL_AN_EGG))?.playing).toBe(2_000_000)

    // Expected = fixture top-N by playerCount minus whatever this stack's catalogue already keys.
    const { data: keyedRows } = await svc.from('game_external_ids').select('external_id').eq('platform', 'roblox')
    const keyed = new Set((keyedRows ?? []).map((r: any) => r.external_id))
    const fixtureTop = (getSortsFixture.sorts.find((x: any) => x.sortId === 'top-playing-now') as any).games
      .slice()
      .sort((a: any, b: any) => b.playerCount - a.playerCount)
      .slice(0, TOP_N)
    const expected = fixtureTop.map((g: any) => String(g.universeId)).filter((id: string) => !keyed.has(id)).sort()
    expect(expected.length).toBeGreaterThan(0)

    const { data: events } = await svc.from('trend_events').select('external_id, signal, value, name, flags').lt('created_at', '2002-01-01')
    const top = (events ?? []).filter((e: any) => e.signal === 'top30_entry')
    expect(top.map((e: any) => e.external_id).sort()).toEqual(expected)
    expect(top.map((e: any) => e.external_id)).not.toContain(String(BLOX_FRUITS))
    const sample = top[0] as any
    const rank = fixtureTop.findIndex((g: any) => String(g.universeId) === sample.external_id) + 1
    expect(sample).toMatchObject({ value: rank })
    expect(sample.flags).toMatchObject({ rank, rootPlaceId: Number(sample.external_id) * 10, playingNow: expect.any(Number) })
  })

  it('a re-run inside the dedup window fires nothing new', async () => {
    const before = (await svc.from('trend_events').select('id', { count: 'exact', head: true }).lt('created_at', '2002-01-01')).count
    const summary = await runCollect({ db: svc, fetchImpl: fixtureFetch, pacer: instant(), now: new Date(NOW.getTime() + 6 * 3600_000), config: { ...DEFAULT_CONFIG, topN: 35 } })
    expect(summary.eventsInserted).toBe(0)
    const after = (await svc.from('trend_events').select('id', { count: 'exact', head: true }).lt('created_at', '2002-01-01')).count
    expect(after).toBe(before)
  })

  it('fires growth_48h from a stored baseline, flagged inCatalogue for a catalogue game', async () => {
    // Baseline 48h before a new "now": Blox Fruits had 100 playing; fixture says 1000 → +900%, but 1000 < 50k min.
    // Steal An Egg baseline 500k → 2M = +300% and ≥ 50k → fires (dedup window has passed for a new signal).
    const later = new Date('2001-02-10T12:00:00Z')
    const base = new Date(later.getTime() - 48 * 3600_000).toISOString()
    await svc.from('game_metrics').insert([
      { platform: 'roblox', external_id: String(STEAL_AN_EGG), playing: 500_000, captured_at: base },
      { platform: 'roblox', external_id: String(BLOX_FRUITS), playing: 100, captured_at: base },
    ])
    const summary = await runCollect({ db: svc, fetchImpl: fixtureFetch, pacer: instant(), now: later, config: { ...DEFAULT_CONFIG, topN: 1 } })
    const growth = summary.events.filter((e) => e.signal === 'growth_48h')
    expect(growth.map((e) => e.externalId)).toEqual([String(STEAL_AN_EGG)])
    expect(growth[0].value).toBe(300)
  })

  it('dry run evaluates signals but writes no metrics and no events', async () => {
    const at = new Date('2001-06-01T00:00:00Z')
    const summary = await runCollect({ db: svc, fetchImpl: fixtureFetch, pacer: instant(), now: at, config: { ...DEFAULT_CONFIG, topN: 35 }, dryRun: true })
    expect(summary.ok).toBe(true)
    expect(summary.dryRun).toBe(true)
    expect(summary.events.length).toBeGreaterThan(0)
    expect(summary.metricsInserted).toBe(0)
    expect(summary.eventsInserted).toBe(0)
    const { count } = await svc.from('game_metrics').select('id', { count: 'exact', head: true }).eq('captured_at', at.toISOString())
    expect(count).toBe(0)
  })

  it('records an endpoint_failure event with health when Roblox discovery is down', async () => {
    const down: FetchLike = async () => json({ errors: [{ code: 0 }] }, 404)
    const summary = await runCollect({ db: svc, fetchImpl: down, pacer: instant(), now: new Date('2001-03-01T00:00:00Z') })
    expect(summary.ok).toBe(false)
    const { data } = await svc.from('trend_events').select('signal, flags').eq('signal', 'endpoint_failure').lt('created_at', '2002-01-01')
    expect(data).toHaveLength(1)
    expect((data as any)[0].flags).toMatchObject({ endpoint: 'get-sort-content', fallbackTried: true, status: 404 })
  })

  it('ends the run cleanly (no partial metrics) when the throttle trips', async () => {
    let calls = 0
    const throttled: FetchLike = async (url) => {
      if (String(url).includes('get-sorts')) return json(getSortsFixture)
      calls += 1
      return json({}, 429)
    }
    const at = new Date('2001-04-01T00:00:00Z')
    const summary = await runCollect({ db: svc, fetchImpl: throttled, pacer: instant(), now: at })
    expect(summary.ok).toBe(false)
    expect(summary.tripped).toBe(true)
    expect(calls).toBe(2) // first 429 → one retry → second 429 trips
    const { count } = await svc.from('game_metrics').select('id', { count: 'exact', head: true }).eq('captured_at', at.toISOString())
    expect(count).toBe(0)
  })
})
