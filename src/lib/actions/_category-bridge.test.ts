/**
 * AUTH-010 — the legacy-category bridge must not let a seller path mutate the
 * catalogue. `ensureLegacyCategoryRow` ran under the service role from
 * publishListing and (a) re-activated admin-deactivated `categories` rows and
 * (b) synthesised new rows for any real game. Only the admin wizard may
 * reactivate; every caller must first prove the (game, slug) pair is an
 * admin-enabled `game_categories` row via `isEnabledGameCategory`.
 */
import { describe, it, expect, vi } from 'vitest'
import { ensureLegacyCategoryRow, isEnabledGameCategory } from './_category-bridge'

type Res = { data: unknown; error: unknown }

/** Chainable PostgREST stub: from(table) hands out queued results per table. */
function mockSupabase(queues: Record<string, Res[]>) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const client = {
    calls,
    from(table: string) {
      const res = queues[table]?.shift() ?? { data: null, error: null }
      const b: any = {}
      for (const m of ['select', 'eq', 'filter', 'in', 'is', 'limit', 'order']) b[m] = () => b
      for (const m of ['insert', 'update', 'upsert']) {
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

describe('AUTH-010 — ensureLegacyCategoryRow never reactivates from a non-admin path', () => {
  it('returns null and issues no UPDATE when only an inactive row exists (default = seller path)', async () => {
    const sb = mockSupabase({
      games: [{ data: { slug: 'fortnite' }, error: null }],
      categories: [{ data: [{ id: 'cat-inactive', is_active: false, slug: 'buy-items' }], error: null }],
    })
    const id = await ensureLegacyCategoryRow(sb as any, GAME, 'items')
    expect(id).toBeNull()
    expect(sb.calls.filter((c) => c.table === 'categories' && c.op === 'update')).toHaveLength(0)
  })

  it('reactivates only when the caller opts in (admin wizard)', async () => {
    const sb = mockSupabase({
      games: [{ data: { slug: 'fortnite' }, error: null }],
      categories: [{ data: [{ id: 'cat-inactive', is_active: false, slug: 'buy-items' }], error: null }],
    })
    const id = await ensureLegacyCategoryRow(sb as any, GAME, 'items', { reactivate: true })
    expect(id).toBe('cat-inactive')
    const upd = sb.calls.filter((c) => c.table === 'categories' && c.op === 'update')
    expect(upd).toHaveLength(1)
    expect(upd[0].args[0]).toEqual({ is_active: true })
  })

  it('still returns an existing ACTIVE row without writing', async () => {
    const sb = mockSupabase({
      games: [{ data: { slug: 'fortnite' }, error: null }],
      categories: [{ data: [{ id: 'cat-active', is_active: true, slug: 'buy-items' }], error: null }],
    })
    expect(await ensureLegacyCategoryRow(sb as any, GAME, 'items')).toBe('cat-active')
    expect(sb.calls).toHaveLength(0)
  })
})

describe('AUTH-010 — isEnabledGameCategory', () => {
  it('is false when the global category slug is unknown/inactive', async () => {
    const sb = mockSupabase({ global_categories: [{ data: null, error: null }] })
    expect(await isEnabledGameCategory(sb as any, GAME, 'items')).toBe(false)
  })

  it('is false when the (game, category) pair has no enabled game_categories row', async () => {
    const sb = mockSupabase({
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: null, error: null }],
    })
    expect(await isEnabledGameCategory(sb as any, GAME, 'items')).toBe(false)
  })

  it('is true for an admin-enabled pair', async () => {
    const sb = mockSupabase({
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: { id: 'pair-1' }, error: null }],
    })
    expect(await isEnabledGameCategory(sb as any, GAME, 'items')).toBe(true)
  })
})
