/**
 * Fee engine PR 4 — THE RATE CHANGE, pinned on both sides of the start date
 * (docs/design/fee-engine.md §6 PR 4 row, §6.2; migration
 * 20260922001513_fee_engine_rates_2026_10).
 *
 * PR 1 wrote this file as the money-neutrality proof (resolver == lib/fees
 * commissionPct() for every catalogue pair). PR 4 is where the rates
 * intentionally diverge, so the proof becomes two-sided:
 *
 *   · BEFORE the start (start − 1 s): every pair still resolves to exactly
 *     what commissionPct() charges today — the PR 1 seed rows were closed at
 *     the start, not deleted, so nothing changes early.
 *   · FROM the start: every pair resolves to the PR 4 table (RATES below —
 *     the spec, restated independently of the migration), never through the
 *     fallback, and always to a PR 4 row.
 *
 * Plus the row shape (six open-ended category defaults, all at the start;
 * the PR 1 defaults closed exactly there), the pair-rule and promo sets for
 * the slugs that exist in the catalogue, the rank ladder and the settings.
 *
 * The start date is READ FROM THE DATABASE (the migration slips its floor of
 * 2026-10-06 to the first 00:00 UTC that clears the 14-day notice at push
 * time), so the file is valid on any stack whatever day the migration ran.
 *
 * Runs through the anon key on purpose: the public fee page and the ISR'd
 * /[game]/sell resolve with that role.
 *
 * Fresh local stack: `supabase db reset` → `pnpm seed:games --env=local` →
 * re-apply the PR 1 seed file, then this PR's migration file (both are
 * idempotent) so the pair-scope rows exist for the reseeded pairs — see
 * docs/handoff/fee-pr4.md.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { commissionPct } from '@/lib/fees'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

type Pair = { id: string; slug: string; type: string; game: { slug: string } | null }
type Rule = { id: string; kind: string; scope: string; category_type: string; game_category_id: string | null; pct: string | number; starts_at: string; ends_at: string | null; note: string | null }

/** The PR 4 spec, restated here so the test does not trust the migration's own numbers. */
const RATES = {
  category: { items: 10, service: 10, top_up: 5, gift_card: 5, currency: 5, account: 10 } as Record<string, number>,
  pairs: [
    { type: 'currency', pct: 10, slugs: ['anime-defenders', 'blade-ball', 'creatures-of-sonaria', 'death-ball', 'dragon-adventures', 'escape-tsunami-for-brainrots', 'fisch', 'fix-it-up', 'grow-a-garden', 'grow-a-garden-2', 'pet-simulator-99', 'pets-go', 'royale-high', 'tap-simulator', 'toilet-tower-defense', 'steal-a-brainrot'] },
    { type: 'account', pct: 15, slugs: ['call-of-duty', 'fortnite', 'r6-siege'] },
    { type: 'account', pct: 20, slugs: ['gta-v', 'gtavi', 'gta-6', 'gta-vi'] },
    { type: 'service', pct: 15, slugs: ['call-of-duty'] },
    { type: 'top_up', pct: 10, slugs: ['99-nights-in-the-forest', 'bite-by-night', 'bloxstrike', 'run-a-restaurant', 'sniper-duels'] },
  ],
  // R6 Credits / FC Points: bought-with-money in-game currency, filed under top_up on this catalogue (never the account pair).
  promos: { types: ['top_up', 'currency'], pct: 0, months: 6, slugs: ['r6-siege', 'fc-25', 'fc-26', 'ea-sports-fc-26'] },
  ladder: { bronze: 0, silver: 0.5, gold: 1, diamond: 1.5, legendary: 2 } as Record<string, number>,
  settings: { rank_floor_pct: 8, founding_discount_pct: 50, founding_months: 12 },
  floorDate: Date.UTC(2026, 9, 6),
}

const n = (v: string | number) => Number(v)
const iso = (ms: number) => new Date(ms).toISOString()
const addMonthsUtc = (d: Date, months: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + months); return x }

