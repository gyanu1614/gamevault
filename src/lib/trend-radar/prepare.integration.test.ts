import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC, ANON } from '@/test/guards/throwaway'
import { runPrepare, type PrepareDeps } from './prepare'
import { DEFAULT_CONFIG } from './config'
import type { IconResult } from '@/lib/games/icons'
import type { TaxonomyDraft } from './fandom'
import type { MessagePayload } from '@/lib/discord/types'

const NOW = new Date('2001-05-01T12:00:00Z')
const TAG = `s2p${Date.now().toString(36)}`
const U1 = 900_000_001
const U_RMT_A = 900_000_101
const U_RMT_B = 900_000_102

let svc: SupabaseClient
const createdGameIds: string[] = []

const okIcon: IconResult = { slug: 'x', status: 'filled', source: 'roblox', confidence: 1, iconUrl: 'https://cdn.test/icon.webp' }
const draft: TaxonomyDraft = { found: true, wiki: { slug: 'x', url: 'https://x.fandom.com', sitename: 'X Wiki', articles: 10 }, categories: [{ name: 'Pets', size: 3, members: ['A', 'B'] }], rarities: ['Common'], currencies: [], generatedAt: NOW.toISOString() }

function deps(over: Partial<PrepareDeps> = {}): PrepareDeps {
  const posted: MessagePayload[] = []
  return {
    db: svc,
    now: NOW,
    siteUrl: 'https://dropmarket.test',
    webhookUrl: 'https://discord.test/webhooks/1/abc',
    fetchIcon: async (g) => ({ ...okIcon, slug: g.slug }),
    draftTaxonomy: async () => draft,
    search: async () => [],
    fetchPlaying: async () => new Map(),
    post: async (payload) => { posted.push(payload); return { ok: true, messageId: `m${posted.length}` } },
    ...over,
  }
}

async function seedEvent(row: Record<string, unknown>) {
  const { error } = await svc.from('trend_events').insert({ platform: 'roblox', signal: 'top30_entry', value: 1, flags: {}, created_at: NOW.toISOString(), ...row })
  if (error) throw new Error(error.message)
}

async function cleanup() {
  await svc.from('trend_events').delete().lt('created_at', '2002-01-01')
  await svc.from('game_metrics').delete().lt('captured_at', '2002-01-01')
  // Only rows this file created (tagged slugs) — never every trend-radar game.
  const { data } = await svc.from('games').select('id').like('slug', `radar-%${TAG}%`)
  for (const g of (data ?? []) as any[]) await svc.from('games').delete().eq('id', g.id)
  for (const id of createdGameIds) await svc.from('games').delete().eq('id', id)
}

