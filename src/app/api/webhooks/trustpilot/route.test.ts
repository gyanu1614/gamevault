/**
 * AUTH-015 — the Trustpilot webhook must fail CLOSED: with no secret configured
 * it refuses every request (503) instead of skipping verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// AUTH-015 — the webhook must write through the SERVICE-ROLE client:
// trustpilot_invitations is service-role-only under RLS and a webhook has no
// user session. The session client is mocked to explode if touched.
const serviceEq = vi.fn(async () => ({ error: null }))
const serviceUpdate = vi.fn(() => ({ eq: serviceEq }))
const serviceFrom = vi.fn(() => ({ update: serviceUpdate }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: serviceFrom }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => { throw new Error('session client must not be used by a webhook') } }),
}))

async function post(body: string, headers: Record<string, string> = {}) {
  vi.resetModules()
  const { POST } = await import('./route')
  const { NextRequest } = await import('next/server')
  return POST(new NextRequest('http://localhost/api/webhooks/trustpilot', { method: 'POST', body, headers }))
}

async function hmacHex(secret: string, body: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const BODY = JSON.stringify({ eventType: 'review-created', reviewId: 'r1', referenceId: 'order-1', businessUnitId: 'bu', review: { stars: 5 } })

describe('Trustpilot webhook — AUTH-015 fail-closed', () => {
  beforeEach(() => { delete process.env.TRUSTPILOT_WEBHOOK_SECRET })

  it('secret unset → 503, even with a signature header (the old fail-open path)', async () => {
    const res = await post(BODY, { 'x-trustpilot-signature': 'sha256=deadbeef' })
    expect(res.status).toBe(503)
  })

  it('secret set, no signature → 401', async () => {
    process.env.TRUSTPILOT_WEBHOOK_SECRET = 'test-secret'
    expect((await post(BODY)).status).toBe(401)
  })

  it('secret set, forged signature → 401', async () => {
    process.env.TRUSTPILOT_WEBHOOK_SECRET = 'test-secret'
    const forged = await hmacHex('wrong-secret', BODY)
    expect((await post(BODY, { 'x-trustpilot-signature': `sha256=${forged}` })).status).toBe(401)
  })

  it('secret set, genuine signature → passes verification and writes via the service role', async () => {
    process.env.TRUSTPILOT_WEBHOOK_SECRET = 'test-secret'
    serviceFrom.mockClear(); serviceEq.mockClear()
    const good = await hmacHex('test-secret', BODY)
    const res = await post(BODY, { 'x-trustpilot-signature': `sha256=${good}` })
    expect(res.status).toBe(200)
    expect(serviceFrom).toHaveBeenCalledWith('trustpilot_invitations')
    expect(serviceEq).toHaveBeenCalledWith('order_id', 'order-1')
  })
})
