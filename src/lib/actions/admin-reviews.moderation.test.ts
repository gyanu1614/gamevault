/**
 * AUTH-011 — toggleReviewVisibility / toggleReviewFlag / deleteReview had no
 * in-code authorization; only RLS applied, and the reviewer's own UPDATE
 * policy let the author undo moderation. Now every one of them requires an
 * active admin/moderator role first and writes through the service role, so
 * the DB trigger (which has no admin shortcut) always sees a trusted caller.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  svcUpdate: vi.fn(),
  svcDelete: vi.fn(),
  sessionFrom: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/actions/admin-permissions', () => ({ requireRole: h.requireRole }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: h.sessionFrom, auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const b: any = { eq: () => b, select: () => b }
      b.update = (...a: unknown[]) => { h.svcUpdate(...a); return b }
      b.delete = () => { h.svcDelete(); return b }
      b.then = (ok: any) => Promise.resolve({ error: null }).then(ok)
      return b
    },
  }),
}))

import { toggleReviewVisibility, toggleReviewFlag, deleteReview } from '@/lib/actions/admin-reviews'

beforeEach(() => {
  h.requireRole.mockReset(); h.svcUpdate.mockReset(); h.svcDelete.mockReset(); h.sessionFrom.mockReset()
})

const ACTIONS: Array<[string, () => Promise<{ success: boolean }>]> = [
  ['toggleReviewVisibility', () => toggleReviewVisibility('r1', true)],
  ['toggleReviewFlag', () => toggleReviewFlag('r1', false)],
  ['deleteReview', () => deleteReview('r1')],
]

describe('AUTH-011 — admin review moderation actions are gated', () => {
  for (const [name, run] of ACTIONS) {
    it(`${name}: a non-admin caller is refused and nothing is written`, async () => {
      h.requireRole.mockRejectedValue(new Error('Role not allowed: none'))
      const res = await run()
      expect(res.success).toBe(false)
      expect(h.svcUpdate).not.toHaveBeenCalled()
      expect(h.svcDelete).not.toHaveBeenCalled()
      expect(h.sessionFrom).not.toHaveBeenCalled()
    })
  }

  it('the gate is the admin_roles-based requireRole with moderator/admin/super_admin', async () => {
    h.requireRole.mockResolvedValue({ userId: 'admin-1', role: 'moderator' })
    await toggleReviewVisibility('r1', false, 'spam')
    expect(h.requireRole).toHaveBeenCalledWith(expect.arrayContaining(['super_admin', 'admin', 'moderator']))
  })

  it('an admin write goes through the service role, never the session client', async () => {
    h.requireRole.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    const res = await toggleReviewVisibility('r1', false, 'spam')
    expect(res.success).toBe(true)
    expect(h.svcUpdate).toHaveBeenCalledTimes(1)
    expect(h.svcUpdate.mock.calls[0][0]).toMatchObject({ is_visible: false, moderation_reason: 'spam' })
    expect(h.sessionFrom).not.toHaveBeenCalled()
  })
})
