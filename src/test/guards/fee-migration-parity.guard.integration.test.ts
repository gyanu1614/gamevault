/**
 * Fee engine PR 1 — MONEY-NEUTRALITY PROOF (docs/design/fee-engine.md §6.1, §7.4).
 *
 * For every game_categories row in the target catalogue, the seeded
 * resolve_seller_fee(NULL, pair) must equal what src/lib/fees commissionPct()
 * charges TODAY for that pair. This is what makes the checkout switch (PR 3)
 * a no-op for every seller. It is written in PR 1, must be green for PR 3 to
 * merge, and is DELETED in PR 4 where the rates intentionally diverge.
 *
 * Founding parity is the one approved deviation: a founding seller resolves
 * to base × 0.5 for 12 months from profiles.created_at (founding_since is
 * backfilled to created_at), and to the plain base afterwards. Today's TS
 * gives base − 2 pts for life; that difference is the approved decision, not
 * a bug, so this file asserts the NEW rule rather than TS parity for it.
 *
 * Runs through the anon key on purpose: it is the role the public fee page
 * and the ISR'd /[game]/sell will use, so the grant is proven at the same time.
 *
 * NOTE on a fresh local stack: the pair-scope seed rows (Roblox-economy
 * currency 10%, GTA accounts 20%) are created for the pairs that EXIST when
 * the seed migration runs. After `supabase db reset` + `pnpm seed:games
 * --env=local`, re-apply the seed file once (it is idempotent) so those pairs
 * get their rules — see docs/handoff/fee-pr1.md. Production already has the
 * catalogue, so `db push` does it in one pass.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { commissionPct } from '@/lib/fees'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

type Pair = { id: string; slug: string; type: string; game: { slug: string } | null }

async function resolveAnon(pairId: string, sellerId: string | null = null, at?: string) {
  const args: Record<string, unknown> = { p_seller_id: sellerId, p_game_category_id: pairId }
  if (at) args.p_at = at
  const { data, error } = await anon().rpc('resolve_seller_fee', args)
  if (error) throw new Error(`resolve_seller_fee(${sellerId}, ${pairId}): ${error.message}`)
  return (data as any[])[0] as { pct: string | number; base_pct: string | number; rule_id: string | null; founding_applied: boolean; fallback_count: number }
}

describe.skipIf(!hasEnv)('fee engine — money-neutral seed parity with lib/fees (integration)', () => {
  let pairs: Pair[] = []

  beforeAll(async () => {
    fx = await makeFixture()
    const probe = await fx.svc.rpc('resolve_seller_fee', { p_seller_id: null, p_game_category_id: '00000000-0000-0000-0000-000000000000' })
    ready = !probe.error || probe.error.code !== 'PGRST202'
    const { data, error } = await fx.svc.from('game_categories').select('id, slug, type, game:games ( slug )')
    if (error) throw new Error(`game_categories: ${error.message}`)
    pairs = (data ?? []) as unknown as Pair[]
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('the fee-engine migrations are applied', () => { expect(ready).toBe(true) })

  it('the catalogue is present (parity over an empty catalogue proves nothing)', () => {
    // The guard fixture always creates at least one pair, so the floor is 1;
    // a real catalogue (prod: 405 pairs) is what this file is for.
    expect(pairs.length).toBeGreaterThanOrEqual(1)
    if (pairs.length < 50) {
      // eslint-disable-next-line no-console
      console.warn(`[fee-parity] only ${pairs.length} pair(s) in the target catalogue — run \`pnpm seed:games --env=local\` for the full proof`)
    }
  })

  it('every pair resolves to exactly what commissionPct() charges today, and none through the fallback', async () => {
    const mismatches: string[] = []
    const gaps: string[] = []
    const CHUNK = 40
    for (let i = 0; i < pairs.length; i += CHUNK) {
      const slice = pairs.slice(i, i + CHUNK)
      const rows = await Promise.all(slice.map((p) => resolveAnon(p.id)))
      rows.forEach((row, j) => {
        const p = slice[j]
        const expected = commissionPct({ categoryMetaType: p.type, categorySlug: p.slug, gameSlug: p.game?.slug ?? null })
        if (Number(row.pct) !== expected) mismatches.push(`${p.game?.slug}/${p.slug} (${p.type}): resolver ${row.pct} ≠ TS ${expected}`)
        if (row.rule_id === null || Number(row.fallback_count) !== 0) gaps.push(`${p.game?.slug}/${p.slug} (${p.type}) resolved through the fallback`)
      })
    }
    expect(mismatches, `resolver ≠ lib/fees for ${mismatches.length} pair(s):\n${mismatches.join('\n')}`).toEqual([])
    expect(gaps, `pairs with no seeded rule:\n${gaps.join('\n')}`).toEqual([])
  }, 120_000)

  it('the six category-scope seed rows match COMMISSION_PCT as enforced (gift_card/service at 7 = the items branch today)', async () => {
    const { data, error } = await anon().from('fee_rules').select('category_type, pct, kind, scope, ends_at').eq('scope', 'category').eq('kind', 'base').is('ends_at', null)
    expect(error, error?.message).toBeNull()
    const byType = Object.fromEntries((data as any[]).map((r) => [r.category_type, Number(r.pct)]))
    expect(byType).toEqual({ currency: 5, items: 7, account: 15, top_up: 5, service: 7, gift_card: 7 })
  })

  it('every rank step is 0 (money-neutral; the real ladder lands in PR 4)', async () => {
    const { data, error } = await fx!.svc.from('seller_tier_config').select('tier, discount_pts')
    expect(error, error?.message).toBeNull()
    for (const r of data as any[]) expect(Number(r.discount_pts), r.tier).toBe(0)
  })

  it('founding: base × 0.5 for 12 months from created_at, base afterwards', async () => {
    const { data: l } = await fx!.svc.from('listings').select('game_category_id').eq('id', fx!.listingId).single()
    const pairId = (l as any).game_category_id as string
    const base = await resolveAnon(pairId)
    expect(base.rule_id).not.toBeNull()

    const { data: prof, error: pe } = await fx!.svc.from('profiles').select('created_at').eq('id', fx!.seller.id).single()
    expect(pe).toBeNull()
    const createdAt = new Date((prof as any).created_at)
    // What the seed migration does for every existing founding seller.
    const { error: ue } = await fx!.svc.from('profiles').update({ founding_seller: true, founding_since: createdAt.toISOString() }).eq('id', fx!.seller.id)
    expect(ue, ue?.message).toBeNull()

    const inWindow = await resolveAnon(pairId, fx!.seller.id)
    expect(inWindow.founding_applied).toBe(true)
    expect(Number(inWindow.pct)).toBe(Number(base.pct) * 0.5)

    const lastDay = new Date(createdAt); lastDay.setUTCMonth(lastDay.getUTCMonth() + 12); lastDay.setUTCDate(lastDay.getUTCDate() - 1)
    const stillIn = await resolveAnon(pairId, fx!.seller.id, lastDay.toISOString())
    expect(stillIn.founding_applied).toBe(true)

    const after = new Date(createdAt); after.setUTCMonth(after.getUTCMonth() + 12); after.setUTCDate(after.getUTCDate() + 1)
    const expired = await resolveAnon(pairId, fx!.seller.id, after.toISOString())
    expect(expired.founding_applied).toBe(false)
    expect(Number(expired.pct)).toBe(Number(base.pct))
  })

  it('every founding seller in the target DB has founding_since = created_at (the PR 1 backfill)', async () => {
    const { data, error } = await fx!.svc.from('profiles').select('id, created_at, founding_since').eq('founding_seller', true)
    expect(error, error?.message).toBeNull()
    const wrong = (data as any[]).filter((p) => p.id !== fx!.seller.id && (!p.founding_since || new Date(p.founding_since).getTime() !== new Date(p.created_at).getTime()))
    expect(wrong.map((p) => p.id), 'founding sellers whose founding_since ≠ created_at').toEqual([])
  })
})
