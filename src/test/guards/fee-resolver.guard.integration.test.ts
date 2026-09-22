/**
 * Fee engine PR 1 — resolve_seller_fee() and the fee_rules invariants
 * (docs/design/fee-engine.md §2.6, §7.1; approved deviations in the PR body).
 *
 * Two harnesses, on purpose:
 *
 *   · psql transactions (`inTx`) for the 12 worked examples and the table
 *     invariants. Each case runs inside ONE transaction that is ROLLED BACK:
 *     it wipes fee_rules, sets the rank steps the design assumes (this PR
 *     seeds them at 0, money-neutral), creates a throwaway game + pairs,
 *     sets the fixture seller's tier/founding fields, inserts the case's
 *     rules and calls the resolver. Zero residue by construction, and the
 *     historical starts_at the cases need is only writable under
 *     app.fee_backfill, which PostgREST callers cannot set. Same pattern as
 *     money-atomicity.guard's withFault (CLAUDE.md, money seams).
 *
 *   · PostgREST as the real roles (anon key, a signed-in user, the service
 *     role) for everything the app will actually do: the EXECUTE grant, the
 *     14-day notice trigger, and the 42501 column guards.
 *
 * Adjusted from the design's table for the approved founding decision:
 * founding = 50% off the base for 12 months (not 6), anchored on
 * founding_since (backfilled to profiles.created_at); the "2 points for
 * life" legacy branch is retired. Case 5's "expired" date moved past the
 * 12-month window accordingly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

import { hasEnv, makeFixture, expectGuardRejection, URL, ANON, type Fixture } from './throwaway'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const itTx = it.skipIf(!TARGET_IS_LOCAL)

let fx: Fixture | null = null
let ready = false
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

type Trace = {
  pct: string | number; base_pct: string | number; rule_id: string | null; rule_kind: string | null
  rule_scope: string | null; rank: string | null; rank_pts: string | number; founding_applied: boolean
  floor_applied: boolean; resolved_at: string; fallback_count: number; resolver_version: number
}

/**
 * Run `sql` inside one psql transaction that is always rolled back. Returns
 * stdout (one line per SELECT row). Throws with psql's stderr on error, with
 * SQLSTATE included (VERBOSITY verbose) so a test can assert on 23P01 etc.
 */
function inTx(sql: string): string {
  const script = [
    '\\set VERBOSITY verbose',
    'BEGIN;',
    "SET LOCAL app.fee_backfill = 'on';",
    sql,
    'ROLLBACK;',
  ].join('\n')
  try {
    return execFileSync('psql', [DB_URL, '-At', '-q', '-v', 'ON_ERROR_STOP=1'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] }).toString()
  } catch (e: any) {
    throw new Error(e?.stderr?.toString() ?? String(e))
  }
}
/** Same, but the transaction is EXPECTED to fail; returns stderr ('' if it did not fail). */
function inTxExpectError(sql: string): string {
  try { inTx(sql); return '' } catch (e: any) { return String(e.message) }
}

/**
 * The shared prelude for a worked example: a clean fee_rules table, the
 * design's rank steps, one throwaway game with one pair per type, and the
 * fixture seller reset to bronze / not founding. All inside the rolled-back
 * transaction. Pair ids are exposed as psql variables via \gset.
 */
