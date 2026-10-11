import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  role: 'admin' as string | null,
  updates: [] as Array<Record<string, unknown>>,
  revalidated: [] as string[],
  updateError: null as null | { message: string },
}))

vi.mock('@/lib/email', () => ({}))
vi.mock('next/cache', () => ({
  revalidateTag: (t: string) => h.revalidated.push(`tag:${t}`),
  revalidatePath: (p: string) => h.revalidated.push(`path:${p}`),
  unstable_cache: (fn: unknown) => fn,
}))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireRole: async (roles: string[]) => {
    if (!h.role || !roles.includes(h.role)) throw new Error(`Role not allowed: ${h.role}`)
    return { userId: 'admin-1', role: h.role }
  },
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      update: (row: Record<string, unknown>) => ({
        eq: async () => {
          h.updates.push(row)
          return { error: h.updateError }
        },
      }),
    }),
  }),
}))

import { setTrustpilotReviewCount } from './admin-trustpilot'

describe('setTrustpilotReviewCount', () => {
  beforeEach(() => {
    h.role = 'admin'
    h.updates = []
    h.revalidated = []
    h.updateError = null
  })

  it('saves the count and refreshes the public pages that read it', async () => {
    await expect(setTrustpilotReviewCount(12)).resolves.toEqual({ ok: true })
    expect(h.updates).toEqual([expect.objectContaining({ review_count: 12, updated_by: 'admin-1' })])
    expect(h.revalidated).toContain('tag:trustpilot:settings')
  })

  it('refuses a non-admin before touching the database', async () => {
    h.role = 'support'
    await expect(setTrustpilotReviewCount(12)).rejects.toThrow(/Role not allowed/)
    expect(h.updates).toEqual([])
  })

  it.each([-1, 1.5, Number.NaN, 2_000_000])('rejects %s', async (n) => {
    await expect(setTrustpilotReviewCount(n)).resolves.toMatchObject({ ok: false })
    expect(h.updates).toEqual([])
  })

  it('reports a failed save without revalidating', async () => {
    h.updateError = { message: 'down' }
    await expect(setTrustpilotReviewCount(3)).resolves.toMatchObject({ ok: false })
    expect(h.revalidated).toEqual([])
  })
})
