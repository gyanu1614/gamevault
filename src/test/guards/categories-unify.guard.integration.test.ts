/**
 * Step 1b — one category system (migration 20260917190852, Phase A).
 *
 * Properties of the DATABASE that no unit test can prove:
 *
 *  1. Backfill proof. Every listing has a game_category_id, and that row is
 *     in the same game, of the same type, with the same slug as the legacy
 *     categories row listings.category_id still points at. This is the query
 *     the owner runs read-only on prod before and after applying.
 *
 *  2. Phase-A sync triggers, both directions, with no loop:
 *       game_categories → categories mirror (insert creates the legacy row;
 *       update follows; exactly one legacy row ever).
 *       listings.category_id ⇄ listings.game_category_id (whichever side a
 *       writer sets, the other is derived).
 *     A loop would recurse until max_stack_depth and error — the assertions
 *     below cannot pass if either trigger re-enters itself.
 *
 *  3. Constraints: slug CHECK, type CHECK, UNIQUE (game_id, slug),
 *     UNIQUE (game_id, global_category_id).
 *
 *  4. RLS parity: anon can SELECT game_categories including disabled rows
 *     (exactly like the legacy table), and cannot write.
 *
 * Every row this file creates hangs off a throwaway game deleted in afterAll
 * (game_categories and categories cascade from games; listings are deleted
 * first because listings.game_category_id is ON DELETE RESTRICT).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, assertGuardTargetAllowed, URL, SVC, ANON, makeFixture, type Fixture } from './throwaway'

const TAG = `s1b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let svc: SupabaseClient
let fx: Fixture | null = null
let applied = false
let gameId = ''
let globalItemsId = ''
let globalCurrencyId = ''
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

describe.skipIf(!hasEnv)('categories unify — Phase A (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(URL, process.env)
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    // Migration probe: the new columns exist.
    const { error } = await svc.from('game_categories').select('legacy_category_id, type, slug').limit(1)
    applied = !error
    if (!applied) {
      // Loud, not silent: a stack without 20260917190852 must fail this file,
      // otherwise every assertion below is skipped and the guard is green for nothing.
      throw new Error(`categories unify migration not applied on ${URL}: ${error?.message}`)
    }
    fx = await makeFixture()
    const { data: g, error: ge } = await svc.from('games')
      .insert({ name: `Guard S1b Game ${TAG}`, slug: `guard-s1b-${TAG}` }).select('id').single()
    if (ge) throw new Error(`game insert: ${ge.message}`)
    gameId = (g as any).id
    const { data: globals } = await svc.from('global_categories').select('id, slug').in('slug', ['items', 'currency'])
    for (const row of (globals ?? []) as any[]) {
      if (row.slug === 'items') globalItemsId = row.id
      if (row.slug === 'currency') globalCurrencyId = row.id
    }
    if (!globalItemsId || !globalCurrencyId) throw new Error('global_categories items/currency missing — seed migration not applied')
  })

  afterAll(async () => {
    if (!svc || !applied) return
    // listings first (RESTRICT on game_category_id), then the game (cascades pairs + legacy rows).
    await svc.from('listings').delete().eq('game_id', gameId)
    await svc.from('category_configs').delete().eq('game_id', gameId)
    await svc.from('games').delete().eq('id', gameId)
    const { data: left } = await svc.from('categories').select('id').eq('game_id', gameId)
    expect(left ?? []).toEqual([])
    if (fx) await fx.cleanup()
  })

  it('backfill proof: every listing maps to a same-game, same-type, same-slug pair', async () => {
    if (!applied) return
    const [{ data: listings }, { data: pairs }, { data: legacy }] = await Promise.all([
      svc.from('listings').select('id, game_id, category_id, game_category_id'),
      svc.from('game_categories').select('id, game_id, type, slug, legacy_category_id'),
      svc.from('categories').select('id, slug, metadata'),
    ])
    const pairById = new Map((pairs ?? []).map((p: any) => [p.id, p]))
    const legacyById = new Map((legacy ?? []).map((c: any) => [c.id, c]))
    const bad = { unmatched: 0, game: 0, type: 0, slug: 0 }
    for (const l of (listings ?? []) as any[]) {
      const p = pairById.get(l.game_category_id)
      const c = legacyById.get(l.category_id)
      if (!p) { bad.unmatched++; continue }
      if (p.game_id !== l.game_id) bad.game++
      if (c && p.type !== c.metadata?.type) bad.type++
      if (c && p.slug !== c.slug) bad.slug++
    }
    expect(bad).toEqual({ unmatched: 0, game: 0, type: 0, slug: 0 })
    // and every legacy row is claimed by exactly one pair
    const claimed = new Set((pairs ?? []).map((p: any) => p.legacy_category_id).filter(Boolean))
    const orphans = (legacy ?? []).filter((c: any) => !claimed.has(c.id))
    expect(orphans).toEqual([])
  })

  it('mirror trigger: inserting a pair creates ONE legacy row; updating follows; no loop', async () => {
    if (!applied) return
    const { data: pair, error } = await svc.from('game_categories')
      .insert({ game_id: gameId, global_category_id: globalItemsId, is_enabled: true, slug: 'buy-items', name: 'Items', type: 'items', sort_order: 2 })
      .select('id, legacy_category_id').single()
    expect(error).toBeNull()
    expect((pair as any).legacy_category_id).toBeTruthy()

    const { data: legacy } = await svc.from('categories').select('id, slug, name, is_active, display_order, metadata').eq('game_id', gameId)
    expect(legacy).toHaveLength(1)
    expect((legacy as any)[0]).toMatchObject({ id: (pair as any).legacy_category_id, slug: 'buy-items', name: 'Items', is_active: true, display_order: 2 })
    expect((legacy as any)[0].metadata.type).toBe('items')

    const { error: ue } = await svc.from('game_categories')
      .update({ name: 'Items!', is_enabled: false, sub_types: ['Hats'] }).eq('id', (pair as any).id)
    expect(ue).toBeNull()
    const { data: after } = await svc.from('categories').select('name, is_active, metadata').eq('game_id', gameId)
    expect(after).toHaveLength(1)
    expect((after as any)[0]).toMatchObject({ name: 'Items!', is_active: false })
    expect((after as any)[0].metadata.sub_types).toEqual(['Hats'])
    // re-enable for the listing tests below
    await svc.from('game_categories').update({ is_enabled: true }).eq('id', (pair as any).id)
  })

  it('listings sync trigger: whichever side is written, the other is derived (both directions, insert + update)', async () => {
    if (!applied || !fx) return
    const { data: pair } = await svc.from('game_categories').select('id, legacy_category_id').eq('game_id', gameId).eq('slug', 'buy-items').single()
    const pairId = (pair as any).id
    const legacyId = (pair as any).legacy_category_id

    // second pair to move between
    const { data: cur, error: ce } = await svc.from('game_categories')
      .insert({ game_id: gameId, global_category_id: globalCurrencyId, is_enabled: true, slug: 'buy-coins', name: 'Coins', type: 'currency' })
      .select('id, legacy_category_id').single()
    expect(ce).toBeNull()

    const base = { seller_id: fx.seller.id, game_id: gameId, title: `GUARD-S1B-${TAG} listing`, description: 'guard test throwaway', price: 1, quantity: 1, status: 'draft' }

    // insert with ONLY game_category_id
    const { data: a, error: ae } = await svc.from('listings').insert({ ...base, game_category_id: pairId }).select('id, category_id, game_category_id').single()
    expect(ae).toBeNull()
    expect((a as any).category_id).toBe(legacyId)

    // insert with ONLY category_id (rollback-era writer)
    const { data: b, error: be } = await svc.from('listings').insert({ ...base, category_id: legacyId }).select('id, category_id, game_category_id').single()
    expect(be).toBeNull()
    expect((b as any).game_category_id).toBe(pairId)

    // update game_category_id → category_id follows
    await svc.from('listings').update({ game_category_id: (cur as any).id }).eq('id', (a as any).id)
    const { data: a2 } = await svc.from('listings').select('category_id').eq('id', (a as any).id).single()
    expect((a2 as any).category_id).toBe((cur as any).legacy_category_id)

    // update category_id → game_category_id follows
    await svc.from('listings').update({ category_id: (cur as any).legacy_category_id }).eq('id', (b as any).id)
    const { data: b2 } = await svc.from('listings').select('game_category_id').eq('id', (b as any).id).single()
    expect((b2 as any).game_category_id).toBe((cur as any).id)
  })

  it('constraints: slug CHECK, type CHECK, UNIQUE (game_id, slug), UNIQUE (game_id, global_category_id)', async () => {
    if (!applied) return
    const bad = async (row: Record<string, unknown>) =>
      (await svc.from('game_categories').insert({ game_id: gameId, ...row })).error?.message ?? ''
    expect(await bad({ global_category_id: globalItemsId, slug: 'Bad Slug', name: 'x', type: 'items' })).toMatch(/slug_check|global_category_id/)
    expect(await bad({ global_category_id: globalItemsId, slug: 'ok-slug', name: 'x', type: 'weapons' })).toMatch(/type_check|global_category_id/)
    // same slug, different global → (game_id, slug) unique
    const { data: g } = await svc.from('global_categories').select('id').eq('slug', 'accounts').single()
    expect(await bad({ global_category_id: (g as any).id, slug: 'buy-items', name: 'dup', type: 'account' })).toMatch(/game_categories_game_id_slug_key/)
    // same global, different slug → (game_id, global_category_id) unique
    expect(await bad({ global_category_id: globalItemsId, slug: 'second-items', name: 'dup', type: 'items' })).toMatch(/game_categories_game_id_global_category_id_key/)
  })

  it('RLS parity: anon reads game_categories including disabled rows, and cannot write', async () => {
    if (!applied) return
    await svc.from('game_categories').update({ is_enabled: false }).eq('game_id', gameId).eq('slug', 'buy-coins')
    const { data, error } = await anon().from('game_categories').select('slug, is_enabled').eq('game_id', gameId)
    expect(error).toBeNull()
    expect((data ?? []).some((r: any) => r.slug === 'buy-coins' && r.is_enabled === false)).toBe(true)
    const { error: we } = await anon().from('game_categories').insert({ game_id: gameId, global_category_id: globalItemsId, slug: 'anon-write', name: 'x', type: 'items' })
    expect(we).not.toBeNull()
  })
})
