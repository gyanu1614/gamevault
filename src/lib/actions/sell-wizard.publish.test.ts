/**
 * AUTH-010 — publishListing / bulkPublishListings must not reach the
 * service-role catalogue writes for a (game, category) pair an admin has not
 * enabled. Before the fix the only pre-check was the 5-slug whitelist, so any
 * signed-in user could make `ensureLegacyCategoryRow` INSERT a public
 * `categories` row (and a `category_configs` row) for any real game.
 *
 * AUTH-009 — both publish paths must also refuse anyone who is not an active
 * seller (profiles.role = 'seller' AND seller_status = 'active') or an active
 * admin, mirroring the surviving listings INSERT policy. KYC-before-listing is
 * an explicit owner decision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Res = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  session: null as any,
  admin: null as any,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/seo/indexnow', () => ({ pingIndexNow: vi.fn() }))
vi.mock('@/lib/actions/new-schema', () => ({
  getGlobalCategories: vi.fn(), getGamesForGlobalCategory: vi.fn(), getAttributeTemplateFull: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.session }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => h.admin }))

import { publishListing, bulkPublishListings } from '@/lib/actions/sell-wizard'

/** Chainable PostgREST stub: from(table) hands out queued results per table and records writes. */
function mockClient(queues: Record<string, Res[]>, extra: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const tables: string[] = []
  return {
    calls, tables, ...extra,
    from(table: string) {
      tables.push(table)
      const res = queues[table]?.shift() ?? { data: null, error: null }
      const b: any = {}
      for (const m of ['select', 'eq', 'filter', 'in', 'is', 'limit', 'order', 'neq']) b[m] = () => b
      for (const m of ['insert', 'update', 'upsert', 'delete']) {
        b[m] = (...args: unknown[]) => { calls.push({ table, op: m, args }); return b }
      }
      b.maybeSingle = async () => res
      b.single = async () => res
      b.then = (ok: any, ko: any) => Promise.resolve(res).then(ok, ko)
      return b
    },
  }
}

const USER = { id: 'seller-1' }
const POLICY = { at_listing_limit: false, needs_moderation: false, auto_approve_single: true, auto_approve_bulk: true, bulk_daily_cap: null, bulk_today_count: 0, listing_limit: 10 }

function sessionWith(queues: Record<string, Res[]>) {
  return mockClient(queues, {
    auth: { getUser: async () => ({ data: { user: USER }, error: null }) },
    rpc: async () => ({ data: POLICY, error: null }),
  })
}

const INPUT = {
  game_id: 'game-1', category_slug: 'items', title: 'Sword', description: 'x', price: 5,
  quantity: 1, min_quantity: 1, delivery_method: 'manual' as const, images: [], template_data: {}, status: 'active' as const,
}

beforeEach(() => { h.session = null; h.admin = null })

describe('AUTH-010 — publish paths require an admin-enabled (game, category) pair', () => {
  it('publishListing: pair not enabled → rejected before any service-role catalogue access', async () => {
    h.session = sessionWith({
      profiles: [{ data: { role: 'seller', seller_status: 'active' }, error: null }],
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: null, error: null }], // not enabled for this game
    })
    h.admin = mockClient({})
    const res = await publishListing(INPUT)
    expect(res.success).toBe(false)
    expect((res as any).error).toMatch(/category/i)
    expect(h.admin.tables).toEqual([])           // service role never touched
    expect(h.session.calls.filter((c: any) => c.table === 'listings')).toHaveLength(0)
  })

  it('bulkPublishListings: pair not enabled → rejected before any service-role catalogue access', async () => {
    h.session = sessionWith({
      profiles: [{ data: { role: 'seller', seller_status: 'active' }, error: null }],
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: null, error: null }],
    })
    h.admin = mockClient({})
    const res = await bulkPublishListings('game-1', 'items', [
      { line: 1, title: 'A', price: 1, quantity: 1, delivery_method: 'manual', images: [], template_data: {} } as any,
    ])
    expect(res.success).toBe(false)
    expect(h.admin.tables).toEqual([])
    expect(h.session.calls.filter((c: any) => c.table === 'listings')).toHaveLength(0)
  })

  it('publishListing: enabled pair with an existing active legacy row → listing inserted, no catalogue write', async () => {
    h.session = sessionWith({
      profiles: [{ data: { role: 'seller', seller_status: 'active' }, error: null }],
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: { id: 'pair-1' }, error: null }],
      listings: [{ data: { id: 'l-1', slug: 'sword' }, error: null }],
    })
    h.admin = mockClient({
      games: [{ data: { slug: 'fortnite' }, error: null }],
      categories: [{ data: [{ id: 'cat-1', is_active: true, slug: 'buy-items' }], error: null }],
    })
    const res = await publishListing({ ...INPUT, status: 'draft' })
    expect(res).toEqual({ success: true, data: { id: 'l-1', status: 'draft' } })
    expect(h.admin.calls).toEqual([])            // read-only against the catalogue
    expect(h.session.calls.filter((c: any) => c.table === 'listings' && c.op === 'insert')).toHaveLength(1)
  })
})

describe('AUTH-009 — publish paths refuse non-sellers before touching anything', () => {
  const notSeller = { role: 'user', seller_status: 'active' }
  const restricted = { role: 'seller', seller_status: 'restricted' }

  for (const [label, profile] of [['a plain user', notSeller], ['a restricted seller', restricted]] as const) {
    it(`publishListing: ${label} is rejected with no catalogue or listings access`, async () => {
      h.session = sessionWith({
        profiles: [{ data: profile, error: null }],
        admin_roles: [{ data: null, error: null }],
        global_categories: [{ data: { id: 'gc-items' }, error: null }],
        game_categories: [{ data: { id: 'pair-1' }, error: null }],
      })
      h.admin = mockClient({})
      const res = await publishListing(INPUT)
      expect(res.success).toBe(false)
      expect((res as any).error).toMatch(/seller/i)
      expect(h.admin.tables).toEqual([])
      expect(h.session.tables).not.toContain('listings')
    })

    it(`bulkPublishListings: ${label} is rejected with no catalogue or listings access`, async () => {
      h.session = sessionWith({
        profiles: [{ data: profile, error: null }],
        admin_roles: [{ data: null, error: null }],
        global_categories: [{ data: { id: 'gc-items' }, error: null }],
        game_categories: [{ data: { id: 'pair-1' }, error: null }],
      })
      h.admin = mockClient({})
      const res = await bulkPublishListings('game-1', 'items', [
        { line: 1, title: 'A', price: 1, quantity: 1, delivery_method: 'manual', images: [], template_data: {} } as any,
      ])
      expect(res.success).toBe(false)
      expect(h.admin.tables).toEqual([])
      expect(h.session.tables).not.toContain('listings')
    })
  }

  it('an active admin without role=seller may still publish (parity with the INSERT policy)', async () => {
    h.session = sessionWith({
      profiles: [{ data: { role: 'user', seller_status: 'active' }, error: null }],
      admin_roles: [{ data: { role: 'admin' }, error: null }],
      global_categories: [{ data: { id: 'gc-items' }, error: null }],
      game_categories: [{ data: { id: 'pair-1' }, error: null }],
      listings: [{ data: { id: 'l-2', slug: 'x' }, error: null }],
    })
    h.admin = mockClient({
      games: [{ data: { slug: 'fortnite' }, error: null }],
      categories: [{ data: [{ id: 'cat-1', is_active: true, slug: 'buy-items' }], error: null }],
    })
    const res = await publishListing({ ...INPUT, status: 'draft' })
    expect(res.success).toBe(true)
  })
})