const isPromoPair = (p: Pair) => RATES.promos.types.includes(p.type) && RATES.promos.slugs.includes((p.game?.slug ?? '').toLowerCase())
/** The rate the table gives a pair from the start: its promo (0) while it runs, else its pair rule if listed, else the category default. */
function expectedAtStart(p: Pair): number {
  if (isPromoPair(p)) return RATES.promos.pct
  const slug = (p.game?.slug ?? '').toLowerCase()
  const pair = RATES.pairs.find((l) => l.type === p.type && l.slugs.includes(slug))
  return pair ? pair.pct : RATES.category[p.type]
}

async function resolveAnon(pairId: string, sellerId: string | null, at?: string) {
  const args: Record<string, unknown> = { p_seller_id: sellerId, p_game_category_id: pairId }
  if (at) args.p_at = at
  const { data, error } = await anon().rpc('resolve_seller_fee', args)
  if (error) throw new Error(`resolve_seller_fee(${sellerId}, ${pairId}, ${at}): ${error.message}`)
  return (data as any[])[0] as { pct: string | number; base_pct: string | number; rule_id: string | null; rule_kind: string | null; rule_scope: string | null; founding_applied: boolean; fallback_count: number }
}
type Resolved = Awaited<ReturnType<typeof resolveAnon>>

async function sweep(pairs: Pair[], at: string, expected: (p: Pair) => number, label: string, extra?: (p: Pair, row: Resolved) => string | null) {
  const mismatches: string[] = []
  const gaps: string[] = []
  const CHUNK = 40
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const slice = pairs.slice(i, i + CHUNK)
    const rows = await Promise.all(slice.map((p) => resolveAnon(p.id, null, at)))
    rows.forEach((row, j) => {
      const p = slice[j]
      const want = expected(p)
      const tag = `${p.game?.slug}/${p.slug} (${p.type})`
      if (n(row.pct) !== want) mismatches.push(`${tag}: resolver ${row.pct} ≠ ${label} ${want}`)
      if (row.rule_id === null || n(row.fallback_count) !== 0) gaps.push(`${tag} resolved through the fallback`)
      const e = extra?.(p, row)
      if (e) mismatches.push(`${tag}: ${e}`)
    })
  }
  return { mismatches, gaps }
}

