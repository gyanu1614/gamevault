/**
 * PAY-010 (round B Part 4): a webhook whose dispatch succeeded but whose
 * webhook_event_mark FAILED used to answer 200 — the row stayed `received`,
 * every provider retry deduped, and the payment's bookkeeping was lost with
 * nobody told. The router must answer 500 so the provider retries; the
 * reconciler covers the rest.
 */
import { describe, it, expect, vi } from 'vitest'

const rpcCalls: { fn: string; args: any }[] = []
let markFails = false
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    rpc: async (fn: string, args: any) => {
      rpcCalls.push({ fn, args })
      if (fn === 'webhook_event_claim') return { data: true, error: null }
      if (fn === 'webhook_event_mark') return markFails ? { data: null, error: { message: 'connection reset' } } : { data: null, error: null }
      return { data: null, error: { message: `unexpected rpc ${fn}` } }
    },
  }),
}))
vi.mock('@/lib/payments/dispatch', () => ({ dispatch: async () => ({ applied: true }) }))

describe('webhook router — mark failure', () => {
  const sig = { 'x-fake-signature': process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret' }
  const body = JSON.stringify({ chargeId: 'c1', orderId: 'o1', status: 'paid', amountMinor: '100', currency: 'USD' })

  it('stores the verified events on the claim so the reconciler can re-run them', async () => {
    rpcCalls.length = 0
    markFails = false
    const { handleWebhook } = await import('@/lib/payments/webhook-router')
    const r = await handleWebhook('fake', sig, body)
    expect(r.status).toBe(200)
    const claim = rpcCalls.find((c) => c.fn === 'webhook_event_claim')!
    expect(claim.args.p_events).toEqual([expect.objectContaining({ type: 'CHARGE_CONFIRMED', orderId: 'o1' })])
  })

  it('answers 500 when webhook_event_mark fails after a successful dispatch', async () => {
    rpcCalls.length = 0
    markFails = true
    const { handleWebhook } = await import('@/lib/payments/webhook-router')
    const r = await handleWebhook('fake', sig, body)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(500)
    expect(r.error).toMatch(/mark failed/)
  })
})
