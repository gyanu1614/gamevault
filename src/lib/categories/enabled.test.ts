/**
 * AUTH-010 — the seller publish gate. A signed-in user can only publish into
 * a (game, global category) pair an admin enabled in game_categories, and the
 * gate never writes anything (the legacy bridge that could INSERT catalogue
 * rows from a seller path was deleted in Step 1b).
 */
import { describe, it, expect } from 'vitest'
import { findEnabledGameCategory, isEnabledGameCategory } from './enabled'

type Res = { data: unknown; error: unknown }

/** Chainable PostgREST stub: from(table) hands out queued results per table. */
function mockSupabase(queues: Record<string, Res[]>) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const filters: Array<{ table: string; col: string; val: unknown }> = []
  const client = {
    calls, filters,
    from(table: string) {
      const res = queues[table]?.shift() ?? { data: null, error: null }
      const b: any = {}
      for (const m of ['select', 'filter', 'in', 'is', 'limit', 'order']) b[m] = () => b
      b.eq = (col: string, val: unknown) => { filters.push({ table, col, val }); return b }
      for (const m of ['insert', 'update', 'upsert', 'delete']) {
        b[m] = (...args: unknown[]) => { calls.push({ table, op: m, args }); return b }
      }
      b.maybeSingle = async () => res
      b.single = async () => res
      b.then = (ok: any, ko: any) => Promise.resolve(res).then(ok, ko)
      return b
    },
  }
  return client
}

const GAME = 'game-1'
const PAIR = { id: 'pair-1', slug: 'buy-items', name: 'Items', type: 'items', legacy_category_id: 'cat-1' }

describe('AUTH-010 — findEnabledGameCategory / isEnabledGameCategory', () => {
  it('is null/false when the global category slug is unknown or inactive', async () => {
    const sb = mockSupabase({ global_categories: [{ data: null, error: null }] })
    expect(await findEnabledGameCategory(sb as any, GAME, 'items')).toBeNull()
    expect(sb.filters).toContainEqual({ table: 'global_categories', col: 'is_active', val: true })
  })

  it('is null/false when the (game, category) pair has no enabled game_categories row', async () => {
    const sb = mockSupabase({
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: null, error: null }],
    })
    expect(await isEnabledGameCategory(sb as any, GAME, 'items')).toBe(false)
    // The is_enabled filter is explicit — the public SELECT policy is USING (true) for legacy parity.
    expect(sb.filters).toContainEqual({ table: 'game_categories', col: 'is_enabled', val: true })
  })

  it('is null when the slug is a sub-category whose primary is inactive (coaching under disabled boosting)', async () => {
    const sb = mockSupabase({
      global_categories: [
        { data: { id: 'gc-coaching', parent_id: 'gc-boosting' }, error: null },
        { data: null, error: null }, // parent lookup filtered by is_active → nothing
      ],
      game_categories: [{ data: { ...PAIR, slug: 'coaching', type: 'service' }, error: null }],
    })
    expect(await findEnabledGameCategory(sb as any, GAME, 'coaching')).toBeNull()
    expect(sb.filters).toContainEqual({ table: 'global_categories', col: 'id', val: 'gc-boosting' })
  })

  it('allows a sub-category whose primary is active (limiteds under items)', async () => {
    const sb = mockSupabase({
      global_categories: [
        { data: { id: 'gc-limiteds', parent_id: 'gc-items' }, error: null },
        { data: { id: 'gc-items' }, error: null },
      ],
      game_categories: [{ data: { ...PAIR, slug: 'limiteds' }, error: null }],
    })
    expect(await findEnabledGameCategory(sb as any, GAME, 'limiteds')).toMatchObject({ slug: 'limiteds' })
  })

  it('returns the enabled pair row (id, slug, type, legacy mirror id) and never writes', async () => {
    const sb = mockSupabase({
      global_categories: [{ data: { id: 'gc-items', parent_id: null }, error: null }],
      game_categories: [{ data: PAIR, error: null }],
    })
    expect(await findEnabledGameCategory(sb as any, GAME, 'items')).toEqual(PAIR)
    expect(await isEnabledGameCategory(sb as any, GAME, 'items')).toBe(false) // queues drained → null → false
    expect(sb.calls).toEqual([])
  })
})