describe.skipIf(!hasEnv)('fee engine PR 4 — the new rates, before and from the start date (integration)', () => {
  let pairs: Pair[] = []
  let rules: Rule[] = []
  let start = ''        // ISO, the PR 4 start read from the DB
  let justBefore = ''   // start − 1 s
  const pr4 = () => rules.filter((r) => (r.note ?? '').startsWith('PR4:'))

  beforeAll(async () => {
    fx = await makeFixture()
    const probe = await fx.svc.rpc('resolve_seller_fee', { p_seller_id: null, p_game_category_id: '00000000-0000-0000-0000-000000000000' })
    ready = !probe.error || probe.error.code !== 'PGRST202'
    const { data, error } = await fx.svc.from('game_categories').select('id, slug, type, game:games ( slug )')
    if (error) throw new Error(`game_categories: ${error.message}`)
    pairs = (data ?? []) as unknown as Pair[]
    const fr = await anon().from('fee_rules').select('id, kind, scope, category_type, game_category_id, pct, starts_at, ends_at, note')
    if (fr.error) throw new Error(`fee_rules: ${fr.error.message}`)
    rules = fr.data as Rule[]
    const starts = Array.from(new Set(pr4().filter((r) => r.kind === 'base' && r.scope === 'category').map((r) => new Date(r.starts_at).getTime())))
    if (starts.length === 1) {
      start = iso(starts[0])
      justBefore = iso(starts[0] - 1000)
    }
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('the fee-engine migrations are applied, including PR 4 (one start date, ≥ the announced floor, at 00:00 UTC)', () => {
    expect(ready).toBe(true)
    expect(pr4().length, 'no PR4 rows — apply 20260922001513_fee_engine_rates_2026_10.sql').toBeGreaterThan(0)
    const starts = Array.from(new Set(pr4().filter((r) => r.kind === 'base').map((r) => new Date(r.starts_at).getTime())))
    expect(starts, 'every PR 4 base rule shares ONE start').toHaveLength(1)
    const s = new Date(start)
    expect(s.getTime()).toBeGreaterThanOrEqual(RATES.floorDate)
    expect(s.getTime() % 86_400_000, 'start is a 00:00 UTC boundary').toBe(0)
  })

  it('the catalogue is present (a sweep over an empty catalogue proves nothing)', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(1)
    if (pairs.length < 50) {
      // eslint-disable-next-line no-console
      console.warn(`[fee-parity] only ${pairs.length} pair(s) in the target catalogue — run \`pnpm seed:games --env=local\` and re-apply both seed files for the full proof`)
    }
  })

  it('BEFORE the start (start − 1 s): every pair resolves to exactly what commissionPct() charges today, none through the fallback', async () => {
    const ids = new Set(pr4().map((r) => r.id))
    const { mismatches, gaps } = await sweep(
      pairs, justBefore,
      (p) => commissionPct({ categoryMetaType: p.type, categorySlug: p.slug, gameSlug: p.game?.slug ?? null }),
      'lib/fees today',
      (_p, row) => (row.rule_id && ids.has(row.rule_id) ? `resolved to a PR 4 row (${row.rule_id}) before the start` : null),
    )
    expect(mismatches, `resolver ≠ lib/fees for ${mismatches.length} pair(s) before the start:\n${mismatches.join('\n')}`).toEqual([])
    expect(gaps, `pairs with no rule before the start:\n${gaps.join('\n')}`).toEqual([])
  }, 120_000)

  it('FROM the start: every pair resolves to the PR 4 table, to a PR 4 row, none through the fallback', async () => {
    const ids = new Set(pr4().map((r) => r.id))
    const { mismatches, gaps } = await sweep(
      pairs, start, expectedAtStart, 'table',
      (_p, row) => (row.rule_id && !ids.has(row.rule_id) ? `resolved to a non-PR-4 row ${row.rule_id} at the start` : null),
    )
    expect(mismatches, `resolver ≠ table for ${mismatches.length} pair(s) at the start:\n${mismatches.join('\n')}`).toEqual([])
    expect(gaps, `pairs with no PR 4 rule:\n${gaps.join('\n')}`).toEqual([])
  }, 120_000)

  it('the table is ALSO what a reading 24 h after the start gives (no third rule set lurking)', async () => {
    const { mismatches, gaps } = await sweep(pairs, iso(new Date(start).getTime() + 86_400_000), expectedAtStart, 'table')
    expect(mismatches).toEqual([])
    expect(gaps).toEqual([])
  }, 120_000)

  it('row shape: the six category defaults are the ONLY open-ended base rules, all starting at the start, with the target rates', () => {
    const open = rules.filter((r) => r.kind === 'base' && r.ends_at === null)
    expect(open.filter((r) => new Date(r.starts_at).getTime() !== new Date(start).getTime()).map((r) => r.note), 'open-ended base rules not starting at the start').toEqual([])
    const cat = open.filter((r) => r.scope === 'category')
    expect(Object.fromEntries(cat.map((r) => [r.category_type, n(r.pct)]))).toEqual(RATES.category)
    expect(cat).toHaveLength(6)
  })

  it('row shape: the PR 1 seed defaults are closed EXACTLY at the start (not deleted — history stays reconstructible)', () => {
    const seed = rules.filter((r) => (r.note ?? '').startsWith('Seed:') && r.kind === 'base')
    expect(seed.length).toBeGreaterThanOrEqual(6)
    for (const r of seed) expect(new Date(r.ends_at ?? 0).getTime(), `${r.note}`).toBe(new Date(start).getTime())
    const seedCat = Object.fromEntries(seed.filter((r) => r.scope === 'category').map((r) => [r.category_type, n(r.pct)]))
    expect(seedCat).toEqual({ currency: 5, items: 7, account: 15, top_up: 5, service: 7, gift_card: 7 })
  })

  it('pair rules: every listed slug whose pair EXISTS has a PR 4 pair rule at the listed rate; no PR 4 pair rule is unlisted; skipped slugs are reported', () => {
    const bySlugType = new Map(pairs.map((p) => [`${(p.game?.slug ?? '').toLowerCase()}|${p.type}`, p]))
    const pairRules = pr4().filter((r) => r.kind === 'base' && r.scope === 'game_category')
    const covered = new Set<string>()
    const missing: string[] = []
    const wrong: string[] = []
    for (const list of RATES.pairs) {
      for (const slug of list.slugs) {
        const p = bySlugType.get(`${slug}|${list.type}`)
        if (!p) { missing.push(`${slug}/${list.type}`); continue }
        const rule = pairRules.find((r) => r.game_category_id === p.id)
        if (!rule) wrong.push(`${slug}/${list.type}: no PR 4 pair rule`)
        else if (n(rule.pct) !== list.pct) wrong.push(`${slug}/${list.type}: ${rule.pct} ≠ ${list.pct}`)
        else if (new Date(rule.starts_at).getTime() !== new Date(start).getTime() || rule.ends_at !== null) wrong.push(`${slug}/${list.type}: window ${rule.starts_at}..${rule.ends_at}`)
        covered.add(p.id)
      }
    }
    const unlisted = pairRules.filter((r) => !covered.has(r.game_category_id!)).map((r) => r.note)
    expect(wrong).toEqual([])
    expect(unlisted, 'PR 4 pair rules for pairs the spec does not list').toEqual([])
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.warn(`[fee-parity] listed slugs with no such (game, type) pair in this catalogue — skipped by the migration, listed in the handoff: ${missing.join(', ')}`)
    }
    if (pairs.length >= 50) expect(pairRules.length).toBeGreaterThan(0)
  })

  it('promos: one 0% promo [start, start + 6 months) on every listed slug\'s top_up/currency pair that EXISTS — none on account pairs, none otherwise', () => {
    const promos = pr4().filter((r) => r.kind === 'promo')
    const expected = pairs.filter(isPromoPair)
    expect(promos.map((r) => r.game_category_id).sort()).toEqual(expected.map((p) => p.id).sort())
    const end = addMonthsUtc(new Date(start), RATES.promos.months).getTime()
    for (const r of promos) {
      expect(n(r.pct)).toBe(0)
      expect(new Date(r.starts_at).getTime()).toBe(new Date(start).getTime())
      expect(new Date(r.ends_at ?? 0).getTime()).toBe(end)
    }
    const accountPromo = promos.filter((r) => pairs.find((p) => p.id === r.game_category_id)?.type === 'account')
    expect(accountPromo, 'a 0% promo must never sit on an account pair').toEqual([])
    // eslint-disable-next-line no-console
    console.warn(`[fee-parity] promo pairs matched in this catalogue: ${expected.length ? expected.map((p) => `${p.game?.slug}/${p.type}`).join(', ') : '(none)'}`)
  })

  it('promo pair: 0 from the start (rule_kind promo), back to its base the second the promo ends', async (ctx) => {
    const p = pairs.find(isPromoPair)
    if (!p) return ctx.skip()
    const at = await resolveAnon(p.id, null, start)
    expect(n(at.pct)).toBe(0)
    expect(at.rule_kind).toBe('promo')
    const end = addMonthsUtc(new Date(start), RATES.promos.months)
    const lastSecond = await resolveAnon(p.id, null, new Date(end.getTime() - 1000).toISOString())
    expect(n(lastSecond.pct)).toBe(0)
    const after = await resolveAnon(p.id, null, end.toISOString())
    expect(after.rule_kind).toBe('base')
    const slug = (p.game?.slug ?? '').toLowerCase()
    const base = RATES.pairs.find((l) => l.type === p.type && l.slugs.includes(slug))?.pct ?? RATES.category[p.type]
    expect(n(after.pct)).toBe(base)
    // and before the start the promo does not exist yet: today's rate
    expect(n((await resolveAnon(p.id, null, justBefore)).pct)).toBe(commissionPct({ categoryMetaType: p.type, categorySlug: p.slug, gameSlug: p.game?.slug ?? null }))
  })

  it('rank ladder: bronze 0 · silver 0.5 · gold 1.0 · diamond 1.5 · legendary 2.0 (live at push time — undated table)', async () => {
    const { data, error } = await fx!.svc.from('seller_tier_config').select('tier, discount_pts')
    expect(error, error?.message).toBeNull()
    const got = Object.fromEntries((data as any[]).map((r) => [r.tier, n(r.discount_pts)]))
    for (const [tier, pts] of Object.entries(RATES.ladder)) expect(got[tier], tier).toBe(pts)
  })

  it('settings: floor 8.00, founding 50% × 12 months (public read)', async () => {
    const s = await anon().from('platform_fee_settings').select('rank_floor_pct, founding_discount_pct, founding_months').single()
    expect(s.error, s.error?.message).toBeNull()
    expect({ rank_floor_pct: n((s.data as any).rank_floor_pct), founding_discount_pct: n((s.data as any).founding_discount_pct), founding_months: (s.data as any).founding_months }).toEqual(RATES.settings)
  })

  it('founding: base × 0.5 for 12 months from created_at on BOTH sides of the start (the base itself moves with the table)', async () => {
    // An items pair when the catalogue has one (7 → 10, the clearest move);
    // the fixture's own pair otherwise. Expectations come from the spec.
    const { data: l } = await fx!.svc.from('listings').select('game_category_id').eq('id', fx!.listingId).single()
    const pair = pairs.find((p) => p.type === 'items') ?? pairs.find((p) => p.id === (l as any).game_category_id)!
    const pairId = pair.id
    const baseBefore = commissionPct({ categoryMetaType: pair.type, categorySlug: pair.slug, gameSlug: pair.game?.slug ?? null })
    const baseFrom = expectedAtStart(pair)
    const { data: prof, error: pe } = await fx!.svc.from('profiles').select('created_at').eq('id', fx!.seller.id).single()
    expect(pe).toBeNull()
    const createdAt = new Date((prof as any).created_at)
    const { error: ue } = await fx!.svc.from('profiles').update({ founding_seller: true, founding_since: createdAt.toISOString() }).eq('id', fx!.seller.id)
    expect(ue, ue?.message).toBeNull()

    const before = await resolveAnon(pairId, fx!.seller.id, justBefore)
    expect(before.founding_applied).toBe(true)
    expect(n(before.base_pct)).toBe(baseBefore)
    expect(n(before.pct)).toBe(baseBefore * 0.5)

    const from = await resolveAnon(pairId, fx!.seller.id, start)
    expect(from.founding_applied).toBe(true)
    expect(n(from.base_pct)).toBe(baseFrom)
    expect(n(from.pct)).toBe(baseFrom * 0.5)

    const expired = addMonthsUtc(createdAt, 12); expired.setUTCDate(expired.getUTCDate() + 1)
    const after = await resolveAnon(pairId, fx!.seller.id, expired.toISOString())
    expect(after.founding_applied).toBe(false)
    expect(n(after.pct)).toBe(baseFrom)
  })

  it('every founding seller in the target DB has founding_since = created_at (the PR 1 backfill still holds)', async () => {
    const { data, error } = await fx!.svc.from('profiles').select('id, created_at, founding_since').eq('founding_seller', true)
    expect(error, error?.message).toBeNull()
    const wrong = (data as any[]).filter((p) => p.id !== fx!.seller.id && (!p.founding_since || new Date(p.founding_since).getTime() !== new Date(p.created_at).getTime()))
    expect(wrong.map((p) => p.id), 'founding sellers whose founding_since ≠ created_at').toEqual([])
  })
})
