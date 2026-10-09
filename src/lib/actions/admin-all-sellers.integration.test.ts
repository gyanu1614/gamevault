/**
 * getAllSellers against the local stack: the funnel must count people who
 * are mid-signup (no `role = 'seller'` yet), stage must follow /founding's
 * rules, and the stage filters must slice the same set.
 *
 * Uses the rows scripts/.local/seed-sellers.mjs creates (emails *@local.test);
 * skips when they are absent so the suite stays green on a bare stack.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createServiceRoleClient } from '@/lib/supabase/service'

vi.mock('@/lib/actions/admin-permissions', () => ({ requireAdmin: async () => ({ userId: 'test-admin', role: 'super_admin' }), requireRole: async () => ({ userId: 'test-admin', role: 'super_admin' }) }))
vi.mock('@/lib/email', () => ({}))

const { getAllSellers } = await import('./admin-all-sellers')

let seeded = false
beforeAll(async () => {
  const svc = createServiceRoleClient() as any
  const { data } = await svc.from('profiles').select('id').eq('email', 'stage2@local.test').limit(1)
  seeded = Array.isArray(data) && data.length > 0
})

describe('getAllSellers', () => {
  it('counts mid-signup people and derives their stage', async () => {
    if (!seeded) return
    const r = await getAllSellers({ q: 'local.test' })
    const byEmail = Object.fromEntries(r.rows.map((x) => [x.email, x]))
    expect(byEmail['stage2@local.test']?.stage).toBe(2)
    expect(byEmail['stage3@local.test']?.stage).toBe(3)
    expect(byEmail['stage4@local.test']?.stage).toBe(4)
    expect(byEmail['live0@local.test']?.stage).toBe(5)
    expect(byEmail['stage3@local.test']?.country).toBe('DE')
    expect(byEmail['live1@local.test']?.is_verified).toBe(true)
    expect(byEmail['live0@local.test']?.founding_seller).toBe(true)
    expect(byEmail['live0@local.test']?.agreement_signed_at).toBeTruthy()
    expect(r.funnel.live).toBeGreaterThanOrEqual(3)
    expect(r.funnel.signed_up).toBeGreaterThanOrEqual(6)
  })

  it('stage filters slice the set and newest come first', async () => {
    if (!seeded) return
    const live = await getAllSellers({ q: 'local.test', stage: 'live' })
    expect(live.rows.every((x) => x.stage === 5)).toBe(true)
    const prog = await getAllSellers({ q: 'local.test', stage: 'in_progress' })
    expect(prog.rows.every((x) => x.stage < 5)).toBe(true)
    expect(prog.rows.map((x) => x.email)).toContain('stage4@local.test')
    const stalled = await getAllSellers({ q: 'local.test', stage: 'stalled' })
    expect(stalled.rows.map((x) => x.email)).toEqual(['stage4@local.test'])
    const all = await getAllSellers({ q: 'local.test' })
    const t = all.rows.map((x) => new Date(x.signed_up_at).getTime())
    expect([...t].sort((a, b) => b - a)).toEqual(t)
  })
})
