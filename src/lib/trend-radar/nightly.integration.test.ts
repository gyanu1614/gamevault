import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from '@/test/guards/throwaway'
import { runNightly } from './nightly'
import { DEFAULT_CONFIG } from './config'

const TAG = `s2n${Date.now().toString(36)}`
const NOW = new Date('2001-08-01T03:00:00Z')
const U_OLD = 910_000_001
const U_DECAY = 910_000_002
const U_FINE = 910_000_003

let svc: SupabaseClient
const gameIds: string[] = []
const notified: { title: string; message: string }[] = []

async function cleanup() {
  await svc.from('game_metrics').delete().lt('captured_at', '2002-01-01')
  await svc.from('game_metrics_daily').delete().lt('day', '2002-01-01')
  for (const id of gameIds) await svc.from('games').delete().eq('id', id)
}

async function radarGame(slug: string, universeId: number, peak: number) {
  const { data, error } = await svc.from('games').insert({
    name: slug, slug, ecosystem: 'roblox', source: 'trend-radar', is_active: true, review_status: 'approved', trend_peak_playing: peak,
  }).select('id').single()
  if (error) throw new Error(error.message)
  gameIds.push((data as any).id)
  await svc.from('game_external_ids').insert({ game_id: (data as any).id, platform: 'roblox', external_id: String(universeId) })
  return (data as any).id as string
}

describe.skipIf(!hasEnv)('trend radar — nightly (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    await cleanup()
  })
  afterAll(cleanup)

  it('rolls raw rows older than the retention window into daily max/avg and prunes them', async () => {
    const day = new Date(NOW.getTime() - (DEFAULT_CONFIG.metricsRetentionDays + 2) * 86400_000)
    const dayStr = day.toISOString().slice(0, 10)
    await svc.from('game_metrics').insert([
      { platform: 'roblox', external_id: String(U_OLD), playing: 100, captured_at: new Date(day.getTime() + 1 * 3600_000).toISOString() },
      { platform: 'roblox', external_id: String(U_OLD), playing: 300, captured_at: new Date(day.getTime() + 7 * 3600_000).toISOString() },
      { platform: 'roblox', external_id: String(U_OLD), playing: 200, captured_at: new Date(day.getTime() + 13 * 3600_000).toISOString() },
      // Inside retention: must survive.
      { platform: 'roblox', external_id: String(U_OLD), playing: 999, captured_at: new Date(NOW.getTime() - 86400_000).toISOString() },
    ])
    const s = await runNightly({ db: svc, now: NOW, notify: async () => {} })
    expect(s.rollup.rawPruned).toBe(3)
    expect(s.rollup.daysWritten).toBe(1)
    const { data: daily } = await svc.from('game_metrics_daily').select('*').eq('external_id', String(U_OLD)).eq('day', dayStr).single()
    expect(daily).toMatchObject({ max_playing: 300, avg_playing: 200, samples: 3 })
    const { count } = await svc.from('game_metrics').select('id', { count: 'exact' }).eq('external_id', String(U_OLD)).limit(1)
    expect(count).toBe(1)
  })

  it('marks an approved trend-radar game declining when its 14-day max is under 25% of its detection peak, and notifies once', async () => {
    const decayId = await radarGame(`radar-decay-${TAG}`, U_DECAY, 100_000)
    const fineId = await radarGame(`radar-fine-${TAG}`, U_FINE, 100_000)
    const recent = new Date(NOW.getTime() - 3 * 86400_000).toISOString()
    await svc.from('game_metrics').insert([
      { platform: 'roblox', external_id: String(U_DECAY), playing: 20_000, captured_at: recent }, // 20% of peak
      { platform: 'roblox', external_id: String(U_FINE), playing: 60_000, captured_at: recent }, // 60% of peak
    ])
    const s = await runNightly({ db: svc, now: NOW, notify: async (n) => { notified.push(n) } })
    expect(s.decay.declining).toEqual([`radar-decay-${TAG}`])
    const { data: d } = await svc.from('games').select('review_status, is_active').eq('id', decayId).single()
    expect(d).toEqual({ review_status: 'declining', is_active: true }) // nothing deactivated
    const { data: f } = await svc.from('games').select('review_status').eq('id', fineId).single()
    expect(f).toEqual({ review_status: 'approved' })
    expect(notified).toHaveLength(1)
    expect(notified[0].message).toContain(`radar-decay-${TAG}`)

    // Second night: already declining → no second notification.
    const s2 = await runNightly({ db: svc, now: new Date(NOW.getTime() + 86400_000), notify: async (n) => { notified.push(n) } })
    expect(s2.decay.declining).toEqual([])
    expect(notified).toHaveLength(1)
  })

  it('does not decay a game with no samples in the window', async () => {
    const id = await radarGame(`radar-nosample-${TAG}`, 910_000_004, 50_000)
    const s = await runNightly({ db: svc, now: NOW, notify: async () => {} })
    expect(s.decay.declining).not.toContain(`radar-nosample-${TAG}`)
    const { data } = await svc.from('games').select('review_status').eq('id', id).single()
    expect(data).toEqual({ review_status: 'approved' })
  })
})
