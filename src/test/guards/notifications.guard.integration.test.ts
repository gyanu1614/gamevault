/**
 * AUTH-013 — notifications are inserted by the backend only.
 * Exploit: any signed-in user INSERTs a notification with an arbitrary
 * title/link for ANY user_id (policy was `TO authenticated WITH CHECK (true)`).
 * Positive: the service role inserts; the recipient still marks their own as read.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('AUTH-013 — notifications INSERT lock (integration)', () => {
  beforeAll(async () => { fx = await makeFixture(); ready = await p1GuardsApplied(fx.svc) }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  // NOTE: no `.select()` on the exploit inserts — a RETURNING clause would be
  // refused by the recipient-only SELECT policy and mask the real hole (the
  // attacker never needs the row back).
  it('a signed-in user cannot push a notification to another user', async () => {
    const res = await fx!.buyer.client.from('notifications').insert({
      user_id: fx!.seller.id, type: 'system', title: 'Verify your account',
      message: 'Click to keep selling', link: 'https://evil.example/login',
    })
    expect(res.error, 'insert must be rejected').not.toBeNull()
    expect(res.error!.code).toBe('42501')
    const { data } = await fx!.svc.from('notifications').select('id').eq('user_id', fx!.seller.id).eq('type', 'system')
    expect(data ?? []).toHaveLength(0)
  })

  it('a signed-in user cannot even insert for themselves (all inserts are backend)', async () => {
    const res = await fx!.buyer.client.from('notifications').insert({
      user_id: fx!.buyer.id, type: 'system', title: 't', message: 'm', link: '/',
    })
    expect(res.error?.code).toBe('42501')
  })

  it('the service role inserts and the recipient can still mark it read', async () => {
    const { data, error } = await fx!.svc.from('notifications').insert({
      user_id: fx!.buyer.id, type: 'order_update', title: 'Order shipped', message: 'ok', link: '/account/orders/x',
    }).select('id').single()
    expect(error).toBeNull()
    const upd = await fx!.buyer.client.from('notifications').update({ is_read: true }).eq('id', (data as any).id).select('is_read')
    expect(upd.error).toBeNull()
    expect((upd.data as any)[0].is_read).toBe(true)
  })
})
