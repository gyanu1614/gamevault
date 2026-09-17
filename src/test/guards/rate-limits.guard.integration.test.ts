/**
 * Rate limiting — posture + behaviour guard (migration 20260916100000).
 *
 * Two things the unit tests cannot prove, because both are properties of the
 * DATABASE rather than of the TypeScript helper:
 *
 *  1. Posture. rate_limit_hit() must be service-role only. If the browser's
 *     anon key could call it, an attacker could burn any other IP's budget by
 *     key (a targeted denial of service), or probe the counters to learn which
 *     keys are close to their limit. The table must be unreadable too — it is
 *     a map of who is being throttled.
 *
 *  2. Atomicity. The whole point of pushing the counter into Postgres is that
 *     many Vercel instances share it. A read-then-write implementation loses
 *     hits under concurrency and silently hands attackers extra budget. The
 *     concurrency test below fires N simultaneous hits and asserts the counter
 *     landed on exactly N.
 *
 * Every key this file writes is namespaced with a per-run token and deleted in
 * afterAll, so it leaves no rows behind (CLAUDE.md: clean up every row you
 * cause, including side effects).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL, SVC, ANON } from './throwaway'

/** Namespace for every key this run creates, so cleanup is exact. */
const RUN = `guard:rate-limit:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
const k = (name: string) => `${RUN}:${name}`

let svc: SupabaseClient
let applied = false

const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })
/** rate_limit_hit through a given client. Untyped: the RPC is not in the hand-written schema. */
const hit = (client: SupabaseClient, key: string, limit: number, windowSeconds: number) =>
  (client as any).rpc('rate_limit_hit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

describe.skipIf(!hasEnv)('rate limiting — grants posture + atomic counter (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const { error } = await (svc as any).rpc('rate_limits_version')
    applied = !error
  })

  afterAll(async () => {
    if (!svc || !applied) return
    // Remove only this run's keys.
    await svc.from('rate_limits').delete().like('key', `${RUN}%`)
    const { data } = await svc.from('rate_limits').select('key').like('key', `${RUN}%`)
    expect(data ?? [], 'guard run left rate_limits rows behind').toEqual([])
  })

  it('the migration is applied (otherwise the rest of this file is vacuous)', () => {
    expect(applied, 'run `supabase db push` — 20260916100000_rate_limits.sql is not applied').toBe(true)
  })

  // ── Posture ────────────────────────────────────────────────────────────────
  describe('service-role only', () => {
    it.skipIf(!hasEnv)('the anon key cannot execute rate_limit_hit', async () => {
      if (!applied) return
      const { error, data } = await hit(anon(), k('anon-exec'), 5, 60)
      if (!error) {
        throw new Error(`anon executed rate_limit_hit — returned ${JSON.stringify(data)}`)
      }
      // 42501 = revoked by the executor; PGRST202 = not exposed at all. Both are fine.
      expect(['42501', 'PGRST202'], `unexpected error: ${error.message}`).toContain(error.code)
    })

    it('the anon key cannot execute rate_limits_cleanup (it could wipe every budget)', async () => {
      if (!applied) return
      const { error } = await (anon() as any).rpc('rate_limits_cleanup', { p_retain_seconds: 0 })
      expect(error, 'anon executed rate_limits_cleanup').not.toBeNull()
      expect(['42501', 'PGRST202']).toContain(error!.code)
    })

    it('the anon key cannot read the rate_limits table (it maps who is throttled)', async () => {
      if (!applied) return
      const { data, error } = await anon().from('rate_limits').select('key, count').limit(1)
      // Either revoked outright, or RLS-on-with-no-policies returns an empty set.
      if (!error) expect(data ?? []).toEqual([])
    })

    it('the anon key cannot write counters directly (that would forge budget)', async () => {
      if (!applied) return
      const { error } = await (anon().from('rate_limits').insert as any)({
        key: k('anon-insert'), window_start: new Date().toISOString(), count: 0,
      })
      expect(error, 'anon inserted into rate_limits').not.toBeNull()
    })
  })

  // ── Behaviour ──────────────────────────────────────────────────────────────
  describe('budget semantics', () => {
    it('allows exactly `limit` hits, then reports over-budget', async () => {
      if (!applied) return
      const key = k('boundary')
      for (let i = 1; i <= 3; i++) {
        const { data, error } = await hit(svc, key, 3, 60)
        expect(error).toBeNull()
        expect(data, `hit ${i} of 3 must be allowed`).toBe(false)
      }
      const { data: over } = await hit(svc, key, 3, 60)
      expect(over, 'the 4th hit against a limit of 3 must be over budget').toBe(true)
    })

    it('scopes budgets per key', async () => {
      if (!applied) return
      await hit(svc, k('scope-a'), 1, 60)
      expect((await hit(svc, k('scope-a'), 1, 60)).data).toBe(true)
      // A different key is untouched by the first key's exhaustion.
      expect((await hit(svc, k('scope-b'), 1, 60)).data).toBe(false)
    })

    it('rejects nonsense arguments instead of failing open in the DB', async () => {
      if (!applied) return
      expect((await hit(svc, '', 5, 60)).error, 'empty key must raise').not.toBeNull()
      expect((await hit(svc, k('bad'), 0, 60)).error, 'limit < 1 must raise').not.toBeNull()
      expect((await hit(svc, k('bad'), 5, 0)).error, 'window < 1 must raise').not.toBeNull()
    })
  })

  // ── Atomicity: the reason this lives in Postgres at all ────────────────────
  describe('atomic increment under concurrency', () => {
    it('records every one of 40 simultaneous hits (no lost updates)', async () => {
      if (!applied) return
      const key = k('concurrent')
      const N = 40
      // A high limit, so nothing is rejected and the count is the whole story.
      const results = await Promise.all(
        Array.from({ length: N }, () => hit(svc, key, 10_000, 3600)),
      )
      for (const r of results) expect(r.error).toBeNull()

      const { data } = await svc
        .from('rate_limits').select('count').eq('key', key).order('window_start', { ascending: false })
      const total = (data ?? []).reduce((sum, row: any) => sum + row.count, 0)
      expect(
        total,
        `${N} concurrent hits recorded ${total} — a read-then-write implementation ` +
          'loses hits under load and hands attackers extra budget',
      ).toBe(N)
    })
  })

  // ── Nightly cleanup ────────────────────────────────────────────────────────
  describe('rate_limits_cleanup', () => {
    it('deletes windows older than the retention and keeps fresh ones', async () => {
      if (!applied) return
      const stale = k('stale')
      const fresh = k('fresh')
      const now = Date.now()
      const { error: insErr } = await (svc.from('rate_limits').insert as any)([
        { key: stale, window_start: new Date(now - 3 * 86_400_000).toISOString(), count: 7 },
        { key: fresh, window_start: new Date(now - 60_000).toISOString(), count: 7 },
      ])
      expect(insErr).toBeNull()

      const { data: deleted, error } = await (svc as any).rpc('rate_limits_cleanup', {
        p_retain_seconds: 86_400,
      })
      expect(error).toBeNull()
      expect(deleted, 'cleanup should report a delete count').toBeGreaterThanOrEqual(1)

      const { data: rows } = await svc.from('rate_limits').select('key').in('key', [stale, fresh])
      const keys = (rows ?? []).map((r: any) => r.key)
      expect(keys, 'the stale window must be swept').not.toContain(stale)
      expect(keys, 'a window inside the retention must survive').toContain(fresh)
    })
  })
})