function prelude(): string {
  return `
    DELETE FROM public.fee_rules;
    UPDATE public.seller_tier_config SET discount_pts = CASE tier
      WHEN 'bronze' THEN 0 WHEN 'silver' THEN 0.5 WHEN 'gold' THEN 1.0
      WHEN 'diamond' THEN 1.5 WHEN 'legendary' THEN 2.0 ELSE 0 END;
    UPDATE public.platform_fee_settings SET rank_floor_pct = 8.00, founding_discount_pct = 50.00, founding_months = 12 WHERE id;
    INSERT INTO public.games (name, slug) VALUES ('Fee Case Game', 'fee-case-game') RETURNING id AS game_id \\gset
    INSERT INTO public.game_categories (game_id, global_category_id, slug, name, type, is_enabled)
      SELECT :'game_id', gc.id, 'fee-' || replace(gc.default_type, '_', '-'), 'Fee ' || gc.default_type, gc.default_type, true
      FROM public.global_categories gc WHERE gc.parent_id IS NULL AND gc.default_type IN ('currency','items','account','top_up','service');
    SELECT id AS p_currency FROM public.game_categories WHERE game_id = :'game_id' AND type = 'currency' \\gset
    SELECT id AS p_items    FROM public.game_categories WHERE game_id = :'game_id' AND type = 'items'    \\gset
    SELECT id AS p_account  FROM public.game_categories WHERE game_id = :'game_id' AND type = 'account'  \\gset
    SELECT id AS p_top_up   FROM public.game_categories WHERE game_id = :'game_id' AND type = 'top_up'   \\gset
    SELECT id AS p_service  FROM public.game_categories WHERE game_id = :'game_id' AND type = 'service'  \\gset
    UPDATE public.profiles SET seller_tier = 'bronze', founding_seller = false, founding_since = NULL WHERE id = '${fx!.seller.id}';
  `
}
const seller = (patch: string) => `UPDATE public.profiles SET ${patch} WHERE id = '${fx!.seller.id}';`
const rule = (kind: string, scope: string, type: string, pairVar: string | null, pct: number, starts: string, ends: string | null) =>
  `INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, ends_at)
   VALUES ('${kind}', '${scope}', '${type}', ${pairVar ? `:'${pairVar}'` : 'NULL'}, ${pct}, timestamptz '${starts}', ${ends ? `timestamptz '${ends}'` : 'NULL'});`
const resolve = (sellerExpr: string, pairVar: string, at = '2026-10-01 00:00:00+00') =>
  `SELECT row_to_json(r)::text FROM public.resolve_seller_fee(${sellerExpr}, :'${pairVar}', timestamptz '${at}') r;`
function run(caseSql: string): Trace {
  const out = inTx(prelude() + caseSql).trim().split('\n').filter(Boolean)
  return JSON.parse(out[out.length - 1]) as Trace
}
const S = () => `'${fx!.seller.id}'`
const n = (v: string | number) => Number(v)

