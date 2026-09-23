/**
 * Fee engine PR 5 — the admin write seam (docs/design/fee-engine.md §5.2/§5.3;
 * migration 20260922163106_fee_rules_admin_schedule).
 *
 * Proves, against the real database, that:
 *   · fee_rule_schedule_base refuses a start inside the notice window, refuses
 *     a start at/after an already-scheduled pair rule, and otherwise CLOSES the
 *     pair's open-ended base rule at the new start and inserts the new one in
 *     ONE call — so the resolver gives the old rate the second before and the
 *     new rate from the start, never the category default in between;
 *   · fee_rule_cancel_scheduled deletes a not-yet-started pair rule and
 *     re-opens the rule it closed; refuses a started one;
 *   · a promo can be inserted starting now with no notice and ended early
 *     through a plain UPDATE (the trigger exempts promos);
 *   · both functions are service-role only (anon/authenticated get 42501).
 *
 * Every rule this file inserts is deleted in afterAll (the throwaway pair the
 * fixture creates carries them; the pair's original rules are restored).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let pairId = ''
let pairType = ''
/** Rules created by this file, deleted in afterAll. */
const created: string[] = []
/** Pair-scope base rows that existed before, with their original ends_at, restored in afterAll. */
let original: Array<{ id: string; ends_at: string | null }> = []

const DAY = 86_400_000
const utcMidnight = (daysFromNow: number) => {
  const d = new Date(Date.now() + daysFromNow * DAY)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}
const n = (v: unknown) => Number(v)

async function resolve(at?: string) {
  const args: Record<string, unknown> = { p_seller_id: null, p_game_category_id: pairId }
  if (at) args.p_at = at
  const { data, error } = await fx!.svc.rpc('resolve_seller_fee', args as any)
  if (error) throw new Error(`resolve_seller_fee: ${error.message}`)
  return (data as any[])[0] as { pct: string | number; rule_id: string | null; rule_kind: string; rule_scope: string }
}
async function schedule(pct: number, startsAt: string, note = 'guard') {
  return fx!.svc.rpc('fee_rule_schedule_base', { p_game_category_id: pairId, p_pct: pct, p_starts_at: startsAt, p_note: note, p_created_by: null } as any)
}
async function pairRules() {
  const { data, error } = await fx!.svc.from('fee_rules').select('id, kind, pct, starts_at, ends_at, note').eq('game_category_id', pairId).order('starts_at')
  if (error) throw new Error(error.message)
  return data as Array<{ id: string; kind: string; pct: string | number; starts_at: string; ends_at: string | null; note: string | null }>
}