describe.skipIf(!hasEnv)('trend radar — prepare (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    const { error } = await svc.from('trend_events').select('id').limit(1)
    if (error) throw new Error(`trend radar migration not applied on ${SUPABASE_URL}: ${error.message}`)
    await cleanup()
  })
  afterAll(cleanup)

  it('creates a pending, inactive game with both category templates, its external id, icon, draft and one Discord alert', async () => {
    await seedEvent({ external_id: String(U1), name: `[🥚] Radar Egg ${TAG}`, flags: { rank: 1, rootPlaceId: 123 } })
    const posted: MessagePayload[] = []
    const d = deps({ post: async (p) => { posted.push(p); return { ok: true, messageId: 'm1' } } })
    const summary = await runPrepare(d)
    expect(summary.created).toHaveLength(1)

    const { data: game } = (await svc.from('games').select('*').eq('slug', `radar-egg-${TAG}`).single()) as { data: any }
    expect(game).toMatchObject({
      name: `Radar Egg ${TAG}`,
      ecosystem: 'roblox',
      content_tier: 'listed',
      source: 'trend-radar',
      is_active: false,
      review_status: 'pending',
      image_url: 'https://cdn.test/icon.webp',
      image_source: 'roblox',
    })
    expect(game.trend_detected_at).toBeTruthy()
    createdGameIds.push(game.id)

    const { data: ext } = await svc.from('game_external_ids').select('platform, external_id').eq('game_id', game.id)
    expect(ext).toEqual([{ platform: 'roblox', external_id: String(U1) }])

    const { data: cats } = await svc.from('game_categories').select('type, is_enabled, global_category:global_categories!game_categories_global_category_id_fkey(slug)').eq('game_id', game.id)
    expect((cats ?? []).map((c: any) => c.global_category.slug).sort()).toEqual(['accounts', 'items'])
    expect((cats ?? []).every((c: any) => c.is_enabled)).toBe(true)

    const { data: ev } = (await svc.from('trend_events').select('*').eq('external_id', String(U1)).single()) as { data: any }
    expect(ev.game_id).toBe(game.id)
    expect(ev.handled_at).toBeTruthy()
    expect(ev.discord_message_id).toBe('m1')
    expect(ev.draft).toMatchObject({ found: true })
    expect(ev.flags.prepare).toMatchObject({ categories: 2, icon: 'filled', wiki: true, discord: 'sent' })

    expect(posted).toHaveLength(1)
    expect(JSON.stringify(posted[0])).toContain(`Radar Egg ${TAG}`)
    expect(JSON.stringify(posted[0])).toContain('/admin/games?status=pending')
  })

  it('the pending game is invisible to the anon key', async () => {
    const anon = createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } })
    const { data } = await anon.from('games').select('id').eq('slug', `radar-egg-${TAG}`)
    expect(data).toEqual([])
  })

  it('a re-run creates nothing and posts nothing', async () => {
    const posted: MessagePayload[] = []
    const summary = await runPrepare(deps({ post: async (p) => { posted.push(p); return { ok: true, messageId: 'x' } } }))
    expect(summary.created).toHaveLength(0)
    expect(posted).toHaveLength(0)
    const { count } = await svc.from('games').select('id', { count: 'exact', head: true }).eq('slug', `radar-egg-${TAG}`)
    expect(count).toBe(1)
  })

  it('repairs a half-prepared pending game instead of duplicating it', async () => {
    // Simulate a run that died after the game row: no categories, event unhandled.
    const U2 = 900_000_002
    const { data: g } = await svc.from('games').insert({ name: `Radar Half ${TAG}`, slug: `radar-half-${TAG}`, ecosystem: 'roblox', source: 'trend-radar', is_active: false, review_status: 'pending' }).select('id').single()
    createdGameIds.push((g as any).id)
    await svc.from('game_external_ids').insert({ game_id: (g as any).id, platform: 'roblox', external_id: String(U2) })
    await seedEvent({ external_id: String(U2), name: `Radar Half ${TAG}`, flags: { rank: 2 } })

    const summary = await runPrepare(deps())
    expect(summary.repaired).toContain(`radar-half-${TAG}`)
    const { data: cats } = await svc.from('game_categories').select('id').eq('game_id', (g as any).id)
    expect(cats).toHaveLength(2)
    const { count } = await svc.from('games').select('id', { count: 'exact', head: true }).eq('name', `Radar Half ${TAG}`)
    expect(count).toBe(1)
  })

  it('suffixes and flags a slug collision', async () => {
    const U3 = 900_000_003
    const { data: taken } = await svc.from('games').insert({ name: `Radar Taken ${TAG}`, slug: `radar-taken-${TAG}`, is_active: true }).select('id').single()
    createdGameIds.push((taken as any).id)
    await seedEvent({ external_id: String(U3), name: `Radar Taken ${TAG}`, flags: { rank: 3 } })
    await runPrepare(deps())
    const { data: game } = (await svc.from('games').select('id, slug').eq('slug', `radar-taken-${TAG}-roblox`).single()) as { data: any }
    expect(game).toBeTruthy()
    createdGameIds.push(game.id)
    const { data: ev } = (await svc.from('trend_events').select('flags').eq('external_id', String(U3)).single()) as { data: any }
    expect(ev.flags.slugCollision).toBe(`radar-taken-${TAG}`)
  })

  it('resolves an rmt_chart event to the busier duplicate universe and flags it ambiguous', async () => {
    await svc.from('trend_events').insert({ platform: 'eldorado', external_id: `radar rmt ${TAG}`, signal: 'rmt_chart', value: 0, name: `Radar Rmt ${TAG}`, flags: {}, created_at: NOW.toISOString() })
    await runPrepare(deps({
      search: async () => [{ id: U_RMT_A, title: `Radar Rmt ${TAG}` }, { id: U_RMT_B, title: `Radar Rmt ${TAG}` }],
      fetchPlaying: async () => new Map([[U_RMT_A, 10], [U_RMT_B, 5000]]),
    }))
    const { data: ext } = (await svc.from('game_external_ids').select('game_id').eq('platform', 'roblox').eq('external_id', String(U_RMT_B)).single()) as { data: any }
    expect(ext).toBeTruthy()
    createdGameIds.push(ext.game_id)
    const { data: ev } = (await svc.from('trend_events').select('flags, game_id, handled_at').eq('external_id', `radar rmt ${TAG}`).single()) as { data: any }
    expect(ev.game_id).toBe(ext.game_id)
    expect(ev.handled_at).toBeTruthy()
    expect(ev.flags.ambiguous).toBe(true)
    expect(ev.flags.resolved).toMatchObject({ universeId: U_RMT_B })
  })

  it('marks an rmt_chart name that is not on Roblox as handled + unresolved, still alerting', async () => {
    await svc.from('trend_events').insert({ platform: 'eldorado', external_id: `radar norb ${TAG}`, signal: 'rmt_chart', value: 0, name: `Radar NoRoblox ${TAG}`, flags: {}, created_at: NOW.toISOString() })
    const posted: MessagePayload[] = []
    await runPrepare(deps({ search: async () => [], post: async (p) => { posted.push(p); return { ok: true, messageId: 'n1' } } }))
    const { data: ev } = (await svc.from('trend_events').select('flags, game_id, handled_at, discord_message_id').eq('external_id', `radar norb ${TAG}`).single()) as { data: any }
    expect(ev.game_id).toBeNull()
    expect(ev.handled_at).toBeTruthy()
    expect(ev.flags.unresolved).toBe(true)
    expect(ev.discord_message_id).toBe('n1')
    expect(JSON.stringify(posted)).toMatch(/not found on Roblox/i)
  })

  it('dry run writes nothing and returns the payloads it would send', async () => {
    const U4 = 900_000_004
    await seedEvent({ external_id: String(U4), name: `Radar Dry ${TAG}`, flags: { rank: 4 } })
    const summary = await runPrepare(deps({ dryRun: true }))
    expect(summary.dryRun).toBe(true)
    expect(summary.wouldCreate.map((w) => w.slug)).toContain(`radar-dry-${TAG}`)
    expect(summary.payloads.length).toBeGreaterThan(0)
    const { count } = await svc.from('games').select('id', { count: 'exact', head: true }).eq('slug', `radar-dry-${TAG}`)
    expect(count).toBe(0)
    const { data: ev } = (await svc.from('trend_events').select('handled_at').eq('external_id', String(U4)).single()) as { data: any }
    expect(ev.handled_at).toBeNull()
  })

  it('posts ONE digest instead of N alerts when a run prepares more games than alertBurstMax (first-run burst)', async () => {
    const ids = [900_000_011, 900_000_012, 900_000_013, 900_000_014]
    for (const [i, id] of ids.entries()) await seedEvent({ external_id: String(id), name: `Radar Burst ${i} ${TAG}`, flags: { rank: 10 + i, playingNow: 50_000 - i } })
    const posted: MessagePayload[] = []
    const summary = await runPrepare(deps({
      config: { ...DEFAULT_CONFIG, alertBurstMax: 3 },
      post: async (p) => { posted.push(p); return { ok: true, messageId: `d${posted.length}` } },
    }))
    for (const slug of summary.created) {
      const { data } = await svc.from('games').select('id').eq('slug', slug).single()
      if (data) createdGameIds.push((data as any).id)
    }
    expect(summary.created.filter((s) => s.startsWith('radar-burst-'))).toHaveLength(4)
    expect(posted).toHaveLength(1)
    const text = JSON.stringify(posted[0])
    expect(text).toMatch(/[4-9] new games pending review/i) // ≥4: the earlier dry-run test's event is prepared here too
    for (let i = 0; i < 4; i += 1) expect(text).toContain(`Radar Burst ${i} ${TAG}`)
    const { data: evs } = await svc.from('trend_events').select('discord_message_id, flags').in('external_id', ids.map(String))
    expect((evs ?? []).every((e: any) => e.discord_message_id === 'd1' && e.flags.prepare.discord === 'digest')).toBe(true)
  })

  it('a failing step leaves the event for the next run, and gives up after maxAttempts', async () => {
    const U5 = 900_000_005
    await seedEvent({ external_id: String(U5), name: `Radar Fail ${TAG}`, flags: { rank: 5 } })
    const failing = deps({ ensure: async () => { throw new Error('boom') }, maxAttempts: 2 })
    await runPrepare(failing)
    let { data: ev } = (await svc.from('trend_events').select('handled_at, flags, game_id').eq('external_id', String(U5)).single()) as { data: any }
    expect(ev.handled_at).toBeNull()
    expect(ev.flags.prepareAttempts).toBe(1)
    expect(ev.flags.prepare.errors[0]).toMatch(/boom/)
    if (ev.game_id) createdGameIds.push(ev.game_id)
    await runPrepare(failing)
    ;({ data: ev } = (await svc.from('trend_events').select('handled_at, flags').eq('external_id', String(U5)).single()) as { data: any })
    expect(ev.flags.prepareAttempts).toBe(2)
    expect(ev.handled_at).toBeTruthy()
    expect(ev.flags.gaveUp).toBe(true)
  })
})