describe.skipIf(!hasEnv)('fee engine — resolve_seller_fee() (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { error } = await fx.svc.rpc('resolve_seller_fee', { p_seller_id: null, p_game_category_id: '00000000-0000-0000-0000-000000000000' })
    // A missing function is PGRST202; a missing pair is the resolver's own
    // foreign_key_violation. Either way "ready" means the migration is applied.
    ready = !error || error.code !== 'PGRST202'
  }, 60_000)
  afterAll(async () => {
    if (fx) {
      // Every row this file causes outside the rolled-back transactions.
      await fx.svc.from('fee_rules').delete().like('note', 'FEE-TEST-%')
    }
    await fx?.cleanup()
  }, 60_000)

  it('the fee-engine schema migration is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  // ── §2.6 — the 12 worked examples ─────────────────────────────────────────
  describe('§2.6 worked examples (psql, rolled back)', () => {
    itTx('1. Roblox currency + Gold: 10 − 1.0 = 9.00, floor not hit', () => {
      const t = run(seller("seller_tier = 'gold'") + rule('base', 'game_category', 'currency', 'p_currency', 10, '2026-01-01', null) + resolve(S(), 'p_currency'))
      expect(n(t.pct)).toBe(9)
      expect(n(t.base_pct)).toBe(10)
      expect(t).toMatchObject({ rule_scope: 'game_category', rule_kind: 'base', rank: 'gold', floor_applied: false, founding_applied: false, fallback_count: 0 })
      expect(n(t.rank_pts)).toBe(1)
    })

    itTx('2. AAA 5% + Legendary: base ≤ floor → rank skipped, rate NOT raised to 8', () => {
      const t = run(seller("seller_tier = 'legendary'") + rule('base', 'game_category', 'currency', 'p_currency', 5, '2026-01-01', null) + resolve(S(), 'p_currency'))
      expect(n(t.pct)).toBe(5)
      expect(t).toMatchObject({ rank: 'legendary', floor_applied: false })
      expect(n(t.rank_pts)).toBe(0)
    })

    itTx('3. 0% promo + founding: promo (2a) beats pair base (2c); founding on zero is a no-op', () => {
      const t = run(
        seller("founding_seller = true, founding_since = timestamptz '2026-09-01'") +
        rule('promo', 'game_category', 'currency', 'p_currency', 0, '2026-09-15', '2026-12-15') +
        rule('base', 'game_category', 'currency', 'p_currency', 10, '2026-01-01', null) +
        resolve(S(), 'p_currency'),
      )
      expect(n(t.pct)).toBe(0)
      expect(n(t.base_pct)).toBe(0)
      expect(t).toMatchObject({ rule_kind: 'promo', founding_applied: true })
    })

    itTx('4. Accounts high band + founding: 20 × 0.5 = 10.00, rank ignored', () => {
      const t = run(
        seller("seller_tier = 'legendary', founding_seller = true, founding_since = timestamptz '2026-08-15'") +
        rule('base', 'game_category', 'account', 'p_account', 20, '2026-01-01', null) +
        resolve(S(), 'p_account'),
      )
      expect(n(t.pct)).toBe(10)
      expect(n(t.base_pct)).toBe(20)
      expect(t).toMatchObject({ founding_applied: true, rank: 'legendary' })
      expect(n(t.rank_pts)).toBe(0)
    })

    itTx('5. Expired founding (13 months in, 12-month window): back to base, Bronze 0 pts', () => {
      const t = run(
        seller("seller_tier = 'bronze', founding_seller = true, founding_since = timestamptz '2026-08-15'") +
        rule('base', 'game_category', 'account', 'p_account', 20, '2026-01-01', null) +
        resolve(S(), 'p_account', '2027-09-01 00:00:00+00'),
      )
      expect(n(t.pct)).toBe(20)
      expect(t).toMatchObject({ founding_applied: false, rank: 'bronze' })
      expect(n(t.rank_pts)).toBe(0)
    })

    itTx('5b. Founding still active at month 11.5 of 12', () => {
      const t = run(
        seller("founding_seller = true, founding_since = timestamptz '2026-08-15'") +
        rule('base', 'game_category', 'account', 'p_account', 20, '2026-01-01', null) +
        resolve(S(), 'p_account', '2027-08-01 00:00:00+00'),
      )
      expect(n(t.pct)).toBe(10)
      expect(t.founding_applied).toBe(true)
    })

    itTx('5c. founding_seller with founding_since NULL anchors on profiles.created_at (past or future grant)', () => {
      const t = run(
        seller("founding_seller = true, founding_since = NULL, seller_tier = 'gold'") +
        rule('base', 'game_category', 'account', 'p_account', 20, '2026-01-01', null) +
        resolve(S(), 'p_account', '2026-10-01 00:00:00+00') /* created_at is today */,
      )
      expect(n(t.pct)).toBe(10)
      expect(t.founding_applied).toBe(true)
    })

    itTx('6. Expired promo falls back to base; the range expired it, not a cron', () => {
      const t = run(
        seller("seller_tier = 'gold'") +
        rule('promo', 'game_category', 'currency', 'p_currency', 0, '2026-09-15', '2026-12-15') +
        rule('base', 'game_category', 'currency', 'p_currency', 10, '2026-01-01', null) +
        resolve(S(), 'p_currency', '2026-12-20 00:00:00+00'),
      )
      expect(n(t.pct)).toBe(9)
      expect(t).toMatchObject({ rule_kind: 'base', rank: 'gold' })
    })

    itTx('7. Overlapping base rules are refused by the database with 23P01 (category scope)', () => {
      const err = inTxExpectError(prelude() + rule('base', 'category', 'items', null, 10, '2026-01-01', null) + rule('base', 'category', 'items', null, 12, '2026-10-01', null))
      expect(err).toMatch(/23P01/)
      expect(err).toMatch(/fee_rules_no_overlapping_base/)
    })

    itTx('7b. …and pair scope; back-to-back [) windows are NOT an overlap; promos MAY overlap', () => {
      const err = inTxExpectError(prelude() + rule('base', 'game_category', 'items', 'p_items', 10, '2026-01-01', null) + rule('base', 'game_category', 'items', 'p_items', 12, '2026-10-01', null))
      expect(err).toMatch(/23P01/)
      const ok = inTx(prelude() +
        rule('base', 'game_category', 'items', 'p_items', 10, '2026-01-01', '2026-10-01') +
        rule('base', 'game_category', 'items', 'p_items', 12, '2026-10-01', null) +
        rule('promo', 'game_category', 'items', 'p_items', 0, '2026-09-01', '2026-11-01') +
        rule('promo', 'game_category', 'items', 'p_items', 1, '2026-10-15', '2026-12-01') +
        'SELECT count(*) FROM public.fee_rules;')
      expect(ok.trim()).toBe('4')
    })

    itTx('8. Floor caps the rank discount: 9 − 2 = 7 < 8 → 8.00, floor_applied true', () => {
      const t = run(seller("seller_tier = 'legendary'") + rule('base', 'game_category', 'top_up', 'p_top_up', 9, '2026-01-01', null) + resolve(S(), 'p_top_up'))
      expect(n(t.pct)).toBe(8)
      expect(t.floor_applied).toBe(true)
      expect(n(t.rank_pts)).toBe(2)
    })

    itTx('9. Category-scope base, no pair rule: Silver 10 − 0.5 = 9.50', () => {
      const t = run(seller("seller_tier = 'silver'") + rule('base', 'category', 'items', null, 10, '2026-01-01', null) + resolve(S(), 'p_items'))
      expect(n(t.pct)).toBe(9.5)
      expect(t.rule_scope).toBe('category')
      expect(t.rule_id).not.toBeNull()
    })

    itTx('10. Pair base overrides category base (precedence, not conflict): 12 − 0.5 = 11.50', () => {
      const t = run(
        seller("seller_tier = 'silver'") +
        rule('base', 'category', 'items', null, 10, '2026-01-01', null) +
        rule('base', 'game_category', 'items', 'p_items', 12, '2026-01-01', null) +
        resolve(S(), 'p_items'),
      )
      expect(n(t.pct)).toBe(11.5)
      expect(t.rule_scope).toBe('game_category')
    })

    itTx('11. Anonymous caller (p_seller_id NULL): the headline rate, step 3 skipped', () => {
      const t = run(rule('base', 'game_category', 'currency', 'p_currency', 10, '2026-01-01', null) + resolve('NULL', 'p_currency'))
      expect(n(t.pct)).toBe(10)
      expect(t).toMatchObject({ rank: null, founding_applied: false })
      expect(n(t.rank_pts)).toBe(0)
      expect(t.rule_id).not.toBeNull()
    })

    itTx('12. No rule at all → fallback 10.00 for service, rule_id NULL, fallback_count 1', () => {
      const t = run(seller("seller_tier = 'bronze'") + resolve(S(), 'p_service'))
      expect(n(t.pct)).toBe(10)
      expect(t).toMatchObject({ rule_id: null, rule_kind: null, rule_scope: null, fallback_count: 1, resolver_version: 1 })
    })

    itTx('12b. A ranked seller takes their step off a fallback base like any other (Gold → 9.00)', () => {
      const t = run(seller("seller_tier = 'gold'") + resolve(S(), 'p_service'))
      expect(n(t.pct)).toBe(9)
      expect(t.fallback_count).toBe(1)
    })
  })

  // ── Table invariants ───────────────────────────────────────────────────────
  describe('fee_rules invariants', () => {
    itTx('a promo without ends_at is rejected (check_violation)', () => {
      const err = inTxExpectError(prelude() + rule('promo', 'category', 'items', null, 0, '2026-10-01', null))
      expect(err).toMatch(/23514/)
      expect(err).toMatch(/fee_rules_promo_bounded/)
    })

    itTx('a pair rule whose category_type disagrees with the pair is corrected by the sync trigger', () => {
      const out = inTx(prelude() + rule('base', 'game_category', 'currency', 'p_items', 10, '2026-01-01', null) + 'SELECT category_type FROM public.fee_rules;')
      expect(out.trim()).toBe('items')
    })

    itTx('p_at reconstructs the past: a later rule change does not alter what was charged before it', () => {
      const t = run(
        rule('base', 'game_category', 'items', 'p_items', 7, '2026-01-01', '2026-11-01') +
        rule('base', 'game_category', 'items', 'p_items', 10, '2026-11-01', null) +
        resolve('NULL', 'p_items', '2026-10-31 23:59:59+00'),
      )
      expect(n(t.pct)).toBe(7)
      const t2 = run(
        rule('base', 'game_category', 'items', 'p_items', 7, '2026-01-01', '2026-11-01') +
        rule('base', 'game_category', 'items', 'p_items', 10, '2026-11-01', null) +
        resolve('NULL', 'p_items', '2026-11-01 00:00:00+00'),
      )
      expect(n(t2.pct)).toBe(10)
    })

    itTx('determinism: two promos identical but for created_at resolve to the same row on 50 calls', () => {
      const out = inTx(prelude() +
        rule('promo', 'game_category', 'items', 'p_items', 1, '2026-09-01', '2026-12-01') +
        `INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, ends_at, created_at)
         VALUES ('promo', 'game_category', 'items', :'p_items', 2, timestamptz '2026-09-01', timestamptz '2026-12-01', now() + interval '1 second');` +
        `SELECT count(DISTINCT (SELECT rule_id FROM public.resolve_seller_fee(NULL, :'p_items', timestamptz '2026-10-01'))) FROM generate_series(1, 50);` +
        `SELECT pct FROM public.resolve_seller_fee(NULL, :'p_items', timestamptz '2026-10-01');`)
      const [distinct, pct] = out.trim().split('\n')
      expect(distinct).toBe('1')
      expect(Number(pct)).toBe(2) // newest created_at wins the tie
    })

    itTx('a missing pair is an error, never a free listing', () => {
      const err = inTxExpectError("SELECT * FROM public.resolve_seller_fee(NULL, '00000000-0000-0000-0000-000000000000');")
      expect(err).toMatch(/23503/)
      const err2 = inTxExpectError('SELECT * FROM public.resolve_seller_fee(NULL, NULL);')
      expect(err2).toMatch(/22004/)
    })
  })

  // ── Through PostgREST, as the real roles ───────────────────────────────────
  describe('grants, notice trigger and column guards (PostgREST)', () => {
    let pairId = ''
    beforeAll(async () => {
      const { data } = await fx!.svc.from('listings').select('game_category_id').eq('id', fx!.listingId).single()
      pairId = (data as any).game_category_id
    })

    it('the anon key can execute resolve_seller_fee (public fee page, ISR /[game]/sell)', async () => {
      const { data, error } = await anon().rpc('resolve_seller_fee', { p_seller_id: null, p_game_category_id: pairId })
      expect(error, error?.message).toBeNull()
      expect((data as any[]).length).toBe(1)
      expect(Number((data as any[])[0].pct)).toBeGreaterThanOrEqual(0)
    })

    it("a signed-in buyer resolves the SELLER's rate (checkout on the buyer's session)", async () => {
      const { data, error } = await fx!.buyer.client.rpc('resolve_seller_fee', { p_seller_id: fx!.seller.id, p_game_category_id: pairId })
      expect(error, error?.message).toBeNull()
      expect((data as any[])[0].rank).not.toBeUndefined()
    })

    it('the anon key can read fee_rules and platform_fee_settings (fees are public information)', async () => {
      const r = await anon().from('fee_rules').select('id').limit(1)
      expect(r.error, r.error?.message).toBeNull()
      const s = await anon().from('platform_fee_settings').select('rank_floor_pct, founding_discount_pct, founding_months, base_change_notice_days').single()
      expect(s.error, s.error?.message).toBeNull()
      expect(s.data).toMatchObject({ founding_months: 12, base_change_notice_days: 14 })
      expect(Number((s.data as any).founding_discount_pct)).toBe(50)
      expect(Number((s.data as any).rank_floor_pct)).toBe(8)
    })

    it('the anon key cannot write fee_rules', async () => {
      const { error } = await anon().from('fee_rules').insert({ kind: 'promo', scope: 'category', category_type: 'items', pct: 0, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86_400_000).toISOString(), note: 'FEE-TEST-anon' })
      expect(error).not.toBeNull()
      expect(error!.code).toBe('42501')
    })

    it('14-day notice: a base rule starting in 1 day is refused even for the service role; a promo is not', async () => {
      const soon = new Date(Date.now() + 86_400_000).toISOString()
      const later = new Date(Date.now() + 2 * 86_400_000).toISOString()
      const base = await fx!.svc.from('fee_rules').insert({ kind: 'base', scope: 'game_category', category_type: 'items', game_category_id: pairId, pct: 9, starts_at: soon, note: 'FEE-TEST-notice-base' })
      expect(base.error).not.toBeNull()
      expect(base.error!.code).toBe('23514')
      expect(base.error!.message).toMatch(/14 days notice/)
      const promo = await fx!.svc.from('fee_rules').insert({ kind: 'promo', scope: 'game_category', category_type: 'items', game_category_id: pairId, pct: 0, starts_at: soon, ends_at: later, note: 'FEE-TEST-notice-promo' }).select('id')
      expect(promo.error, promo.error?.message).toBeNull()
      const { error: del } = await fx!.svc.from('fee_rules').delete().eq('id', (promo.data as any[])[0].id)
      expect(del).toBeNull()
    })

    it('14-day notice: a base rule 15 days out is accepted by the service role', async () => {
      const ok = new Date(Date.now() + 15 * 86_400_000).toISOString()
      const r = await fx!.svc.from('fee_rules').insert({ kind: 'base', scope: 'game_category', category_type: 'items', game_category_id: pairId, pct: 9, starts_at: ok, note: 'FEE-TEST-notice-ok' }).select('id')
      expect(r.error, r.error?.message).toBeNull()
      await fx!.svc.from('fee_rules').delete().eq('id', (r.data as any[])[0].id)
    })

    it('a buyer cannot rewrite seller_commission_pct / seller_fee_trace on their own order (42501)', async () => {
      const res = await fx!.buyer.client.from('orders').update({ seller_commission_pct: 0, seller_fee_trace: { rule_id: null } }).eq('id', fx!.pendingOrderId).select('id')
      expectGuardRejection(res, 'orders')
      const { data } = await fx!.svc.from('orders').select('seller_commission_pct, seller_fee_trace').eq('id', fx!.pendingOrderId).single()
      expect((data as any).seller_commission_pct).toBeNull()
      expect((data as any).seller_fee_trace).toBeNull()
    })

    it('a seller cannot re-arm their own founding window by setting founding_since (42501)', async () => {
      const res = await fx!.seller.client.from('profiles').update({ founding_since: new Date().toISOString() }).eq('id', fx!.seller.id).select('id')
      expectGuardRejection(res, 'profiles')
      const { data } = await fx!.svc.from('profiles').select('founding_since').eq('id', fx!.seller.id).single()
      expect((data as any).founding_since).toBeNull()
    })

    it('fee_resolution_gaps lists only engine-era orders that resolved through the fallback', async () => {
      // The fixture's orders predate the engine (NULL trace) → never a gap.
      const before = await fx!.svc.from('fee_resolution_gaps').select('id').in('id', [fx!.pendingOrderId, fx!.completedOrderId])
      expect(before.error, before.error?.message).toBeNull()
      expect(before.data).toEqual([])
      // Stamp a fallback trace on one (service role passes the guard), it shows up; a ruled trace does not.
      const up = await fx!.svc.from('orders').update({ seller_commission_pct: 10, seller_fee_trace: { rule_id: null, fallback_count: 1, resolver_version: 1 } }).eq('id', fx!.pendingOrderId)
      expect(up.error, up.error?.message).toBeNull()
      const up2 = await fx!.svc.from('orders').update({ seller_commission_pct: 7, seller_fee_trace: { rule_id: '00000000-0000-0000-0000-000000000001', fallback_count: 0, resolver_version: 1 } }).eq('id', fx!.completedOrderId)
      expect(up2.error, up2.error?.message).toBeNull()
      const after = await fx!.svc.from('fee_resolution_gaps').select('id').in('id', [fx!.pendingOrderId, fx!.completedOrderId])
      expect((after.data as any[]).map((r) => r.id)).toEqual([fx!.pendingOrderId])
    })
  })
})
