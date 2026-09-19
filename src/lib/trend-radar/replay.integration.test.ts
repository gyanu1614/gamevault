/**
 * Replay (step-spec verification #1): two weeks of 6-hourly metrics for a
 * small universe set with ONE known breakout → exactly the expected events
 * fire, one game would be created, one Discord payload produced, in dry-run.
 *
 * Shape of the breakout (synthetic, modelled on Steal An Egg's July curve):
 * steady ~8k for 12 days, then 8k → 30k → 90k → 260k over the last 48h and
 * entry into the top 30 on the final sample. The two control universes stay
 * flat (one big, one small) and must fire nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL as SUPABASE_URL, SVC } from '@/test/guards/throwaway'
import { runCollect } from './collect'
import { runPrepare } from './prepare'
import { createPacer, type FetchLike, type SortGame } from './roblox'
import { DEFAULT_CONFIG } from './config'

const TAG = `s2x${Date.now().toString(36)}`
const T0 = new Date('2001-11-01T00:00:00Z')
const END = new Date(T0.getTime() + 14 * 86400_000) // the run under test
const BREAKOUT = 930_000_001
const BIG_FLAT = 930_000_002 // 400k all fortnight, already in the catalogue
const SMALL_FLAT = 930_000_003

const HOUR = 3600_000
let svc: SupabaseClient
let catalogueGameId = ''

function seriesFor(universe: number, t: Date): number {
  const hoursToEnd = (END.getTime() - t.getTime()) / HOUR
  if (universe === BIG_FLAT) return 400_000 + Math.round(Math.sin(t.getTime() / HOUR) * 3000)
  if (universe === SMALL_FLAT) return 2_000 + Math.round(Math.cos(t.getTime() / HOUR) * 200)
  // Breakout: flat 8k until the last 48h, then a steep climb.
  if (hoursToEnd > 48) return 8_000 + Math.round(Math.sin(t.getTime() / HOUR) * 500)
  if (hoursToEnd > 36) return 30_000
  if (hoursToEnd > 24) return 90_000
  if (hoursToEnd > 12) return 160_000
  return 260_000
}

const sortGame = (universeId: number, playerCount: number, name: string): SortGame =>
  ({ universeId, rootPlaceId: universeId * 10, name, playerCount, isSponsored: false, upVotes: 0, downVotes: 0 })

/** Top list at END: 35 filler games ranked by size, with the breakout at #12 and BIG_FLAT at #1. */
function sortsAtEnd() {
  const filler = Array.from({ length: 35 }, (_, i) => sortGame(940_000_000 + i, 300_000 - i * 8_000, `Filler ${i}`))
  const games = [sortGame(BIG_FLAT, 400_000, `Replay Big ${TAG}`), ...filler.slice(0, 10), sortGame(BREAKOUT, 260_000, `Replay Breakout ${TAG}`), ...filler.slice(10)]
  return { sorts: [{ sortId: 'top-playing-now', contentType: 'Games', games: games.map((g) => ({ universeId: g.universeId, rootPlaceId: g.rootPlaceId, name: g.name, playerCount: g.playerCount, isSponsored: false })) }] }
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s })
const fetchAtEnd: FetchLike = async (url) => {
  const u = String(url)
  if (u.includes('get-sorts')) return json(sortsAtEnd())
  if (u.includes('games.roblox.com/v1/games?')) {
    const ids = new URL(u).searchParams.get('universeIds')!.split(',').map(Number)
    return json({ data: ids.map((id) => ({ id, rootPlaceId: id * 10, name: id === BREAKOUT ? `Replay Breakout ${TAG}` : `U${id}`, playing: [BREAKOUT, BIG_FLAT, SMALL_FLAT].includes(id) ? seriesFor(id, END) : 300_000 - ((id - 940_000_000) % 35) * 8_000, visits: 1, favoritedCount: 1, created: '2026-01-01T00:00:00Z' })) })
  }
  return json({}, 404)
}
const instant = () => createPacer({ minIntervalMs: 0, jitterMs: 0, sleep: async () => {} })

async function cleanup() {
  await svc.from('trend_events').delete().lt('created_at', '2002-01-01')
  await svc.from('game_metrics').delete().lt('captured_at', '2002-01-01')
  if (catalogueGameId) await svc.from('games').delete().eq('id', catalogueGameId)
}

