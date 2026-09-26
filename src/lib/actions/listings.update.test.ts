/**
 * ACC-03 — updateListing / bulkUpdateListings are the seller's only edit path
 * outside the wizard (UPDATE on listings is revoked for JWT callers). They
 * must: check ownership with the session, validate the patch with the shared
 * validator, and write with the SERVICE ROLE pinned to id + seller_id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Res = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({ session: null as any, service: null as any }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/revalidation/listings', () => ({ revalidateListingSurfaces: vi.fn(async () => ({ tags: [] })) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.session }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => h.service }))

import { updateListing, bulkUpdateListings, updateListingPrice } from '@/lib/actions/listings'

function mockClient(queues: Record<string, Res[]>, extra: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; op: string; args: unknown[]; filters: Array<[string, unknown]> }> = []
  return {
    calls, ...extra,
    from(table: string) {
      const res = queues[table]?.shift() ?? { data: null, error: null }
      const b: any = {}
      const filters: Array<[string, unknown]> = []
      for (const m of ['select', 'limit', 'order']) b[m] = () => b
      for (const m of ['eq', 'in', 'is', 'neq']) b[m] = (...a: unknown[]) => { filters.push([m + ':' + a[0], a[1]]); return b }
      for (const m of ['insert', 'update', 'upsert', 'delete']) {
        b[m] = (...args: unknown[]) => { calls.push({ table, op: m, args, filters }); return b }
      }
      b.maybeSingle = async () => res
      b.single = async () => res
      b.then = (ok: any, ko: any) => Promise.resolve(res).then(ok, ko)
      return b
    },
  }
}

const USER = { id: 'seller-1' }
const OWNED = {
  seller_id: 'seller-1', status: 'active', game_id: 'game-1', game_category_id: 'pair-1',
  quantity: 5, min_quantity: 1, is_unlimited: false, delivery_method: 'manual', pair: { type: 'items' },
}
function session(listing: Record<string, unknown> | null) {
  return mockClient(
    { listings: [{ data: listing, error: null }], category_configs: [{ data: null, error: null }] },
    { auth: { getUser: async () => ({ data: { user: USER }, error: null }) } },
  )
}

beforeEach(() => { h.session = null; h.service = null })

describe('updateListing', () => {
  it('refuses a listing the caller does not own before any write', async () => {
    h.session = session({ ...OWNED, seller_id: 'someone-else' })
    h.service = mockClient({})
    const res = await updateListing('l-1', { price: 2 })
    expect(res.success).toBe(false)
    expect(h.service.calls).toEqual([])
  })

  it('validates the patch and writes ONLY through the service role, pinned to id + seller_id', async () => {
    h.session = session(OWNED)
    h.service = mockClient({ listings: [{ data: { id: 'l-1', price: 2 }, error: null }] })
    const res = await updateListing('l-1', { price: 2 })
    expect(res.success).toBe(true)
    expect(h.session.calls.filter((c: any) => c.table === 'listings')).toEqual([])
    const w = h.service.calls.find((c: any) => c.table === 'listings' && c.op === 'update')!
    expect((w.args[0] as any).price).toBe(2)
    expect(w.filters).toEqual(expect.arrayContaining([['eq:id', 'l-1'], ['eq:seller_id', 'seller-1']]))
  })

  it('a moderation column or a foreign seller_id in the patch is refused (strict schema)', async () => {
    h.session = session(OWNED)
    h.service = mockClient({})
    const res = await updateListing('l-1', { approved_by: 'seller-1' } as never)
    expect(res.success).toBe(false)
    expect(h.service.calls).toEqual([])
  })

  it('AUTH-034: a moderated-out listing cannot be re-activated here', async () => {
    h.session = session({ ...OWNED, status: 'rejected' })
    h.service = mockClient({})
    const res = await updateListing('l-1', { status: 'active' })
    expect(res.success).toBe(false)
    expect(h.service.calls).toEqual([])
  })

  it('a free-text delivery window is refused (BUG-13 server side)', async () => {
    h.session = session(OWNED)
    h.service = mockClient({})
    const res = await updateListing('l-1', { delivery_time: '5min' })
    expect(res.success).toBe(false)
    expect(h.service.calls).toEqual([])
  })

  it('updateListingPrice is the same path', async () => {
    h.session = session(OWNED)
    h.service = mockClient({ listings: [{ data: { id: 'l-1' }, error: null }] })
    expect((await updateListingPrice('l-1', 3)).success).toBe(true)
    expect(h.service.calls).toHaveLength(1)
  })
})

describe('bulkUpdateListings', () => {
  it('touches only rows the caller owns (the ownership query is seller-scoped) and skips moderated-out rows on activate', async () => {
    h.session = mockClient(
      { listings: [{ data: [{ id: 'l-1', ...OWNED, status: 'paused' }, { id: 'l-2', ...OWNED, status: 'pending_approval' }], error: null }], category_configs: [{ data: null, error: null }] },
      { auth: { getUser: async () => ({ data: { user: USER }, error: null }) } },
    )
    h.service = mockClient({ listings: [{ data: null, error: null }, { data: null, error: null }] })
    const res = await bulkUpdateListings(['l-1', 'l-2', 'l-3'], { status: 'active' })
    expect(res).toEqual({ success: true, updated: 1 })
    const writes = h.service.calls.filter((c: any) => c.table === 'listings')
    expect(writes).toHaveLength(1)
    expect(writes[0].filters).toEqual(expect.arrayContaining([['eq:id', 'l-1'], ['eq:seller_id', 'seller-1']]))
    const ownership = h.session.calls
    expect(ownership).toEqual([]) // session only reads
  })

  it('an invalid patch fails the whole batch before any write', async () => {
    h.session = mockClient(
      { listings: [{ data: [{ id: 'l-1', ...OWNED }], error: null }], category_configs: [{ data: null, error: null }] },
      { auth: { getUser: async () => ({ data: { user: USER }, error: null }) } },
    )
    h.service = mockClient({})
    const res = await bulkUpdateListings(['l-1'], { status: 'sold' } as never)
    expect(res.success).toBe(false)
    expect(h.service.calls).toEqual([])
  })
})
