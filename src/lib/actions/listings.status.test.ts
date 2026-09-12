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
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'seller-1' } }, error: null }) },
    from: () => {
      const b: any = {}
      for (const m of ['select', 'eq']) b[m] = () => b
      b.single = async () => ({ data: h.current, error: null })
      b.update = (...a: unknown[]) => { h.update(...a); return b }
      b.then = (ok: any) => Promise.resolve({ data: h.current, error: null }).then(ok)
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