describe.skipIf(!hasEnv)('trend radar — two-week replay with one breakout (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SUPABASE_URL, process.env)
    svc = createClient(SUPABASE_URL!, SVC!, { auth: { persistSession: false } })
    await cleanup()
    const { data: g } = await svc.from('games').insert({ name: `Replay Big ${TAG}`, slug: `replay-big-${TAG}`, ecosystem: 'roblox', is_active: true }).select('id').single()
    catalogueGameId = (g as any).id
    await svc.from('game_external_ids').insert({ game_id: catalogueGameId, platform: 'roblox', external_id: String(BIG_FLAT) })
    // 14 days × 4 samples for the three tracked universes (56 runs, END excluded — that is the run under test).
    const rows: any[] = []
    for (let t = T0.getTime(); t < END.getTime(); t += 6 * HOUR) {
      for (const u of [BREAKOUT, BIG_FLAT, SMALL_FLAT]) {
        rows.push({ platform: 'roblox', external_id: String(u), playing: seriesFor(u, new Date(t)), captured_at: new Date(t).toISOString() })
      }
    }
    const { error } = await svc.from('game_metrics').insert(rows)
    if (error) throw new Error(error.message)
  })
  afterAll(cleanup)

  it('the run at the end of the fortnight fires exactly top30_entry + growth_48h for the breakout, nothing else', async () => {
    const summary = await runCollect({ db: svc, fetchImpl: fetchAtEnd, pacer: instant(), now: END, config: DEFAULT_CONFIG })
    expect(summary.ok).toBe(true)

    const mine = summary.events.filter((e) => [BREAKOUT, BIG_FLAT, SMALL_FLAT].includes(Number(e.externalId)))
    expect(mine.map((e) => `${e.externalId}:${e.signal}`).sort()).toEqual([`${BREAKOUT}:growth_48h`, `${BREAKOUT}:top30_entry`])
    const growth = mine.find((e) => e.signal === 'growth_48h')!
    // 48h before END the breakout was 30k (the 36–48h band) → 260k = +767%.
    expect(growth.value).toBe(767)
    expect(growth.flags).toMatchObject({ playing48hAgo: 30_000 })
    const top = mine.find((e) => e.signal === 'top30_entry')!
    // Rank is by playerCount (stable sort), not list position.
    const ranked = [...sortsAtEnd().sorts[0].games].sort((a, b) => b.playerCount - a.playerCount)
    expect(top.value).toBe(ranked.findIndex((g) => g.universeId === BREAKOUT) + 1)
    expect(top.value).toBe(8)

    // The filler universes also enter the top 30 (they are not in the catalogue) — expected, and bounded by topN.
    expect(summary.events.filter((e) => e.signal === 'top30_entry').length).toBeLessThanOrEqual(DEFAULT_CONFIG.topN)
  })

  it('dry-run prepare would create exactly one game for the breakout and produce one Discord payload for it', async () => {
    const summary = await runPrepare({
      db: svc, now: END, dryRun: true, siteUrl: 'https://dropmarket.test', webhookUrl: 'https://discord.test/w',
      fetchIcon: async () => ({ slug: 'x', status: 'unmatched' }), draftTaxonomy: async () => ({ found: false, categories: [], rarities: [], currencies: [], generatedAt: END.toISOString() }),
      search: async () => [], fetchPlaying: async () => new Map(), post: async (p) => ({ ok: true, dryRun: true, payload: p }),
    })
    const breakout = summary.wouldCreate.filter((w) => w.universeId === BREAKOUT)
    expect(breakout).toHaveLength(1)
    expect(breakout[0].slug).toBe(`replay-breakout-${TAG.toLowerCase()}`)
    const payloads = summary.payloads.filter((p) => JSON.stringify(p).includes(`Replay Breakout ${TAG}`))
    expect(payloads).toHaveLength(1)
    const text = JSON.stringify(payloads[0])
    expect(text).toContain('260,000')
    expect(text).toContain('+766.7%')
    expect(text).toContain('#8')
    expect(text).toContain('top30_entry, growth_48h')
    // Dry run: nothing written.
    const { count } = await svc.from('games').select('id', { count: 'exact', head: true }).ilike('slug', `replay-breakout-%`)
    expect(count).toBe(0)
  })
})