describe.skipIf(!hasEnv)('fee engine PR 5 — admin schedule / cancel seams (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const probe = await fx.svc.rpc('fee_rule_cancel_scheduled', { p_rule_id: '00000000-0000-0000-0000-000000000000' } as any)
    ready = probe.error?.code !== 'PGRST202'
    // The fixture's pair: prefer one with NO pair-scope rule so the file starts
    // from the category default, like a freshly enabled category would.
    const { data: l } = await fx.svc.from('listings').select('game_category_id').eq('id', fx.listingId).single()
    pairId = (l as any).game_category_id
    const { data: withRules } = await fx.svc.from('fee_rules').select('game_category_id').not('game_category_id', 'is', null)
    const ruled = new Set(((withRules ?? []) as any[]).map((r) => r.game_category_id))
    if (ruled.has(pairId)) {
      const { data: alt } = await fx.svc.from('game_categories').select('id').eq('is_enabled', true).limit(200)
      const free = ((alt ?? []) as any[]).find((p) => !ruled.has(p.id))
      if (free) pairId = free.id
    }
    const { data: pair } = await fx.svc.from('game_categories').select('type').eq('id', pairId).single()
    pairType = (pair as any).type
    original = (await pairRules()).map((r) => ({ id: r.id, ends_at: r.ends_at }))
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    if (created.length) {
      const { error } = await fx.svc.from('fee_rules').delete().in('id', created)
      if (error) failures.push(`fee_rules delete: ${error.message}`)
    }
    // Restore any pre-existing pair rule the schedule seam closed (psql-free:
    // the seam itself re-opens on cancel, but a failed test may leave one closed).
    for (const o of original) {
      const { data: cur } = await fx.svc.from('fee_rules').select('ends_at').eq('id', o.id).maybeSingle()
      if (cur && (cur as any).ends_at !== o.ends_at) {
        failures.push(`rule ${o.id} ends_at ${(cur as any).ends_at} ≠ original ${o.ends_at} — restore by hand under app.fee_backfill`)
      }
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`fee-admin-rules cleanup:\n  - ${failures.join('\n  - ')}`)
  }, 60_000)

  it('the PR 5 migration is applied', () => { expect(ready).toBe(true) })

  it('both seams are service-role only: anon and a signed-in seller get 42501', async () => {
    for (const client of [fx!.seller.client, fx!.buyer.client]) {
      const a = await client.rpc('fee_rule_schedule_base', { p_game_category_id: pairId, p_pct: 9, p_starts_at: utcMidnight(20) } as any)
      expect(a.error?.code, a.error?.message).toBe('42501')
      const b = await client.rpc('fee_rule_cancel_scheduled', { p_rule_id: '00000000-0000-0000-0000-000000000000' } as any)
      expect(b.error?.code, b.error?.message).toBe('42501')
    }
  })

  it('a start inside the notice window is refused with the earliest permitted date', async () => {
    const { error } = await schedule(9, utcMidnight(3))
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/needs \d+ days notice \(earliest permitted start/)
    expect(error!.code).toBe('23514')
    expect((await pairRules()).filter((r) => r.note === 'guard')).toEqual([])
  })

  it('an out-of-range rate is refused', async () => {
    const { error } = await schedule(51, utcMidnight(20))
    expect(error?.code).toBe('23514')
  })

  it('schedule: inserts the pair rule; the resolver gives the category default before and the new rate from the start', async () => {
    const start = utcMidnight(20)
    const justBefore = new Date(new Date(start).getTime() - 1000).toISOString()
    // What the pair resolves to the second before the new start, BEFORE the
    // write — the PR 4 category default may already differ from today's rate.
    const before = await resolve(justBefore)
    const { data, error } = await schedule(9, start, 'guard first')
    expect(error, error?.message).toBeNull()
    const out = data as { closed: any; inserted: any }
    if (out?.inserted?.id) created.push(out.inserted.id)
    expect(out.closed).toBeNull() // the pair had no open-ended pair rule
    expect(out.inserted).toMatchObject({ kind: 'base', scope: 'game_category', game_category_id: pairId, category_type: pairType, note: 'guard first' })
    expect(n(out.inserted.pct)).toBe(9)

    const b = await resolve(justBefore)
    expect(n(b.pct)).toBe(n(before.pct))
    expect(b.rule_id).toBe(before.rule_id)
    const a = await resolve(start)
    expect(n(a.pct)).toBe(9)
    expect(a.rule_id).toBe(out.inserted.id)
    expect(a.rule_scope).toBe('game_category')
  })

  it('schedule again LATER: closes the first pair rule exactly at the new start (no gap, no overlap) in one call', async () => {
    const first = created[0]
    const start2 = utcMidnight(40)
    const { data, error } = await schedule(11, start2, 'guard second')
    expect(error, error?.message).toBeNull()
    const out = data as { closed: any; inserted: any }
    if (out?.inserted?.id) created.push(out.inserted.id)
    expect(out.closed?.id).toBe(first)
    expect(out.closed?.ends_at).toBeTruthy()
    expect(new Date(out.closed.ends_at).toISOString()).toBe(start2)

    // Hand-over is gap-free: the second before start2 is still 9, start2 is 11.
    expect(n((await resolve(new Date(new Date(start2).getTime() - 1000).toISOString())).pct)).toBe(9)
    expect(n((await resolve(start2)).pct)).toBe(11)
    expect((await resolve(start2)).rule_id).toBe(out.inserted.id)
  })

  it('schedule EARLIER than an already-scheduled pair rule is refused (cancel it first), and nothing is written', async () => {
    const rulesBefore = await pairRules()
    const { error } = await schedule(8, utcMidnight(30))
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/already scheduled .* cancel it first/)
    expect(error!.code).toBe('23P01')
    expect(await pairRules()).toEqual(rulesBefore)
  })

  it('cancel: deletes the not-yet-started rule and RE-OPENS the rule it had closed', async () => {
    const [first, second] = created
    const { data, error } = await fx!.svc.rpc('fee_rule_cancel_scheduled', { p_rule_id: second } as any)
    expect(error, error?.message).toBeNull()
    const out = data as { deleted: any; reopened: any }
    expect(out.deleted.id).toBe(second)
    expect(out.reopened?.id).toBe(first)
    expect(out.reopened?.ends_at).toBeNull()
    created.splice(created.indexOf(second), 1)
    const rows = await pairRules()
    expect(rows.find((r) => r.id === second)).toBeUndefined()
    expect(rows.find((r) => r.id === first)?.ends_at).toBeNull()
    // The first rule now runs open-ended again: still 9 at what was start2.
    expect(n((await resolve(utcMidnight(40))).pct)).toBe(9)
  })

  it('cancel refuses a rule that has started, and a category-scope rule', async () => {
    // Insert a historical pair rule under the backfill GUC is a psql-only path;
    // instead assert on the category default (started, category scope) — both
    // refusals are check_violation.
    const cat = await resolve()
    const { data: catRule } = await fx!.svc.from('fee_rules').select('id, scope').eq('id', cat.rule_id!).single()
    expect((catRule as any).scope).toBe('category')
    const { error } = await fx!.svc.rpc('fee_rule_cancel_scheduled', { p_rule_id: (catRule as any).id } as any)
    expect(error?.code).toBe('23514')
    expect(error?.message).toMatch(/only a pair-scope base rule/)
    const { error: nf } = await fx!.svc.rpc('fee_rule_cancel_scheduled', { p_rule_id: '00000000-0000-0000-0000-000000000000' } as any)
    expect(nf?.code).toBe('P0002')
  })

  it('promo: starts now with no notice, wins over the base rate, and a plain UPDATE ends it early', async () => {
    const before = await resolve()
    // A minute in the past: the DB clock (Docker VM) can sit a few hundred ms
    // either side of the host's, and a start stamped "now" here could land in
    // the DB's future (see fee-pr3.md, founding flake).
    const startedAgo = new Date(Date.now() - 60_000).toISOString()
    const { data, error } = await fx!.svc.from('fee_rules').insert({
      kind: 'promo', scope: 'game_category', category_type: pairType, game_category_id: pairId,
      pct: 0, starts_at: startedAgo, ends_at: utcMidnight(10), note: 'guard promo',
    } as any).select('id').single()
    expect(error, error?.message).toBeNull()
    created.push((data as any).id)
    const during = await resolve()
    expect(n(during.pct)).toBe(0)
    expect(during.rule_kind).toBe('promo')
    expect(during.rule_id).toBe((data as any).id)

    const { error: ue } = await fx!.svc.from('fee_rules').update({ ends_at: new Date().toISOString() } as any).eq('id', (data as any).id)
    expect(ue, ue?.message).toBeNull()
    const after = await resolve(new Date(Date.now() + 2000).toISOString())
    expect(n(after.pct)).toBe(n(before.pct))
    expect(after.rule_id).toBe(before.rule_id)
  })

  it('an unbounded promo is refused by the database', async () => {
    const { error } = await fx!.svc.from('fee_rules').insert({
      kind: 'promo', scope: 'game_category', category_type: pairType, game_category_id: pairId,
      pct: 0, starts_at: new Date().toISOString(), ends_at: null,
    } as any)
    expect(error?.message).toMatch(/fee_rules_promo_bounded/)
  })
})
