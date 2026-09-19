/**
 * Guard: trend-radar review state machine + "pending games never public".
 *
 *  - snooze keeps a game pending/inactive and suppresses re-alerts;
 *  - reject records the note, keeps it inactive, suppresses re-alerts;
 *  - approve flips is_active + review_status, PATCHes the Discord alert to
 *    live and posts a follow-up; the game is then visible to anon;
 *  - reject/snooze are refused on an approved game (no accidental takedowns);
 *  - a pending game is invisible to anon, and the sitemap/directory readers
 *    filter is_active explicitly (static pin) so a policy change alone cannot
 *    leak it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC, ANON } from './throwaway'
import { approveGame, rejectGame, snoozeGame, loadReview, REVIEWABLE } from '@/lib/trend-radar/review'
import { suppressedUniverses, loadRobloxCatalogue } from '@/lib/trend-radar/store'
import { DEFAULT_CONFIG } from '@/lib/trend-radar/config'

const TAG = `s2r${Date.now().toString(36)}`
const NOW = new Date('2001-09-01T12:00:00Z')
const UNIVERSE = 920_000_001
let svc: SupabaseClient
let gameId = ''
const webhookCalls: { url: string; method: string; body: any }[] = []
const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
  webhookCalls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
  return new Response(JSON.stringify({ id: 'f1' }), { status: 200 })
}
const anon = () => createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } })
const opts = () => ({ now: NOW, webhookUrl: 'https://discord.test/webhooks/1/abc', siteUrl: 'https://dropmarket.test', fetchImpl })

describe.skipIf(!hasEnv)('trend radar — review state machine (guard)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    const { data, error } = await svc.from('games').insert({
      name: `Radar Review ${TAG}`, slug: `radar-review-${TAG}`, ecosystem: 'roblox', source: 'trend-radar',
      is_active: false, review_status: 'pending', trend_detected_at: NOW.toISOString(), trend_peak_playing: 123_456,
    }).select('id').single()
    if (error) throw new Error(error.message)
    gameId = (data as any).id
    await svc.from('game_external_ids').insert({ game_id: gameId, platform: 'roblox', external_id: String(UNIVERSE) })
    await svc.from('trend_events').insert({
      platform: 'roblox', external_id: String(UNIVERSE), game_id: gameId, signal: 'top30_entry', value: 7, name: `Radar Review ${TAG}`,
      flags: { rank: 7, playingNow: 123_456, rootPlaceId: 55, prepare: { categories: 2, icon: 'filled', wiki: false, discord: 'sent', errors: [] } },
      draft: { found: false, categories: [], rarities: [], currencies: [], generatedAt: NOW.toISOString(), note: 'No Fandom wiki found for this title.' },
      discord_message_id: 'm-orig', created_at: NOW.toISOString(), handled_at: NOW.toISOString(),
    })
    await svc.from('game_metrics').insert([
      { platform: 'roblox', external_id: String(UNIVERSE), playing: 100_000, captured_at: new Date(NOW.getTime() - 2 * 86400_000).toISOString() },
      { platform: 'roblox', external_id: String(UNIVERSE), playing: 123_456, captured_at: new Date(NOW.getTime() - 1 * 86400_000).toISOString() },
    ])
  })
  afterAll(async () => {
    await svc.from('trend_events').delete().lt('created_at', '2002-01-01')
    await svc.from('game_metrics').delete().lt('captured_at', '2002-01-01')
    if (gameId) await svc.from('games').delete().eq('id', gameId)
  })

  it('a pending game is invisible to anon', async () => {
    const { data } = await anon().from('games').select('id').eq('id', gameId)
    expect(data).toEqual([])
  })

  it('sitemap and game directory readers filter is_active explicitly (static pin)', () => {
    for (const f of ['src/app/sitemap.ts', 'src/lib/marketplace/gameDirectoryCache.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/from\('games'\)[\s\S]{0,400}\.eq\('is_active',\s*true\)/)
    }
  })

  it('loadReview assembles the card: game, events, draft, 7-day metrics, external id', async () => {
    const r = await loadReview(svc, gameId, NOW)
    expect(r?.game.slug).toBe(`radar-review-${TAG}`)
    expect(r?.externalId).toBe(String(UNIVERSE))
    expect(r?.events.map((e) => e.signal)).toEqual(['top30_entry'])
    expect(r?.draft).toMatchObject({ found: false })
    expect(r?.metrics.map((m) => m.playing)).toEqual([100_000, 123_456])
    expect(r?.prepare).toMatchObject({ categories: 2, icon: 'filled' })
  })

  it('snooze keeps it pending + inactive and suppresses re-alerts for 7 days', async () => {
    const res = await snoozeGame(svc, gameId, { now: NOW, days: 7 })
    expect(res.ok).toBe(true)
    const { data } = await svc.from('games').select('review_status, is_active, review_snoozed_until').eq('id', gameId).single()
    expect(data).toMatchObject({ review_status: 'pending', is_active: false })
    expect(new Date((data as any).review_snoozed_until).getTime()).toBe(NOW.getTime() + 7 * 86400_000)
    const cat = await loadRobloxCatalogue(svc)
    expect(suppressedUniverses(cat, new Date(NOW.getTime() + 86400_000), DEFAULT_CONFIG.rejectSuppressDays).has(UNIVERSE)).toBe(true)
    expect(suppressedUniverses(cat, new Date(NOW.getTime() + 8 * 86400_000), DEFAULT_CONFIG.rejectSuppressDays).has(UNIVERSE)).toBe(false)
  })

  it('reject records the note, stays inactive and suppresses re-alerts for 90 days', async () => {
    const res = await rejectGame(svc, gameId, 'Not tradeable — no item economy', { now: NOW })
    expect(res.ok).toBe(true)
    const { data } = await svc.from('games').select('review_status, is_active, review_note, review_snoozed_until').eq('id', gameId).single()
    expect(data).toMatchObject({ review_status: 'rejected', is_active: false, review_note: 'Not tradeable — no item economy', review_snoozed_until: null })
    const cat = await loadRobloxCatalogue(svc)
    expect(suppressedUniverses(cat, new Date(), DEFAULT_CONFIG.rejectSuppressDays).has(UNIVERSE)).toBe(true)
  })

  it('approve activates the game, marks the Discord alert live + posts a follow-up, and the game becomes public', async () => {
    webhookCalls.length = 0
    const res = await approveGame(svc, gameId, opts())
    expect(res).toMatchObject({ ok: true, slug: `radar-review-${TAG}`, liveUrl: `https://dropmarket.test/radar-review-${TAG}`, discord: 'updated' })
    const { data } = await svc.from('games').select('review_status, is_active, review_snoozed_until').eq('id', gameId).single()
    expect(data).toMatchObject({ review_status: 'approved', is_active: true, review_snoozed_until: null })

    const patch = webhookCalls.find((c) => c.method === 'PATCH')
    expect(patch?.url).toBe('https://discord.test/webhooks/1/abc/messages/m-orig')
    expect(JSON.stringify(patch?.body)).toMatch(/Live/)
    const follow = webhookCalls.find((c) => c.method === 'POST')
    expect(follow?.body.content).toContain(`https://dropmarket.test/radar-review-${TAG}`)

    const { data: pub } = await anon().from('games').select('id').eq('id', gameId)
    expect(pub).toHaveLength(1)
  })

  it('reject and snooze are refused on an approved game', async () => {
    expect((await rejectGame(svc, gameId, 'oops', { now: NOW })).ok).toBe(false)
    expect((await snoozeGame(svc, gameId, { now: NOW })).ok).toBe(false)
    const { data } = await svc.from('games').select('review_status, is_active').eq('id', gameId).single()
    expect(data).toEqual({ review_status: 'approved', is_active: true })
    expect(REVIEWABLE).toEqual(['pending', 'declining'])
  })

  it('a declining game can be re-approved (clears the note) or rejected', async () => {
    await svc.from('games').update({ review_status: 'declining', review_note: 'decayed' }).eq('id', gameId)
    const res = await approveGame(svc, gameId, { ...opts(), webhookUrl: null })
    expect(res).toMatchObject({ ok: true, discord: 'skipped' })
    const { data } = await svc.from('games').select('review_status, review_note').eq('id', gameId).single()
    expect(data).toEqual({ review_status: 'approved', review_note: null })
  })
})
