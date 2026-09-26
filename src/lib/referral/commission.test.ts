/**
 * AUTH-008 — referral commission is backend-only and derived from the order.
 *
 * `recordReferralCommission({ platformFee })` was an exported server action
 * that trusted a caller-supplied fee; `applyReferralAtSignup` inserted a signup
 * bonus with no dedupe. Both now live in a server-only module, run under the
 * service role, and read the amount from the orders row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

type Res = { data: unknown; error: unknown }
const h = vi.hoisted(() => ({ svc: null as any }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service-role', () => ({ createServiceRoleClient: () => h.svc }))

import { recordReferralCommission, applyReferralAtSignup, REFERRAL_COMMISSION_RATE } from './commission'

function mockClient(queues: Record<string, Res[]>) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  return {
    calls,
    from(table: string) {
      const res = queues[table]?.shift() ?? { data: null, error: null }
      const b: any = {}
      for (const m of ['select', 'eq', 'in', 'is', 'limit', 'order']) b[m] = () => b
      for (const m of ['insert', 'update', 'upsert']) b[m] = (...args: unknown[]) => { calls.push({ table, op: m, args }); return b }
      b.maybeSingle = async () => res
      b.single = async () => res
      b.then = (ok: any, ko: any) => Promise.resolve(res).then(ok, ko)
      return b
    },
  }
}

beforeEach(() => { h.svc = null })

describe('AUTH-008 — referral.ts no longer exports the money-writing functions', () => {
  const SRC = readFileSync('src/lib/actions/referral.ts', 'utf8')
  it('recordReferralCommission / applyReferralAtSignup are not server actions', () => {
    expect(SRC).toMatch(/^\s*['"]use server['"]\s*$/m)
    expect(SRC).not.toMatch(/export\s+async\s+function\s+recordReferralCommission/)
    expect(SRC).not.toMatch(/export\s+async\s+function\s+applyReferralAtSignup/)
  })
  it('the commission module is server-only and not an action module', () => {
    const MOD = readFileSync('src/lib/referral/commission.ts', 'utf8')
    expect(MOD).toMatch(/^import ['"]server-only['"]/m)
    expect(MOD).not.toMatch(/^\s*['"]use server['"]\s*$/m)
  })
})

describe('AUTH-008 — recordReferralCommission(orderId)', () => {
  it('computes the commission from the order row, never from a parameter', async () => {
    h.svc = mockClient({
      orders: [{ data: { id: 'o1', buyer_id: 'u-referred', platform_fee: 12.5, status: 'completed' }, error: null }],
      profiles: [{ data: { referred_by: 'u-referrer' }, error: null }],
      referral_earnings: [{ data: null, error: null }], // no existing row
    })
    await recordReferralCommission('o1')
    const ins = h.svc.calls.filter((c: any) => c.table === 'referral_earnings' && c.op === 'insert')
    expect(ins).toHaveLength(1)
    expect(ins[0].args[0]).toMatchObject({
      referrer_id: 'u-referrer', referred_user_id: 'u-referred', order_id: 'o1',
      type: 'purchase_commission', status: 'pending', amount: Number((12.5 * REFERRAL_COMMISSION_RATE).toFixed(2)),
    })
  })

  it('writes nothing for an order that is not completed', async () => {
    h.svc = mockClient({
      orders: [{ data: { id: 'o1', buyer_id: 'u-referred', platform_fee: 12.5, status: 'pending' }, error: null }],
      profiles: [{ data: { referred_by: 'u-referrer' }, error: null }],
    })
    await recordReferralCommission('o1')
    expect(h.svc.calls).toHaveLength(0)
  })

  it('does not double-credit the same order', async () => {
    h.svc = mockClient({
      orders: [{ data: { id: 'o1', buyer_id: 'u-referred', platform_fee: 12.5, status: 'completed' }, error: null }],
      profiles: [{ data: { referred_by: 'u-referrer' }, error: null }],
      referral_earnings: [{ data: { id: 'existing' }, error: null }],
    })
    await recordReferralCommission('o1')
    expect(h.svc.calls).toHaveLength(0)
  })
})

describe('AUTH-008 — applyReferralAtSignup', () => {
  it('refuses self-referral', async () => {
    h.svc = mockClient({ profiles: [{ data: { id: 'u-new' }, error: null }] })
    await applyReferralAtSignup('u-new', 'ABC123')
    expect(h.svc.calls).toHaveLength(0)
  })

  it('does not overwrite an existing referred_by', async () => {
    h.svc = mockClient({
      profiles: [
        { data: { id: 'u-referrer' }, error: null },            // referrer lookup
        { data: { referred_by: 'someone-else' }, error: null }, // new user's current state
      ],
    })
    await applyReferralAtSignup('u-new', 'ABC123')
    expect(h.svc.calls.filter((c: any) => c.op === 'update')).toHaveLength(0)
  })

  it('sets referred_by for a fresh user', async () => {
    h.svc = mockClient({
      profiles: [
        { data: { id: 'u-referrer' }, error: null },
        { data: { referred_by: null }, error: null },
      ],
    })
    await applyReferralAtSignup('u-new', 'abc123')
    const upd = h.svc.calls.filter((c: any) => c.table === 'profiles' && c.op === 'update')
    expect(upd).toHaveLength(1)
    expect(upd[0].args[0]).toEqual({ referred_by: 'u-referrer' })
  })
})
