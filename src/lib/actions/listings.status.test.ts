/**
 * AUTH-034 — updateListing must not let a seller move a moderated-out
 * listing (rejected / changes_requested / pending_approval) to 'active'.
 * The DB guard is the backstop; the action refuses first so the seller gets a
 * clear error instead of a 42501.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ update: vi.fn(), current: null as any }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/revalidation/listings', () => ({ revalidateListingSurfaces: vi.fn(async () => ({ tags: [] })) }))
// ACC-03: the session client only READS (ownership); the write is a
// service-role update. The assertion "writes nothing" therefore watches the
// service client.
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const b: any = {}
      for (const m of ['select', 'eq']) b[m] = () => b
      b.single = async () => ({ data: { id: 'l-1' }, error: null })
      b.update = (...a: unknown[]) => { h.update(...a); return b }
      return b
    },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'seller-1' } }, error: null }) },
    from: (table: string) => {
      const b: any = {}
      for (const m of ['select', 'eq']) b[m] = () => b
      const row = table === 'listings'
        ? { game_id: 'g', game_category_id: 'p', quantity: 5, min_quantity: 1, is_unlimited: false, delivery_method: 'manual', bundle_id: null, pair: { type: 'items' }, ...h.current }
        : null
      b.single = async () => ({ data: row, error: null })
      b.maybeSingle = async () => ({ data: row, error: null })
      b.then = (ok: any) => Promise.resolve({ data: row, error: null }).then(ok)
      return b
    },
  }),
}))

import { updateListing } from '@/lib/actions/listings'

beforeEach(() => { h.update.mockReset() })

describe('AUTH-034 — updateListing status transitions', () => {
  for (const from of ['rejected', 'changes_requested', 'pending_approval']) {
    it(`refuses ${from} → active and writes nothing`, async () => {
      h.current = { seller_id: 'seller-1', status: from }
      const res = await updateListing('l-1', { status: 'active' })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/moderat|review|resubmit/i)
      expect(h.update).not.toHaveBeenCalled()
    })
  }

  it('still allows paused → active', async () => {
    h.current = { seller_id: 'seller-1', status: 'paused' }
    const res = await updateListing('l-1', { status: 'active' })
    expect(res.success).toBe(true)
    expect(h.update).toHaveBeenCalledTimes(1)
    expect(h.update.mock.calls[0][0]).toMatchObject({ status: 'active' })
  })

  it('still allows rejected → draft (edit before resubmitting)', async () => {
    h.current = { seller_id: 'seller-1', status: 'rejected' }
    const res = await updateListing('l-1', { status: 'draft' })
    expect(res.success).toBe(true)
  })
})
