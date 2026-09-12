/**
 * AUTH-008 — referral_earnings is written by the backend only.
 * Exploit: any signed-in user INSERTs a commission row for a real order
 * (policy was `auth.uid() IS NOT NULL`) and, as referrer, UPDATEs it to paid.
 * Positive: the service role still writes; the referrer can still read own rows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('AUTH-008 — referral_earnings write lock (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() })

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it('a signed-in user cannot INSERT a commission for themselves', async () => {
    const res = await fx!.buyer.client.from('referral_earnings').insert({
      referrer_id: fx!.buyer.id, referred_user_id: fx!.seller.id, order_id: fx!.completedOrderId,
      type: 'purchase_commission', amount: 1000, status: 'pending',
    }).select('id')
    expect(res.error, 'insert must be rejected').not.toBeNull()
    expect(res.error!.code).toBe('42501')
    const { data } = await fx!.svc.from('referral_earnings').select('id').eq('order_id', fx!.completedOrderId)
    expect(data ?? []).toHaveLength(0)
  })

  it('the referrer cannot flip a pending row to paid', async () => {
    const { data: row, error } = await fx!.svc.from('referral_earnings').insert({
      referrer_id: fx!.seller.id, referred_user_id: fx!.buyer.id, order_id: fx!.completedOrderId,
      type: 'purchase_commission', amount: 0.1, status: 'pending',
    }).select('id').single()
    expect(error).toBeNull()
    const upd = await fx!.seller.client.from('referral_earnings')
      .update({ status: 'paid', paid_at: new Date().toISOString(), amount: 1000 })
      .eq('id', (row as any).id).select('id')
    // Either an explicit 42501 or a silent zero-row match — the row must not change.
    if (!upd.error) expect(upd.data ?? []).toHaveLength(0)
    const { data: after } = await fx!.svc.from('referral_earnings').select('status,amount').eq('id', (row as any).id).single()
    expect((after as any).status).toBe('pending')
    expect(Number((after as any).amount)).toBe(0.1)
  })

  it('the referrer can still read their own earnings', async () => {
    const { data, error } = await fx!.seller.client.from('referral_earnings').select('id').eq('referrer_id', fx!.seller.id)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })
})
