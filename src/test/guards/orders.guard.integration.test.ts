/**
 * AUTH-002 — orders amount/identity/escrow columns are guarded.
 * Exploit: seller (or buyer) rewrites their own order via PostgREST.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, guardsApplied, makeFixture, expectGuardRejection, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('AUTH-002 — orders column guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await guardsApplied(fx.svc)
    if (!ready) console.warn('[orders guard] skipping — 20260911120000_auth_p0_column_guards.sql not applied')
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('seller cannot inflate seller_payout / total_amount on their own order', async () => {
    if (!ready) return
    const res = await fx!.seller.client.from('orders')
      .update({ seller_payout: 999999, total_amount: 999999 }).eq('id', fx!.pendingOrderId).select('id')
    expectGuardRejection(res, 'orders')
    const { data } = await fx!.svc.from('orders').select('seller_payout,total_amount').eq('id', fx!.pendingOrderId).single()
    expect(Number((data as any).seller_payout)).toBe(1)
    expect(Number((data as any).total_amount)).toBe(1)
  })

  it('buyer cannot set escrow_status=released on their own order (verified live exploit 3a)', async () => {
    if (!ready) return
    const res = await fx!.buyer.client.from('orders')
      .update({ escrow_status: 'released' }).eq('id', fx!.pendingOrderId).select('id')
    expectGuardRejection(res, 'orders')
    const { data } = await fx!.svc.from('orders').select('escrow_status').eq('id', fx!.pendingOrderId).single()
    expect((data as any).escrow_status).toBe('pending')
  })

  it('seller cannot re-point the order at another seller / listing', async () => {
    if (!ready) return
    const res = await fx!.seller.client.from('orders')
      .update({ seller_id: fx!.buyer.id }).eq('id', fx!.pendingOrderId).select('id')
    expectGuardRejection(res, 'orders')
  })

  it('service role (the backend) can still write the protected columns', async () => {
    if (!ready) return
    const { error } = await fx!.svc.from('orders').update({ seller_payout: 0.9 }).eq('id', fx!.pendingOrderId)
    expect(error).toBeNull()
    const { data } = await fx!.svc.from('orders').select('seller_payout').eq('id', fx!.pendingOrderId).single()
    expect(Number((data as any).seller_payout)).toBe(0.9)
  })
})
